// Package auth implements password hashing (PBKDF2-HMAC-SHA256), in-memory
// sessions with idle expiry and a per-IP login rate limiter.
package auth

import (
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"sync"
	"time"
)

// PBKDF2 parameters (ARCHITECTURE §4.1).
const (
	Iterations = 210000
	KeyLength  = 32
	SaltLength = 16
)

// HashPassword derives a salt and key for the password. Both are base64.
func HashPassword(password string) (salt, hash string, err error) {
	raw := make([]byte, SaltLength)
	if _, err := rand.Read(raw); err != nil {
		return "", "", err
	}
	key, err := pbkdf2.Key(sha256.New, password, raw, Iterations, KeyLength)
	if err != nil {
		return "", "", err
	}
	return base64.StdEncoding.EncodeToString(raw), base64.StdEncoding.EncodeToString(key), nil
}

// VerifyPassword checks password against a stored salt/hash pair using a
// constant-time comparison. Malformed stored values simply fail.
func VerifyPassword(password, salt, hash string) bool {
	rawSalt, err := base64.StdEncoding.DecodeString(salt)
	if err != nil {
		return false
	}
	rawHash, err := base64.StdEncoding.DecodeString(hash)
	if err != nil {
		return false
	}
	key, err := pbkdf2.Key(sha256.New, password, rawSalt, Iterations, len(rawHash))
	if err != nil || len(rawHash) == 0 {
		return false
	}
	return subtle.ConstantTimeCompare(key, rawHash) == 1
}

// RandomPassword returns n characters from an unambiguous alphabet.
func RandomPassword(n int) (string, error) {
	const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	raw := make([]byte, n)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	out := make([]byte, n)
	for i, b := range raw {
		out[i] = alphabet[int(b)%len(alphabet)]
	}
	return string(out), nil
}

// ---- sessions ------------------------------------------------------------

// SessionIdle is the idle expiry for admin sessions.
const SessionIdle = 24 * time.Hour

type session struct {
	username string
	lastUsed time.Time
}

// Sessions is an in-memory session table.
type Sessions struct {
	mu   sync.Mutex
	data map[string]*session
	idle time.Duration
	now  func() time.Time
}

// NewSessions creates an empty session table with the given idle expiry.
func NewSessions(idle time.Duration) *Sessions {
	if idle <= 0 {
		idle = SessionIdle
	}
	return &Sessions{data: map[string]*session{}, idle: idle, now: time.Now}
}

// Create issues a new random token (32 bytes, base64url) for username.
func (s *Sessions) Create(username string) (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	token := base64.RawURLEncoding.EncodeToString(raw)
	s.mu.Lock()
	s.data[token] = &session{username: username, lastUsed: s.now()}
	s.mu.Unlock()
	return token, nil
}

// Lookup returns the username for a token, refreshing its last-used time.
// Expired tokens are removed and reported as unknown.
func (s *Sessions) Lookup(token string) (string, bool) {
	if token == "" {
		return "", false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	sess, ok := s.data[token]
	if !ok {
		return "", false
	}
	now := s.now()
	if now.Sub(sess.lastUsed) > s.idle {
		delete(s.data, token)
		return "", false
	}
	sess.lastUsed = now
	return sess.username, true
}

// Delete removes a token.
func (s *Sessions) Delete(token string) {
	s.mu.Lock()
	delete(s.data, token)
	s.mu.Unlock()
}

// DeleteOthers removes every session of username except keep (used after a
// password change).
func (s *Sessions) DeleteOthers(username, keep string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for token, sess := range s.data {
		if sess.username == username && token != keep {
			delete(s.data, token)
		}
	}
}

// Sweep removes expired sessions and returns how many were removed.
func (s *Sessions) Sweep() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.now()
	removed := 0
	for token, sess := range s.data {
		if now.Sub(sess.lastUsed) > s.idle {
			delete(s.data, token)
			removed++
		}
	}
	return removed
}

// Count returns the number of live sessions (for diagnostics/tests).
func (s *Sessions) Count() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.data)
}

// ---- rate limiter --------------------------------------------------------

// RateLimiter blocks a key (client IP) after `limit` failures inside `window`.
type RateLimiter struct {
	mu       sync.Mutex
	failures map[string][]time.Time
	limit    int
	window   time.Duration
	now      func() time.Time
}

// NewRateLimiter creates a limiter (5 failures / 15 min by default).
func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	if limit <= 0 {
		limit = 5
	}
	if window <= 0 {
		window = 15 * time.Minute
	}
	return &RateLimiter{failures: map[string][]time.Time{}, limit: limit, window: window, now: time.Now}
}

func (r *RateLimiter) prune(key string, now time.Time) []time.Time {
	list := r.failures[key]
	kept := list[:0]
	for _, t := range list {
		if now.Sub(t) < r.window {
			kept = append(kept, t)
		}
	}
	if len(kept) == 0 {
		delete(r.failures, key)
		return nil
	}
	r.failures[key] = kept
	return kept
}

// Allowed reports whether key may attempt a login and, if not, how long it
// must wait.
func (r *RateLimiter) Allowed(key string) (bool, time.Duration) {
	r.mu.Lock()
	defer r.mu.Unlock()
	now := r.now()
	list := r.prune(key, now)
	if len(list) < r.limit {
		return true, 0
	}
	retry := r.window - now.Sub(list[0])
	if retry < time.Second {
		retry = time.Second
	}
	return false, retry
}

// Fail records a failed attempt.
func (r *RateLimiter) Fail(key string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	now := r.now()
	r.prune(key, now)
	r.failures[key] = append(r.failures[key], now)
}

// Reset clears failures for key (after a successful login).
func (r *RateLimiter) Reset(key string) {
	r.mu.Lock()
	delete(r.failures, key)
	r.mu.Unlock()
}

// Sweep drops stale entries for all keys.
func (r *RateLimiter) Sweep() {
	r.mu.Lock()
	defer r.mu.Unlock()
	now := r.now()
	for key := range r.failures {
		r.prune(key, now)
	}
}
