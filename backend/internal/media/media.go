// Package media decodes uploaded images, produces downscaled JPEG variants
// with an area-averaging (box) filter written on top of the standard library,
// and writes the files into the uploads directory.
package media

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/gif"
	"image/jpeg"
	"image/png"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// Variant widths and JPEG quality.
const (
	LargeWidth  = 1200
	ThumbWidth  = 400
	JPEGQuality = 85
)

// Register the decoders explicitly (the blank imports above do it too, but
// this makes the intent visible).
func init() {
	_ = jpeg.Decode
	_ = png.Decode
	_ = gif.Decode
}

// ErrUnsupported is returned when the upload is not an accepted image type.
var ErrUnsupported = errors.New("unsupported image type")

// ErrDecode is returned when a JPEG/PNG cannot be decoded.
var ErrDecode = errors.New("image cannot be decoded")

// FileNamePattern validates names served from /uploads: <id>.<ext>,
// <id>_w1200.jpg or <id>_w400.jpg with a 16-char hex id.
var FileNamePattern = regexp.MustCompile(`^[a-f0-9]{16}(_w1200|_w400)?\.(jpg|png|webp|gif)$`)

// ContentTypeFor returns the MIME type for an upload file name based on its
// extension (names have been validated with FileNamePattern).
func ContentTypeFor(name string) string {
	switch strings.ToLower(filepath.Ext(name)) {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".webp":
		return "image/webp"
	case ".gif":
		return "image/gif"
	}
	return "application/octet-stream"
}

// Result is a processed upload ready to be written to disk.
type Result struct {
	Mime     string
	Ext      string // "jpg" | "png" | "webp" | "gif"
	Width    int
	Height   int
	Size     int64
	Original []byte
	Large    []byte // JPEG w1200 variant (nil for webp/gif)
	Thumb    []byte // JPEG w400 variant (nil for webp/gif)
}

// Process sniffs and decodes the upload. JPEG and PNG get w1200/w400 JPEG
// variants; WebP and GIF are kept as-is (the standard library cannot encode
// them). For WebP the dimensions are read from the container header; if the
// header is unknown they stay 0.
func Process(data []byte) (*Result, error) {
	if len(data) == 0 {
		return nil, ErrUnsupported
	}
	mime := http.DetectContentType(data)
	res := &Result{Mime: mime, Size: int64(len(data)), Original: data}
	switch mime {
	case "image/jpeg", "image/png":
		res.Ext = "jpg"
		if mime == "image/png" {
			res.Ext = "png"
		}
		img, _, err := image.Decode(bytes.NewReader(data))
		if err != nil {
			return nil, fmt.Errorf("%w: %v", ErrDecode, err)
		}
		rgba := toRGBAOverWhite(img)
		res.Width, res.Height = rgba.Bounds().Dx(), rgba.Bounds().Dy()
		large, err := encodeJPEG(fitWidth(rgba, LargeWidth))
		if err != nil {
			return nil, err
		}
		thumb, err := encodeJPEG(fitWidth(rgba, ThumbWidth))
		if err != nil {
			return nil, err
		}
		res.Large, res.Thumb = large, thumb
	case "image/gif":
		res.Ext = "gif"
		cfg, err := gif.DecodeConfig(bytes.NewReader(data))
		if err != nil {
			return nil, fmt.Errorf("%w: %v", ErrDecode, err)
		}
		res.Width, res.Height = cfg.Width, cfg.Height
	case "image/webp":
		res.Ext = "webp"
		res.Width, res.Height = webpDimensions(data)
	default:
		return nil, ErrUnsupported
	}
	return res, nil
}

// FileNames returns the names of the files for a media id, keyed like
// Media.Variants ("orig", "w1200", "w400").
func (r *Result) FileNames(id string) map[string]string {
	names := map[string]string{"orig": id + "." + r.Ext}
	if r.Large != nil {
		names["w1200"] = id + "_w1200.jpg"
	}
	if r.Thumb != nil {
		names["w400"] = id + "_w400.jpg"
	}
	return names
}

