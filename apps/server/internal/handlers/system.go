package handlers

import (
	"net/http"
	"runtime/debug"
)

// GET /api/v1/system/update-check
func SystemUpdateCheck(w http.ResponseWriter, r *http.Request) {
	version := "unknown"
	if info, ok := debug.ReadBuildInfo(); ok {
		version = info.Main.Version
		if version == "" || version == "(devel)" {
			version = "dev"
		}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"version":   version,
		"latest":    nil,
		"hasUpdate": false,
	})
}

// POST /api/v1/system/update
func SystemUpdate(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]bool{"started": false})
}
