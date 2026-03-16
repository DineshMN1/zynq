//go:build darwin

package storage

import "syscall"

// diskStats returns the available and total bytes on the filesystem that
// contains path for macOS.
func diskStats(path string) (avail, total uint64) {
	var st syscall.Statfs_t
	if err := syscall.Statfs(path, &st); err != nil {
		return 0, 0
	}

	bsize := uint64(st.Bsize)
	return uint64(st.Bavail) * bsize, uint64(st.Blocks) * bsize
}
