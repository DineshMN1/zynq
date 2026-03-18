//go:build windows

package storage

import "golang.org/x/sys/windows"

// diskStats returns the available and total bytes on the filesystem that
// contains path on Windows, using GetDiskFreeSpaceEx.
func diskStats(path string) (avail, total uint64) {
	var freeBytesAvailable, totalBytes, totalFreeBytes uint64
	pathPtr, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return 0, 0
	}
	if err := windows.GetDiskFreeSpaceEx(pathPtr, &freeBytesAvailable, &totalBytes, &totalFreeBytes); err != nil {
		return 0, 0
	}
	return freeBytesAvailable, totalBytes
}
