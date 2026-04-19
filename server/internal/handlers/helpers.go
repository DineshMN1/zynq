package handlers

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/smtp"
	"strings"
	"time"

	"github.com/zynqcloud/api/internal/config"
)

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]interface{}{
		"statusCode": status,
		"message":    message,
	})
}

// requestOrigin derives the public-facing origin (scheme + host) from the
// incoming request. It honours X-Forwarded-Proto / X-Forwarded-Host set by
// reverse proxies, then falls back to the Host header. The fallbackURL is
// used only when the Host header is empty (e.g. unit tests).
func requestOrigin(r *http.Request, fallbackURL string) string {
	scheme := r.Header.Get("X-Forwarded-Proto")
	if scheme == "" {
		if r.TLS != nil {
			scheme = "https"
		} else {
			scheme = "http"
		}
	}
	host := r.Header.Get("X-Forwarded-Host")
	if host == "" {
		host = r.Host
	}
	if host == "" {
		return strings.TrimRight(fallbackURL, "/")
	}
	return scheme + "://" + host
}

func readJSON(r *http.Request, v interface{}) error {
	// Limit request bodies to 1 MB to prevent memory exhaustion attacks.
	limited := io.LimitReader(r.Body, 1<<20)
	return json.NewDecoder(limited).Decode(v)
}

// dialSMTP connects to the SMTP server. When SMTPSecure is true it
// wraps the connection in TLS immediately (implicit TLS, port 465).
// Otherwise it dials plaintext and relies on smtp.SendMail's automatic
// STARTTLS upgrade (port 587 / 25).
// dialSMTP connects to the SMTP server over implicit TLS (port 465).
func dialSMTP(cfg *config.Config) (*smtp.Client, error) {
	addr := net.JoinHostPort(cfg.SMTPHost, fmt.Sprintf("%d", cfg.SMTPPort))
	tlsCfg := &tls.Config{
		ServerName: cfg.SMTPHost,
		MinVersion: tls.VersionTLS12,
	}

	conn, err := tls.DialWithDialer(&net.Dialer{Timeout: 15 * time.Second}, "tcp", addr, tlsCfg)
	if err != nil {
		return nil, fmt.Errorf("tls dial: %w", err)
	}
	return smtp.NewClient(conn, cfg.SMTPHost)
}

// smtpSend sends a message through the SMTP server described by cfg.
// It handles both implicit TLS (port 465) and STARTTLS (port 587).
func smtpSend(cfg *config.Config, from string, to []string, msg []byte) error {
	if !cfg.SMTPSecure {
		// STARTTLS path — smtp.SendMail handles the upgrade internally.
		addr := net.JoinHostPort(cfg.SMTPHost, fmt.Sprintf("%d", cfg.SMTPPort))
		var auth smtp.Auth
		if cfg.SMTPUser != "" {
			auth = smtp.PlainAuth("", cfg.SMTPUser, cfg.SMTPPass, cfg.SMTPHost)
		}
		return smtp.SendMail(addr, auth, from, to, msg)
	}

	// Implicit TLS path (port 465).
	c, err := dialSMTP(cfg)
	if err != nil {
		return err
	}
	defer c.Close()

	if cfg.SMTPUser != "" {
		auth := smtp.PlainAuth("", cfg.SMTPUser, cfg.SMTPPass, cfg.SMTPHost)
		if err := c.Auth(auth); err != nil {
			return fmt.Errorf("auth: %w", err)
		}
	}
	if err := c.Mail(from); err != nil {
		return fmt.Errorf("mail from: %w", err)
	}
	for _, rcpt := range to {
		if err := c.Rcpt(rcpt); err != nil {
			return fmt.Errorf("rcpt to: %w", err)
		}
	}
	w, err := c.Data()
	if err != nil {
		return fmt.Errorf("data: %w", err)
	}
	if _, err := w.Write(msg); err != nil {
		return fmt.Errorf("write: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("close data: %w", err)
	}
	return c.Quit()
}

// formatStorageBytes formats a byte count as a human-readable string (e.g. "1.5 GB").
func formatStorageBytes(b int64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(b)/float64(div), "KMGTPE"[exp])
}

// likeSafe escapes PostgreSQL LIKE/ILIKE wildcard characters in user-supplied
// search strings so that '%', '_', and '\' are treated as literals.
func likeSafe(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `%`, `\%`)
	s = strings.ReplaceAll(s, `_`, `\_`)
	return "%" + s + "%"
}

// sendEmail sends a plain-text email via the configured SMTP server.
// Intended to be called from a goroutine — logs errors instead of returning them.
func sendEmail(cfg *config.Config, to, subject, body string) {
	msg := fmt.Sprintf(
		"From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n%s",
		cfg.SMTPFrom, to, subject, body,
	)
	if err := smtpSend(cfg, cfg.SMTPFrom, []string{to}, []byte(msg)); err != nil {
		slog.Error("failed to send email", "error", err, "to", to, "subject", subject)
	}
}
