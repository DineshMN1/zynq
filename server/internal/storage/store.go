package storage

import "io"

// Backend abstracts the file storage medium.
// Swap Local for an S3Compatible implementation without touching handler code.
type Backend interface {
	// Write streams r to path, returning bytes written.
	// Implementations must be atomic: either the full write succeeds or nothing is persisted.
	Write(path string, r io.Reader) (int64, error)

	// Read opens path for streaming. Caller must close the returned ReadCloser.
	Read(path string) (rc io.ReadCloser, size int64, err error)

	// Delete removes path. Silently succeeds if path does not exist.
	Delete(path string) error

	// Exists reports whether path exists in the backend.
	Exists(path string) (bool, error)

	// Rename moves src to dst atomically where the backend allows.
	Rename(src, dst string) error

	// MkdirAll creates path and all parents (no-op for object stores).
	MkdirAll(path string) error
}
