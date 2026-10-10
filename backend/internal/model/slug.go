package model

import (
	"strings"
	"unicode"
)

// Slugify turns a title into an ASCII slug: lower case, [a-z0-9-], Turkish
// (and common Latin) characters transliterated, runs of other characters
// collapsed into single dashes. The result may be empty when the input has no
// usable characters.
func Slugify(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	lastDash := true // suppress a leading dash
	write := func(r rune) {
		if r == '-' {
			if !lastDash {
				b.WriteByte('-')
				lastDash = true
			}
			return
		}
		b.WriteRune(r)
		lastDash = false
	}
	for _, r := range strings.ToLower(replaceTurkish(s)) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			write(r)
		case r == '-', r == ' ', r == '_', r == '/', r == '.', r == ',', unicode.IsSpace(r), unicode.IsPunct(r), unicode.IsSymbol(r):
			write('-')
		default:
			if repl, ok := latinFold[r]; ok {
				for _, rr := range repl {
					write(rr)
				}
			} else {
				write('-')
			}
		}
	}
	out := strings.TrimRight(b.String(), "-")
	if len(out) > 80 {
		out = strings.TrimRight(out[:80], "-")
	}
	return out
}

// replaceTurkish handles the dotted/dotless i before lower-casing, because
// strings.ToLower maps 'İ' to "i̇" (i + combining dot) in Unicode.
func replaceTurkish(s string) string {
	return turkishReplacer.Replace(s)
}

var turkishReplacer = strings.NewReplacer(
	"İ", "i", "I", "i", "ı", "i",
	"Ç", "c", "ç", "c",
	"Ğ", "g", "ğ", "g",
	"Ö", "o", "ö", "o",
	"Ş", "s", "ş", "s",
	"Ü", "u", "ü", "u",
	"™", "", "®", "", "©", "",
)

var latinFold = map[rune]string{
	'à': "a", 'á': "a", 'â': "a", 'ã': "a", 'ä': "a", 'å': "a", 'æ': "ae",
	'è': "e", 'é': "e", 'ê': "e", 'ë': "e",
	'ì': "i", 'í': "i", 'î': "i", 'ï': "i",
	'ò': "o", 'ó': "o", 'ô': "o", 'õ': "o", 'ø': "o", 'œ': "oe",
	'ù': "u", 'ú': "u", 'û': "u",
	'ñ': "n", 'ß': "ss", 'ý': "y", 'ÿ': "y", 'ž': "z", 'č': "c", 'ć': "c", 'š': "s", 'đ': "d", 'ł': "l",
}
