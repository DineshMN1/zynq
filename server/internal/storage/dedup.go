package storage

import (
	"crypto/sha256"
	"encoding/hex"
	"path/filepath"
	"strings"
)

// hashableExtensions lists file extensions that qualify for content-addressable
// deduplication via SHA-256 hashing.
//
// Rationale: these are document and structured-text formats where exact binary
// matches are common (team-shared PDFs, exported CSVs, config files). Computing
// a SHA-256 over these files is cheap relative to the I/O cost saved when a
// dedup hit is detected.
//
// Images, video, audio, archives and executables are intentionally excluded —
// they are typically unique per upload and are often large, making hashing
// expensive with near-zero dedup benefit.
var hashableExtensions = map[string]bool{
	// Standard Text & Data
	".txt": true, ".csv": true, ".md": true, ".rtf": true, ".log": true,
	// Microsoft Office
	".doc": true, ".docx": true, ".xls": true, ".xlsx": true, ".ppt": true, ".pptx": true,
	// OpenDocument
	".odt": true, ".ods": true, ".odp": true,
	// Print & Web / Structured data
	".pdf": true, ".html": true, ".htm": true, ".xml": true, ".json": true,
}

// ShouldDedup reports whether a file with the given name should go through the
// SHA-256 deduplication path. The check is purely extension-based and reads no
// bytes, so it can be called before or after the body is available.
func ShouldDedup(fileName string) bool {
	ext := strings.ToLower(filepath.Ext(fileName))
	return hashableExtensions[ext]
}

// HashBytes returns the hex-encoded SHA-256 digest of data.
// It is cheap to call — the entire hash is computed in a single pass
// over an already-in-memory slice.
func HashBytes(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}
