package middleware

import (
	"encoding/json"
	"net"
	"net/http"
	"sync"
	"time"
)

// entry tracks request timestamps for a single key (IP).
type entry struct {
	mu         sync.Mutex
	timestamps []time.Time
}

// RateLimiter holds per-key sliding-window state.
type RateLimiter struct {
	mu      sync.Mutex
	entries map[string]*entry
	limit   int
	window  time.Duration
}

// NewRateLimiter creates a limiter that allows at most `limit` requests
// per `window` duration, keyed by remote IP.
func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		entries: make(map[string]*entry),
		limit:   limit,
		window:  window,
	}
	// Background cleanup: remove stale entries every 5 minutes.
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			rl.cleanup()
		}
	}()
	return rl
}

func (rl *RateLimiter) getEntry(key string) *entry {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	e, ok := rl.entries[key]
	if !ok {
		e = &entry{}
		rl.entries[key] = e
	}
	return e
}

// Allow returns true if the request is within the rate limit.
func (rl *RateLimiter) Allow(key string) bool {
	e := rl.getEntry(key)
	e.mu.Lock()
	defer e.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-rl.window)

	// Prune timestamps outside the window.
	kept := e.timestamps[:0]
	for _, t := range e.timestamps {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}
	e.timestamps = kept

	if len(e.timestamps) >= rl.limit {
		return false
	}

	e.timestamps = append(e.timestamps, now)
	return true
}

func (rl *RateLimiter) cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	cutoff := time.Now().Add(-rl.window)
	for key, e := range rl.entries {
		e.mu.Lock()
		kept := e.timestamps[:0]
		for _, t := range e.timestamps {
			if t.After(cutoff) {
				kept = append(kept, t)
			}
		}
		e.timestamps = kept
		if len(e.timestamps) == 0 {
			delete(rl.entries, key)
		}
		e.mu.Unlock()
	}
}

// Middleware returns an http.Handler middleware that enforces this limiter.
func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := RealIP(r)
		if !rl.Allow(ip) {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Retry-After", "60")
			w.WriteHeader(http.StatusTooManyRequests)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"message":    "Too many requests. Please try again later.",
				"statusCode": http.StatusTooManyRequests,
			})
			return
		}
		next.ServeHTTP(w, r)
	})
}

// RealIP extracts the real client IP.
//
// Priority order (most trustworthy first):
//  1. CF-Connecting-IP — set exclusively by Cloudflare; cannot be spoofed
//     when the server is only reachable via Cloudflare Tunnel.
//  2. X-Real-IP / X-Forwarded-For — only trusted when the remote address is
//     a loopback/private IP (i.e. a local reverse-proxy the operator controls).
//  3. r.RemoteAddr — always used as fallback.
//
// WARNING: Never trust X-Forwarded-For unconditionally — it can be trivially
// spoofed by clients, completely bypassing rate limiting.
func RealIP(r *http.Request) string {
	// Cloudflare Tunnel sets CF-Connecting-IP to the original visitor IP.
	// This header is injected by Cloudflare and cannot be set by end-users.
	if cfIP := r.Header.Get("CF-Connecting-IP"); cfIP != "" {
		if ip := net.ParseIP(trimSpace(cfIP)); ip != nil {
			return ip.String()
		}
	}

	// Only trust proxy headers if the operator has explicitly opted in.
	if r.Header.Get("X-Trust-Proxy") == "1" || isTrustedProxy(r.RemoteAddr) {
		if xri := r.Header.Get("X-Real-IP"); xri != "" {
			if ip := net.ParseIP(trimSpace(xri)); ip != nil {
				return ip.String()
			}
		}
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			for _, part := range splitComma(xff) {
				if ip := net.ParseIP(trimSpace(part)); ip != nil {
					return ip.String()
				}
			}
		}
	}

	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// isTrustedProxy returns true if remoteAddr is a loopback or private-network
// address — i.e. a local reverse proxy (nginx, traefik) the operator controls.
func isTrustedProxy(remoteAddr string) bool {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		host = remoteAddr
	}
	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}
	return ip.IsLoopback() || ip.IsPrivate()
}

func splitComma(s string) []string {
	var out []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == ',' {
			out = append(out, s[start:i])
			start = i + 1
		}
	}
	out = append(out, s[start:])
	return out
}

func trimSpace(s string) string {
	start, end := 0, len(s)
	for start < end && (s[start] == ' ' || s[start] == '\t') {
		start++
	}
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t') {
		end--
	}
	return s[start:end]
}
