// Package admin embeds the admin panel (backend/admin/ui) into the binary.
package admin

import "embed"

// Files contains the ui/ directory; serve it with fs.Sub(Files, "ui").
//
//go:embed all:ui
var Files embed.FS