// Save writes the original and the variants into dir and returns the
// variants map. On error, files written so far are removed.
func (r *Result) Save(dir, id string) (map[string]string, error) {
	names := r.FileNames(id)
	written := []string{}
	fail := func(err error) (map[string]string, error) {
		for _, n := range written {
			_ = os.Remove(filepath.Join(dir, n))
		}
		return nil, err
	}
	write := func(name string, data []byte) error {
		path := filepath.Join(dir, name)
		if err := os.WriteFile(path, data, 0o644); err != nil {
			return fmt.Errorf("write %s: %w", path, err)
		}
		written = append(written, name)
		return nil
	}
	if err := write(names["orig"], r.Original); err != nil {
		return fail(err)
	}
	if r.Large != nil {
		if err := write(names["w1200"], r.Large); err != nil {
			return fail(err)
		}
	}
	if r.Thumb != nil {
		if err := write(names["w400"], r.Thumb); err != nil {
			return fail(err)
		}
	}
	return names, nil
}

// RemoveFiles deletes every variant file of a media document. Missing files
// are not an error.
func RemoveFiles(dir string, variants map[string]string) error {
	var firstErr error
	for _, name := range variants {
		if !FileNamePattern.MatchString(name) {
			continue
		}
		if err := os.Remove(filepath.Join(dir, name)); err != nil && !errors.Is(err, os.ErrNotExist) && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

// toRGBAOverWhite converts any image to *image.RGBA, compositing alpha over
// white so transparent PNGs look right as JPEG.
func toRGBAOverWhite(img image.Image) *image.RGBA {
	b := img.Bounds()
	dst := image.NewRGBA(image.Rect(0, 0, b.Dx(), b.Dy()))
	draw.Draw(dst, dst.Bounds(), image.NewUniform(color.White), image.Point{}, draw.Src)
	draw.Draw(dst, dst.Bounds(), img, b.Min, draw.Over)
	return dst
}

// fitWidth downscales so the width is at most maxWidth, keeping the aspect
// ratio. Images that are already narrow are returned unchanged.
func fitWidth(src *image.RGBA, maxWidth int) *image.RGBA {
	w, h := src.Bounds().Dx(), src.Bounds().Dy()
	if w <= maxWidth || w == 0 || h == 0 {
		return src
	}
	nh := int(float64(h)*float64(maxWidth)/float64(w) + 0.5)
	if nh < 1 {
		nh = 1
	}
	return Resize(src, maxWidth, nh)
}

func encodeJPEG(img *image.RGBA) ([]byte, error) {
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: JPEGQuality}); err != nil {
		return nil, fmt.Errorf("encode jpeg: %w", err)
	}
	return buf.Bytes(), nil
}

// weight is one source index with its fractional coverage of a target pixel.
type weight struct {
	index int
	w     float32
}

// boxWeights computes, for each of n target samples, the source samples (out
// of m) it covers and their fractional weights, normalised to sum to 1.
func boxWeights(m, n int) [][]weight {
	out := make([][]weight, n)
	scale := float64(m) / float64(n)
	for i := 0; i < n; i++ {
		start := float64(i) * scale
		end := float64(i+1) * scale
		if end > float64(m) {
			end = float64(m)
		}
		first := int(start)
		last := int(end)
		if float64(last) == end && last > first {
			last--
		}
		if last >= m {
			last = m - 1
		}
		var ws []weight
		total := 0.0
		for s := first; s <= last; s++ {
			lo, hi := float64(s), float64(s+1)
			if lo < start {
				lo = start
			}
			if hi > end {
				hi = end
			}
			cov := hi - lo
			if cov <= 0 {
				continue
			}
			ws = append(ws, weight{index: s, w: float32(cov)})
			total += cov
		}
		if total > 0 {
			for k := range ws {
				ws[k].w = float32(float64(ws[k].w) / total)
			}
		}
		out[i] = ws
	}
	return out
}

