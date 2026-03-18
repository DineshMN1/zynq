// cleanup reclaims disk space from abandoned upload sessions.
//
// When a client calls InitUpload but then disconnects (network drop, crash,
// timeout) without calling CompleteUpload or AbortUpload, the session directory
// under .uploads/<sessionID>/ is left on disk indefinitely. At 100k uploads/day
// this accumulates gigabytes of orphaned part files. RunPeriodic removes any
// session directory whose mtime is older than the configured TTL.
package storage

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"time"
)

// CleanupSessions scans uploadsDir and removes subdirectories older than ttl.
// It is safe to call concurrently with active uploads: it only removes directories
// whose mtime pre-dates the cutoff, so in-progress sessions (recently modified) are
// left untouched.
func CleanupSessions(uploadsDir string, ttl time.Duration, logger *slog.Logger) {
	entries, err := os.ReadDir(uploadsDir)
	if err != nil {
		if !os.IsNotExist(err) && !os.IsPermission(err) {
			logger.Warn("cleanup: readdir failed", "dir", uploadsDir, "err", err)
		}
		return
	}

	cutoff := time.Now().Add(-ttl)
	var removed int
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		if info.ModTime().Before(cutoff) {
			dir := filepath.Join(uploadsDir, e.Name())
			age := time.Since(info.ModTime()).Round(time.Minute)
			if err := os.RemoveAll(dir); err != nil {
				logger.Warn("cleanup: remove failed", "session", e.Name(), "err", err)
			} else {
				removed++
				logger.Info("cleanup: removed stale session", "session", e.Name(), "age", age)
			}
		}
	}
	if removed > 0 {
		logger.Info("cleanup: cycle complete", "removed", removed)
	}
}

// RunCleanupPeriodic starts a background goroutine that calls CleanupSessions on every interval
// until ctx is cancelled. A first pass runs immediately at startup to flush
// sessions left over from a previous crash or restart.
//
// The returned channel is closed when the goroutine exits, allowing the caller
// to wait for the cleanup loop to finish before the process terminates.
//
// Recommended values: ttl=24h, interval=1h.
func RunCleanupPeriodic(ctx context.Context, uploadsDir string, ttl, interval time.Duration, logger *slog.Logger) <-chan struct{} {
	done := make(chan struct{})
	go func() {
		defer close(done)

		// Immediate first pass clears sessions from prior runs.
		CleanupSessions(uploadsDir, ttl, logger)

		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				CleanupSessions(uploadsDir, ttl, logger)
			case <-ctx.Done():
				return
			}
		}
	}()
	return done
}
