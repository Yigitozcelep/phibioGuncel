package media

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"
	"testing"
)

func gradientPNG(t *testing.T, w, h int, alpha bool) []byte {
	t.Helper()
	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			a := uint8(255)
			if alpha {
				a = 0 // fully transparent: should become white
			}
			img.Set(x, y, color.NRGBA{R: uint8(x * 255 / w), G: uint8(y * 255 / h), B: 128, A: a})
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func TestProcessPNGVariants(t *testing.T) {
	data := gradientPNG(t, 2400, 1350, false)
	res, err := Process(data)
	if err != nil {
		t.Fatal(err)
	}
	if res.Mime != "image/png" || res.Ext != "png" || res.Width != 2400 || res.Height != 1350 {
		t.Fatalf("meta: %+v", res)
	}
	large, err := jpeg.Decode(bytes.NewReader(res.Large))
	if err != nil {
		t.Fatalf("large is not a valid JPEG: %v", err)
	}
	if large.Bounds().Dx() != 1200 || large.Bounds().Dy() != 675 {
		t.Fatalf("large dims %v", large.Bounds())
	}
	thumb, err := jpeg.Decode(bytes.NewReader(res.Thumb))
	if err != nil {
		t.Fatalf("thumb is not a valid JPEG: %v", err)
	}
	if thumb.Bounds().Dx() != 400 || thumb.Bounds().Dy() != 225 {
		t.Fatalf("thumb dims %v", thumb.Bounds())
	}

	dir := t.TempDir()
	names, err := res.Save(dir, "0123456789abcdef")
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"0123456789abcdef.png", "0123456789abcdef_w1200.jpg", "0123456789abcdef_w400.jpg"} {
		if _, err := os.Stat(filepath.Join(dir, want)); err != nil {
			t.Fatalf("missing %s", want)
		}
		if !FileNamePattern.MatchString(want) {
			t.Fatalf("pattern rejects %s", want)
		}
	}
	if len(names) != 3 {
		t.Fatalf("names %v", names)
	}
	if err := RemoveFiles(dir, names); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(dir, "0123456789abcdef.png")); err == nil {
		t.Fatal("file not removed")
	}
}

func TestSmallImageIsNotUpscaled(t *testing.T) {
	data := gradientPNG(t, 300, 200, false)
	res, err := Process(data)
	if err != nil {
		t.Fatal(err)
	}
	for _, v := range [][]byte{res.Large, res.Thumb} {
		img, err := jpeg.Decode(bytes.NewReader(v))
		if err != nil {
			t.Fatal(err)
		}
		if img.Bounds().Dx() != 300 || img.Bounds().Dy() != 200 {
			t.Fatalf("variant should keep 300x200, got %v", img.Bounds())
		}
	}
}

func TestTransparentPNGCompositedOverWhite(t *testing.T) {
	res, err := Process(gradientPNG(t, 800, 400, true))
	if err != nil {
		t.Fatal(err)
	}
	img, err := jpeg.Decode(bytes.NewReader(res.Thumb))
	if err != nil {
		t.Fatal(err)
	}
	r, g, b, _ := img.At(10, 10).RGBA()
	if r>>8 < 250 || g>>8 < 250 || b>>8 < 250 {
		t.Fatalf("expected white, got %d %d %d", r>>8, g>>8, b>>8)
	}
}

func TestResizeAveragesArea(t *testing.T) {
	// 4x4 checkerboard of black/white; downscale to 1x1 should give mid grey.
	src := image.NewRGBA(image.Rect(0, 0, 4, 4))
	for y := 0; y < 4; y++ {
		for x := 0; x < 4; x++ {
			v := uint8(0)
			if (x+y)%2 == 0 {
				v = 255
			}
			src.Set(x, y, color.RGBA{v, v, v, 255})
		}
	}
	dst := Resize(src, 1, 1)
	r, _, _, a := dst.At(0, 0).RGBA()
	if r>>8 < 126 || r>>8 > 129 || a>>8 != 255 {
		t.Fatalf("expected ~127 grey, got %d (alpha %d)", r>>8, a>>8)
	}
	// Non-integer ratio: 10 -> 3 must cover all source columns.
	ws := boxWeights(10, 3)
	if len(ws) != 3 || ws[2][len(ws[2])-1].index != 9 || ws[0][0].index != 0 {
		t.Fatalf("weights do not cover the source: %v", ws)
	}
	for _, col := range ws {
		var sum float32
		for _, w := range col {
			sum += w.w
		}
		if sum < 0.999 || sum > 1.001 {
			t.Fatalf("weights not normalised: %v", col)
		}
	}
}

func TestRejectsNonImages(t *testing.T) {
	if _, err := Process([]byte("<html><body>hello</body></html>")); err == nil {
		t.Fatal("html accepted")
	}
	if _, err := Process([]byte{}); err == nil {
		t.Fatal("empty accepted")
	}
	// Valid PNG signature but garbage body → decode error.
	bad := append([]byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a}, bytes.Repeat([]byte{0}, 64)...)
	if _, err := Process(bad); err == nil {
		t.Fatal("corrupt png accepted")
	}
}

func TestWebPDimensions(t *testing.T) {
	// Minimal VP8L header: RIFF....WEBPVP8L <size> 0x2f then 14-bit w-1, h-1.
	b := make([]byte, 30)
	copy(b[0:4], "RIFF")
	copy(b[8:12], "WEBP")
	copy(b[12:16], "VP8L")
	b[20] = 0x2f
	w, h := 1200, 675
	bits := uint32(w-1) | uint32(h-1)<<14
	b[21] = byte(bits)
	b[22] = byte(bits >> 8)
	b[23] = byte(bits >> 16)
	b[24] = byte(bits >> 24)
	gw, gh := webpDimensions(b)
	if gw != w || gh != h {
		t.Fatalf("got %dx%d", gw, gh)
	}
	if gw, gh := webpDimensions([]byte("nope")); gw != 0 || gh != 0 {
		t.Fatal("garbage should give 0,0")
	}
}

func TestFileNamePattern(t *testing.T) {
	good := []string{"0123456789abcdef.jpg", "0123456789abcdef_w400.jpg", "0123456789abcdef.webp"}
	bad := []string{"../etc/passwd", "0123456789abcdef.exe", "0123456789ABCDEF.jpg", "0123456789abcdef_w800.jpg", "x.jpg", ""}
	for _, g := range good {
		if !FileNamePattern.MatchString(g) {
			t.Errorf("rejected %q", g)
		}
	}
	for _, b := range bad {
		if FileNamePattern.MatchString(b) {
			t.Errorf("accepted %q", b)
		}
	}
	if ContentTypeFor("a.webp") != "image/webp" || ContentTypeFor("a.jpg") != "image/jpeg" {
		t.Fatal("content type mapping wrong")
	}
}
