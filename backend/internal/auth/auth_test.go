package auth

import (
	"encoding/base64"
	"testing"
	"time"
)

func TestHashAndVerify(t *testing.T) {
	salt, hash, err := HashPassword("correct horse")
	if err != nil {
		t.Fatal(err)
	}
	rawSalt, _ := base64.StdEncoding.DecodeString(salt)
	rawHash, _ := base64.StdEncoding.DecodeString(hash)
	if len(rawSalt) != SaltLength || len(rawHash) != KeyLength {
		t.Fatalf("salt %d hash %d", len(rawSalt), len(rawHash))
	}
	if !VerifyPassword("correct horse", salt, hash) {
		t.Fatal("correct password rejected")
	}
	if VerifyPassword("wrong horse", salt, hash) {
		t.Fatal("wrong password accepted")
	}
	if VerifyPassword("", salt, hash) {
		t.Fatal("empty password accepted")
	}
	if VerifyPassword("correct horse", "not base64!", hash) {
		t.Fatal("malformed salt accepted")
	}
	// Two hashes of the same password differ because the salt is random.
	salt2, hash2, _ := HashPassword("correct horse")
	if salt2 == salt || hash2 == hash {
		t.Fatal("salt not random")
	}
}

func TestRandomPassword(t *testing.T) {
	p, err := RandomPassword(16)
	if err != nil || len(p) != 16 {
		t.Fatalf("%q %v", p, err)
	}
}

func TestSessions(t *testing.T) {
	now := time.Now()
	s := NewSessions(time.Hour)
	s.now = func() time.Time { return now }
	tok, err := s.Create("admin")
	if err != nil {
		t.Fatal(err)
	}
	if u, ok := s.Lookup(tok); !ok || u != "admin" {
		t.Fatal("lookup failed")
	}
	if _, ok := s.Lookup("nope"); ok {
		t.Fatal("unknown token accepted")
	}
	now = now.Add(30 * time.Minute)
	if _, ok := s.Lookup(tok); !ok {
		t.Fatal("session should still be valid (touched)")
	}
	now = now.Add(61 * time.Minute)
	if _, ok := s.Lookup(tok); ok {
		t.Fatal("session should have expired")
	}
	tok2, _ := s.Create("admin")
	tok3, _ := s.Create("admin")
	s.DeleteOthers("admin", tok2)
	if _, ok := s.Lookup(tok3); ok {
		t.Fatal("other session should be gone")
	}
	if _, ok := s.Lookup(tok2); !ok {
		t.Fatal("kept session missing")
	}
	s.Delete(tok2)
	if s.Count() != 0 {
		t.Fatalf("count = %d", s.Count())
	}
}

func TestRateLimiter(t *testing.T) {
	now := time.Now()
	r := NewRateLimiter(5, 15*time.Minute)
	r.now = func() time.Time { return now }
	for i := 0; i < 5; i++ {
		if ok, _ := r.Allowed("1.2.3.4"); !ok {
			t.Fatalf("blocked too early at %d", i)
		}
		r.Fail("1.2.3.4")
	}
	if ok, retry := r.Allowed("1.2.3.4"); ok || retry <= 0 {
		t.Fatal("should be blocked")
	}
	if ok, _ := r.Allowed("5.6.7.8"); !ok {
		t.Fatal("other ip should be allowed")
	}
	now = now.Add(16 * time.Minute)
	if ok, _ := r.Allowed("1.2.3.4"); !ok {
		t.Fatal("window should have passed")
	}
	r.Fail("1.2.3.4")
	r.Reset("1.2.3.4")
	r.Sweep()
	if ok, _ := r.Allowed("1.2.3.4"); !ok {
		t.Fatal("reset should allow")
	}
}
