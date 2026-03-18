package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port                    string
	DatabaseURL             string
	DatabaseHost            string
	DatabasePort            string
	DatabaseUser            string
	DatabasePassword        string
	DatabaseName            string
	JWTSecret               string
	JWTExpiresIn            string // "7d" default
	CookieDomain            string
	CORSOrigins             []string
	FrontendURL             string
	FileEncryptionMasterKey string // base64-encoded 32 bytes
	StoragePath             string
	EmailEnabled            bool
	SMTPHost                string
	SMTPPort                int
	SMTPSecure              bool
	SMTPUser                string
	SMTPPass                string
	SMTPFrom                string
	InviteTokenTTLHours     int
	PublicRegistration      bool
	RateLimitTTL            int
	RateLimitMax            int
	TrustProxy              bool
	MaxConcurrentUploads    int
	MaxAssemblyWorkers      int
	SessionTTLHours         int
	MinFreeBytes            int64
	DiskStatsPath           string // override path for disk stats (useful in Docker to point at a host mount)
	StaticDir               string // directory to serve the React SPA from (empty = disabled)
	NodeEnv                 string
}

func Load() *Config {
	corsOrigins := []string{}
	corsStr := getEnv("CORS_ORIGIN", getEnv("FRONTEND_URL", ""))
	for _, o := range strings.Split(corsStr, ",") {
		o = strings.TrimSpace(o)
		if o != "" {
			corsOrigins = append(corsOrigins, o)
		}
	}

	dbURL := getEnv("DATABASE_URL", "")
	if dbURL == "" {
		host := getEnv("DATABASE_HOST", "localhost")
		port := getEnv("DATABASE_PORT", "5432")
		user := getEnv("DATABASE_USER", "zynqcloud")
		pass := getEnv("DATABASE_PASSWORD", "")
		name := getEnv("DATABASE_NAME", "zynqcloud")
		dbURL = "postgresql://" + user + ":" + pass + "@" + host + ":" + port + "/" + name + "?sslmode=disable"
	}

	return &Config{
		Port:                    getEnv("PORT", "4000"),
		DatabaseURL:             dbURL,
		DatabaseHost:            getEnv("DATABASE_HOST", "localhost"),
		DatabasePort:            getEnv("DATABASE_PORT", "5432"),
		DatabaseUser:            getEnv("DATABASE_USER", "zynqcloud"),
		DatabasePassword:        getEnv("DATABASE_PASSWORD", ""),
		DatabaseName:            getEnv("DATABASE_NAME", "zynqcloud"),
		JWTSecret:               getEnv("JWT_SECRET", ""),
		JWTExpiresIn:            getEnv("JWT_EXPIRES_IN", "7d"),
		CookieDomain:            getEnv("COOKIE_DOMAIN", ""),
		CORSOrigins:             corsOrigins,
		FrontendURL:             getEnv("FRONTEND_URL", "http://localhost:3000"),
		FileEncryptionMasterKey: getEnv("FILE_ENCRYPTION_MASTER_KEY", ""),
		StoragePath:             getEnv("FILE_STORAGE_PATH", getEnv("STORAGE_PATH", "/data/files")),
		EmailEnabled:            getEnv("EMAIL_ENABLED", "false") == "true",
		SMTPHost:                getEnv("SMTP_HOST", ""),
		SMTPPort:                getEnvInt("SMTP_PORT", 587),
		SMTPSecure:              getEnv("SMTP_SECURE", "false") == "true",
		SMTPUser:                getEnv("SMTP_USER", ""),
		SMTPPass:                getEnv("SMTP_PASS", ""),
		SMTPFrom:                getEnv("SMTP_FROM", ""),
		InviteTokenTTLHours:     getEnvInt("INVITE_TOKEN_TTL_HOURS", 72),
		PublicRegistration:      getEnv("PUBLIC_REGISTRATION", "false") == "true",
		RateLimitTTL:            getEnvInt("RATE_LIMIT_TTL", 60000),
		RateLimitMax:            getEnvInt("RATE_LIMIT_MAX", 100),
		TrustProxy:              getEnv("TRUST_PROXY", "false") == "true",
		MaxConcurrentUploads:    getEnvInt("MAX_CONCURRENT_UPLOADS", 256),
		MaxAssemblyWorkers:      getEnvInt("MAX_ASSEMBLY_WORKERS", 32),
		SessionTTLHours:         getEnvInt("SESSION_TTL_HOURS", 24),
		MinFreeBytes:            getEnvInt64("MIN_FREE_BYTES", 536870912),
		DiskStatsPath:           getEnv("DISK_STATS_PATH", ""),
		StaticDir:               getEnv("STATIC_DIR", ""),
		NodeEnv:                 getEnv("NODE_ENV", "development"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

func getEnvInt64(key string, fallback int64) int64 {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			return n
		}
	}
	return fallback
}
