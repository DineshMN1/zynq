package storage

import (
	"bytes"
	"io"
	"os"
	"path/filepath"
	"testing"
)

func tempBackend(t *testing.T) *Local {
	t.Helper()
	dir := t.TempDir()
	b, err := NewLocal(dir)
	if err != nil {
		t.Fatalf("NewLocal: %v", err)
	}
	return b
}

func TestLocal_WriteRead(t *testing.T) {
	b := tempBackend(t)
	content := []byte("ZynqCloud encrypted file content")

	n, err := b.Write("test/file.bin", bytes.NewReader(content))
	if err != nil {
		t.Fatalf("Write: %v", err)
	}
	if n != int64(len(content)) {
		t.Errorf("Write returned %d bytes, want %d", n, len(content))
	}

	rc, size, err := b.Read("test/file.bin")
	if err != nil {
		t.Fatalf("Read: %v", err)
	}
	defer rc.Close()

	if size != int64(len(content)) {
		t.Errorf("Read size %d, want %d", size, len(content))
	}
	got, _ := io.ReadAll(rc)
	if !bytes.Equal(got, content) {
		t.Errorf("Read content mismatch: got %q, want %q", got, content)
	}
}

func TestLocal_Exists(t *testing.T) {
	b := tempBackend(t)

	exists, err := b.Exists("nonexistent.bin")
	if err != nil {
		t.Fatalf("Exists (nonexistent): %v", err)
	}
	if exists {
		t.Error("expected false for nonexistent file")
	}

	b.Write("present.bin", bytes.NewReader([]byte("hi"))) //nolint:errcheck
	exists, err = b.Exists("present.bin")
	if err != nil {
		t.Fatalf("Exists (present): %v", err)
	}
	if !exists {
		t.Error("expected true for existing file")
	}
}

func TestLocal_Delete(t *testing.T) {
	b := tempBackend(t)
	b.Write("todelete.bin", bytes.NewReader([]byte("delete me"))) //nolint:errcheck

	if err := b.Delete("todelete.bin"); err != nil {
		t.Fatalf("Delete: %v", err)
	}

	// Second delete should be silent (not an error).
	if err := b.Delete("todelete.bin"); err != nil {
		t.Errorf("Delete (already deleted) should not error: %v", err)
	}
}

func TestLocal_WriteAtomic(t *testing.T) {
	b := tempBackend(t)

	// Write the same path twice — second write must overwrite cleanly.
	b.Write("atomic.bin", bytes.NewReader([]byte("first")))  //nolint:errcheck
	b.Write("atomic.bin", bytes.NewReader([]byte("second"))) //nolint:errcheck

	rc, _, _ := b.Read("atomic.bin")
	defer rc.Close()
	got, _ := io.ReadAll(rc)
	if string(got) != "second" {
		t.Errorf("expected second write to win, got %q", got)
	}
}

func TestLocal_PathTraversal(t *testing.T) {
	b := tempBackend(t)

	// Attempting to write outside root must fail.
	_, err := b.Write("../../etc/passwd", bytes.NewReader([]byte("bad")))
	if err == nil {
		t.Error("expected error for path traversal attempt")
	}
}

func TestLocal_DiskStats(t *testing.T) {
	b := tempBackend(t)
	avail, total := b.DiskStats()

	// On any supported platform, total should be > 0.
	// On unsupported platforms, both are 0 — that is also acceptable.
	if avail > total && total > 0 {
		t.Errorf("avail (%d) > total (%d): impossible disk stats", avail, total)
	}
}

func TestLocal_SetDiskStatsPath(t *testing.T) {
	b := tempBackend(t)
	b.SetDiskStatsPath(t.TempDir())
	// Just verify it doesn't panic and returns consistent values.
	avail, total := b.DiskStats()
	if avail > total && total > 0 {
		t.Errorf("avail (%d) > total (%d) with override path", avail, total)
	}
}

func TestLocal_MkdirAll(t *testing.T) {
	b := tempBackend(t)
	if err := b.MkdirAll("a/b/c"); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	// Verify the directory exists under root.
	info, err := os.Stat(filepath.Join(b.Root(), "a/b/c"))
	if err != nil {
		t.Fatalf("Stat after MkdirAll: %v", err)
	}
	if !info.IsDir() {
		t.Error("expected directory, got file")
	}
}
