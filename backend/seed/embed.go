// Package seed embeds the first-run content (seed.json and the images it
// references). The import logic lives in internal/seed.
package seed

import "embed"

// Files holds seed.json and images/*.jpg.
//
//go:embed seed.json images/*.jpg
var Files embed.FS
