// Package storage — Content Addressable Storage (CAS)
//
// Blobs are stored at:
//
//	{root}/blobs/{sha256[0:2]}/{sha256[2:4]}/{sha256}
//
// Deduplication guarantee: only one goroutine may write a new blob for a given
// sha256 at a time. A sync.Map of per-hash mutexes (one entry per active hash)
// provides O(1) lock acquisition without serialising writes to different hashes.
//
// Concurrent uploads of the same file:
//  1. Both goroutines stream to separate temp files while hashing.
//  2. The first to acquire the hash lock checks os.Stat → not found → renames
//     temp → blob path.  Dedup miss; IsNew = true.
//  3. The second acquires the lock, checks os.Stat → found → removes its temp
//     file.  Dedup hit; IsNew = false.
//
// This means the first concurrent duplicate incurs a disk write; all subsequent
// duplicates are zero-disk-write dedup hits.

package storage

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
)

// CAS is a content-addressable blob store backed by the local filesystem.
type CAS struct {
	root string
	mu   sync.Map // map[string]*hashEntry — one entry per sha256 hash currently being written
}

// hashEntry pairs a mutex with a reference count for the per-hash lock pool.
// When refs drops to zero the entry is removed from the sync.Map to prevent
// unbounded memory growth over the lifetime of the process.
type hashEntry struct {
	mu   sync.Mutex
	refs int32
}

// NewCAS creates a CAS rooted at root, creating the directory if needed.
func NewCAS(root string) (*CAS, error) {
	if err := os.MkdirAll(root, 0o750); err != nil {
		return nil, fmt.Errorf("create CAS root %q: %w", root, err)
	}
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return nil, fmt.Errorf("resolve CAS root: %w", err)
	}
	return &CAS{root: absRoot}, nil
}

// PutResult is returned by CAS.Put.
type PutResult struct {
	SHA256   string // hex-encoded SHA-256 of the blob
	Size     int64  // total bytes received from the caller
	IsNew    bool   // true = new blob written; false = dedup hit (no disk write)
	BlobPath string // relative blob path: "blobs/{ab}/{cd}/{sha256}"
}

// Put streams r through a SHA-256 hasher and either stores a new blob or
// returns a dedup hit if an identical blob already exists.
//
// The entire reader is always consumed — this is required to produce the
// correct hash and to not leave the connection in an undefined state.
//
// Put is safe to call from multiple goroutines with the same or different data.
func (c *CAS) Put(r io.Reader) (PutResult, error) {
	// ── Phase 1: stream to a random temp file while hashing ──────────────────
	tmpDir := filepath.Join(c.root, ".tmp")
	if err := os.MkdirAll(tmpDir, 0o750); err != nil {
		return PutResult{}, fmt.Errorf("cas: mkdir tmp: %w", err)
	}

	tmp, err := os.CreateTemp(tmpDir, ".cas-*")
	if err != nil {
		return PutResult{}, fmt.Errorf("cas: create tmp: %w", err)
	}
	tmpPath := tmp.Name()

	hasher := sha256.New()
	buf := make([]byte, 512*1024) // 512 KB — matches local.go for consistent syscall overhead
	n, werr := io.CopyBuffer(tmp, io.TeeReader(r, hasher), buf)
	cerr := tmp.Close()

	if werr != nil {
		os.Remove(tmpPath) //nolint:errcheck
		return PutResult{}, fmt.Errorf("cas: stream: %w", werr)
	}
	if cerr != nil {
		os.Remove(tmpPath) //nolint:errcheck
		return PutResult{}, fmt.Errorf("cas: flush: %w", cerr)
	}

	sha256hex := hex.EncodeToString(hasher.Sum(nil))
	blobRel := filepath.Join("blobs", sha256hex[0:2], sha256hex[2:4], sha256hex)
	blobAbs := filepath.Join(c.root, blobRel)

	// ── Phase 2: acquire hash-level lock, check + commit ─────────────────────
	unlock := c.lockHash(sha256hex)
	defer unlock()

	if _, statErr := os.Stat(blobAbs); statErr == nil {
		// Dedup hit — blob already exists; discard the temp file.
		os.Remove(tmpPath) //nolint:errcheck
		return PutResult{SHA256: sha256hex, Size: n, IsNew: false, BlobPath: blobRel}, nil
	} else if !os.IsNotExist(statErr) {
		// Unexpected error (permission denied, I/O error) — surface it.
		os.Remove(tmpPath) //nolint:errcheck
		return PutResult{}, fmt.Errorf("cas: stat blob: %w", statErr)
	}

	// New blob — move temp file into its canonical location.
	if err := os.MkdirAll(filepath.Dir(blobAbs), 0o750); err != nil {
		os.Remove(tmpPath) //nolint:errcheck
		return PutResult{}, fmt.Errorf("cas: mkdir blob dir: %w", err)
	}
	if err := os.Chmod(tmpPath, 0o440); err != nil { // blobs are read-only
		os.Remove(tmpPath) //nolint:errcheck
		return PutResult{}, fmt.Errorf("cas: chmod: %w", err)
	}
	if err := os.Rename(tmpPath, blobAbs); err != nil {
		os.Remove(tmpPath) //nolint:errcheck
		return PutResult{}, fmt.Errorf("cas: rename: %w", err)
	}

	return PutResult{SHA256: sha256hex, Size: n, IsNew: true, BlobPath: blobRel}, nil
}

// isValidSHA256Hex reports whether s is exactly 64 lowercase hex digits.
func isValidSHA256Hex(s string) bool {
	if len(s) != 64 {
		return false
	}
	_, err := hex.DecodeString(s)
	return err == nil
}

// Exists reports whether a blob with the given sha256 hex string is stored.
func (c *CAS) Exists(sha256hex string) bool {
	if !isValidSHA256Hex(sha256hex) {
		return false
	}
	blobAbs := filepath.Join(c.root, "blobs", sha256hex[0:2], sha256hex[2:4], sha256hex)
	_, err := os.Stat(blobAbs)
	return err == nil
}

// Read opens a blob for streaming. Caller must close the returned ReadCloser.
func (c *CAS) Read(sha256hex string) (io.ReadCloser, int64, error) {
	if !isValidSHA256Hex(sha256hex) {
		return nil, 0, fmt.Errorf("cas: invalid sha256 hex %q", sha256hex)
	}
	blobAbs := filepath.Join(c.root, "blobs", sha256hex[0:2], sha256hex[2:4], sha256hex)
	f, err := os.Open(blobAbs)
	if err != nil {
		return nil, 0, err
	}
	info, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, 0, err
	}
	return f, info.Size(), nil
}

// lockHash acquires a per-hash mutex and returns an unlock function.
// Entries are reference-counted and removed from the sync.Map when refs reaches
// zero, preventing unbounded memory growth over the life of the process.
func (c *CAS) lockHash(sha256hex string) (unlock func()) {
	// Atomically get or create the entry and increment its refcount before
	// locking so the entry is never deleted while another goroutine holds it.
	v, _ := c.mu.LoadOrStore(sha256hex, &hashEntry{})
	e := v.(*hashEntry)
	atomic.AddInt32(&e.refs, 1)
	e.mu.Lock()
	return func() {
		e.mu.Unlock()
		if atomic.AddInt32(&e.refs, -1) == 0 {
			c.mu.CompareAndDelete(sha256hex, e)
		}
	}
}
