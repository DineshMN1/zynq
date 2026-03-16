//go:build linux

package storage

import "syscall"

// diskStats returns the available and total bytes on the filesystem that
// contains path. Uses Bavail (blocks available to unprivileged processes)
// rather than Bfree (root-reserved blocks included) so we report the space
// that the storage service — running as non-root — can actually use.
func diskStats(path string) (avail, total uint64) {
	var st syscall.Statfs_t
	if err := syscall.Statfs(path, &st); err != nil {
		return 0, 0
	}
	// Many filesystems (e.g., overlayfs, mergerfs) report a large Optimal Transfer Size
	// in Bsize, while Frsize is the actual fragment allocation unit.
	// We check Frsize first to prevent over-reporting available space by orders of magnitude.
	// We also explicitly cast to uint64 to avoid integer overflow on 32-bit ARM devices.
	var bsize uint64
	// In Go, Frsize is an int64 on modern Linux platforms.
	if st.Frsize > 0 {
		bsize = uint64(st.Frsize)
	} else {
		bsize = uint64(st.Bsize)
	}

	return uint64(st.Bavail) * bsize, uint64(st.Blocks) * bsize
}