// Resize downscales (or, if asked, upscales) src to dw×dh using a separable
// area-averaging box filter: every target pixel is the exact average of the
// source area it covers, so detail is averaged instead of dropped as a
// nearest-neighbour pick would do. Works on premultiplied RGBA (opaque after
// compositing, so no premultiplication artefacts).
func Resize(src *image.RGBA, dw, dh int) *image.RGBA {
	sw, sh := src.Bounds().Dx(), src.Bounds().Dy()
	if dw <= 0 || dh <= 0 || sw == 0 || sh == 0 {
		return image.NewRGBA(image.Rect(0, 0, max(dw, 0), max(dh, 0)))
	}
	xw := boxWeights(sw, dw)
	yw := boxWeights(sh, dh)

	// Horizontal pass: sh rows × dw columns, float32 RGBA.
	tmp := make([]float32, sh*dw*4)
	for y := 0; y < sh; y++ {
		row := src.Pix[y*src.Stride : y*src.Stride+sw*4]
		for x := 0; x < dw; x++ {
			var r, g, b, a float32
			for _, w := range xw[x] {
				o := w.index * 4
				r += float32(row[o]) * w.w
				g += float32(row[o+1]) * w.w
				b += float32(row[o+2]) * w.w
				a += float32(row[o+3]) * w.w
			}
			o := (y*dw + x) * 4
			tmp[o], tmp[o+1], tmp[o+2], tmp[o+3] = r, g, b, a
		}
	}

	// Vertical pass.
	dst := image.NewRGBA(image.Rect(0, 0, dw, dh))
	for y := 0; y < dh; y++ {
		for x := 0; x < dw; x++ {
			var r, g, b, a float32
			for _, w := range yw[y] {
				o := (w.index*dw + x) * 4
				r += tmp[o] * w.w
				g += tmp[o+1] * w.w
				b += tmp[o+2] * w.w
				a += tmp[o+3] * w.w
			}
			o := y*dst.Stride + x*4
			dst.Pix[o] = clamp8(r)
			dst.Pix[o+1] = clamp8(g)
			dst.Pix[o+2] = clamp8(b)
			dst.Pix[o+3] = clamp8(a)
		}
	}
	return dst
}

func clamp8(v float32) uint8 {
	v += 0.5
	if v < 0 {
		return 0
	}
	if v > 255 {
		return 255
	}
	return uint8(v)
}

// webpDimensions reads width/height from a WebP container (VP8, VP8L, VP8X).
// Returns 0,0 when the header is not recognised.
func webpDimensions(b []byte) (int, int) {
	if len(b) < 30 || string(b[0:4]) != "RIFF" || string(b[8:12]) != "WEBP" {
		return 0, 0
	}
	switch string(b[12:16]) {
	case "VP8 ":
		// Key frame header: 3-byte frame tag, 3-byte start code 9d 01 2a, then 16-bit w/h (14 bits each).
		if len(b) < 30 || b[23] != 0x9d || b[24] != 0x01 || b[25] != 0x2a {
			return 0, 0
		}
		w := int(binary.LittleEndian.Uint16(b[26:28]) & 0x3fff)
		h := int(binary.LittleEndian.Uint16(b[28:30]) & 0x3fff)
		return w, h
	case "VP8L":
		if len(b) < 25 || b[20] != 0x2f {
			return 0, 0
		}
		bits := binary.LittleEndian.Uint32(b[21:25])
		w := int(bits&0x3fff) + 1
		h := int((bits>>14)&0x3fff) + 1
		return w, h
	case "VP8X":
		if len(b) < 30 {
			return 0, 0
		}
		w := int(b[24]) | int(b[25])<<8 | int(b[26])<<16
		h := int(b[27]) | int(b[28])<<8 | int(b[29])<<16
		return w + 1, h + 1
	}
	return 0, 0
}
