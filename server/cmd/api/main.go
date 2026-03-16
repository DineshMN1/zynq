package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/zynqcloud/api/internal/config"
	"github.com/zynqcloud/api/internal/crypto"
	"github.com/zynqcloud/api/internal/database"
	"github.com/zynqcloud/api/internal/handlers"
	mw "github.com/zynqcloud/api/internal/middleware"
	"github.com/zynqcloud/api/internal/storage"
)

func main() {
	// Load config
	cfg := config.Load()

	// Set up structured logger
	logLevel := slog.LevelInfo
	if cfg.NodeEnv == "development" {
		logLevel = slog.LevelDebug
	}
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: logLevel})))

	slog.Info("starting ZynqCloud API", "port", cfg.Port, "env", cfg.NodeEnv)

	// Connect to database
	db, err := database.Connect(cfg)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	slog.Info("database connected")

	// Verify schema is reachable (migrations run via postgres.Dockerfile init scripts)
	if err := db.Raw("SELECT 1 FROM users LIMIT 1").Error; err != nil {
		slog.Error("schema check failed — ensure migrations have run", "error", err)
		os.Exit(1)
	}
	slog.Info("schema verified")

	// Initialize crypto (may be nil if not configured — upload/download will 503)
	var cryptoSvc *crypto.Crypto
	if cfg.FileEncryptionMasterKey != "" {
		cryptoSvc, err = crypto.New(cfg.FileEncryptionMasterKey)
		if err != nil {
			slog.Error("failed to initialize crypto", "error", err)
			os.Exit(1)
		}
		slog.Info("crypto initialized")
	} else {
		slog.Warn("FILE_ENCRYPTION_MASTER_KEY not set — file upload/download disabled")
	}

	// Initialize storage backend
	localBackend, err := storage.NewLocal(cfg.StoragePath)
	if err != nil {
		slog.Error("failed to initialize storage backend", "error", err)
		os.Exit(1)
	}
	slog.Info("storage backend initialized", "path", cfg.StoragePath)

	// Start cleanup goroutine for stale uploads
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	uploadsDir := cfg.StoragePath + "/.uploads"
	storage.RunCleanupPeriodic(ctx, uploadsDir, 24*time.Hour, time.Hour, slog.Default())

	// Build router
	r := chi.NewRouter()

	// Global middleware
	r.Use(chimw.Recoverer)
	r.Use(mw.Logger)
	r.Use(mw.CORS(cfg.CORSOrigins))

	// Initialize handlers
	authH := handlers.NewAuthHandler(db, cfg)
	filesH := handlers.NewFilesHandler(db, cfg, cryptoSvc, localBackend)
	usersH := handlers.NewUsersHandler(db)
	settingsH := handlers.NewSettingsHandler(db, cfg)
	invitationsH := handlers.NewInvitationsHandler(db, cfg)
	storageStatsH := handlers.NewStorageStatsHandler(localBackend, db)
	shareH := handlers.NewShareHandler(db, cfg, cryptoSvc, localBackend)

	authMiddleware := mw.Auth(cfg.JWTSecret)
	adminMiddleware := mw.RequireRole("admin")
	adminOrOwnerMiddleware := mw.RequireRole("admin", "owner")

	r.Route("/api/v1", func(r chi.Router) {
		// Health
		r.Get("/health", handlers.HealthHandler)

		// Auth routes
		r.Route("/auth", func(r chi.Router) {
			r.Get("/setup-status", authH.SetupStatus)
			r.Post("/register", authH.Register)
			r.Post("/login", authH.Login)
			r.Post("/logout", authH.Logout)
			r.Post("/forgot-password", authH.ForgotPassword)
			r.Post("/reset-password", authH.ResetPassword)

			// Protected auth routes
			r.Group(func(r chi.Router) {
				r.Use(authMiddleware)
				r.Get("/me", authH.Me)
				r.Patch("/profile", authH.UpdateProfile)
				r.Post("/change-password", authH.ChangePassword)
			})
		})

		// Public share routes (no auth required)
		r.Route("/shares", func(r chi.Router) {
			r.Get("/{token}", shareH.GetByToken)
			r.Post("/{token}/download", shareH.Download)
		})

		// Public share routes (new format for publicApi)
		r.Route("/public/share", func(r chi.Router) {
			r.Get("/{token}", shareH.GetPublicShare)
			r.Get("/{token}/download", shareH.DownloadPublicShare)
		})

		// Invite validation/accept (no auth required)
		r.Get("/invites/validate/{token}", invitationsH.Validate)
		r.Post("/invites/accept", invitationsH.Accept)

		// System routes (no auth for update-check)
		r.Get("/system/update-check", handlers.SystemUpdateCheck)

		// Protected routes
		r.Group(func(r chi.Router) {
			r.Use(authMiddleware)

			// Files
			r.Route("/files", func(r chi.Router) {
				r.Get("/", filesH.List)
				r.Post("/", filesH.Create)
				r.Get("/trash", filesH.Trash)
				r.Delete("/trash/empty", filesH.EmptyTrash)
				r.Get("/shared", filesH.SharedWithMe)
				r.Get("/public-shares", filesH.MyPublicShares)
				r.Get("/private-shares", filesH.MyPrivateShares)
				r.Delete("/shares/{shareId}", filesH.RevokeShare)
				r.Patch("/shares/{shareId}/public-settings", filesH.UpdatePublicShare)
				r.Delete("/bulk", filesH.BulkDelete)
				r.Post("/check-duplicate", filesH.CheckDuplicate)

				r.Get("/{id}", filesH.GetByID)
				r.Patch("/{id}", filesH.Rename)
				r.Put("/{id}/upload", filesH.Upload)
				r.Get("/{id}/download", filesH.Download)
				r.Delete("/{id}", filesH.Delete)
				r.Post("/{id}/restore", filesH.Restore)
				r.Delete("/{id}/permanent", filesH.PermanentDelete)
				r.Post("/{id}/share", filesH.ShareFile)
			})

			// Settings
			r.Route("/settings", func(r chi.Router) {
				r.Get("/", settingsH.GetUserSettings)
				r.Patch("/", settingsH.UpdateUserSettings)
				r.Put("/", settingsH.UpdateUserSettings)

				r.Group(func(r chi.Router) {
					r.Use(adminMiddleware)
					r.Get("/global", settingsH.GetGlobalSettings)
					r.Patch("/global", settingsH.UpdateGlobalSettings)
					r.Get("/smtp", settingsH.GetSMTPSettings)
					r.Put("/smtp", settingsH.UpdateSMTPSettings)
					r.Post("/smtp/test", settingsH.TestSMTPConnection)
				})
			})

			// Storage
			r.Get("/storage/overview", storageStatsH.Overview)
			r.Route("/storage/users", func(r chi.Router) {
				r.Use(adminMiddleware)
				r.Get("/", storageStatsH.GetAllUsersStorage)
				r.Get("/{userId}", storageStatsH.GetUserStorage)
				r.Patch("/{userId}/quota", storageStatsH.UpdateUserQuota)
			})

			// System (protected)
			r.With(adminMiddleware).Post("/system/update", handlers.SystemUpdate)

			// Users (admin only except self-access)
			r.Route("/users", func(r chi.Router) {
				r.Get("/shareable", usersH.ListShareable)
				r.Get("/{id}", usersH.GetByID)
				r.Delete("/{id}", usersH.Delete)
			})

			// Admin users routes
			r.Route("/admin/users", func(r chi.Router) {
				r.Use(adminMiddleware)
				r.Get("/", usersH.List)
				r.Put("/{id}", usersH.Update)
				r.Delete("/{id}", usersH.Delete)
			})

			// Invitations (admin/owner only)
			r.Route("/invites", func(r chi.Router) {
				r.Use(adminOrOwnerMiddleware)
				r.Post("/", invitationsH.Create)
				r.Get("/", invitationsH.List)
				r.Post("/{id}/revoke", invitationsH.Revoke)
			})
		})
	})

	// Serve React SPA from /app/client/build if the directory exists.
	// All non-API routes fall back to index.html so client-side routing works.
	staticDir := cfg.StaticDir
	if staticDir != "" {
		fs := http.FileServer(http.Dir(staticDir))
		r.Get("/*", func(w http.ResponseWriter, req *http.Request) {
			path := filepath.Join(staticDir, req.URL.Path)
			if _, err := os.Stat(path); os.IsNotExist(err) {
				http.ServeFile(w, req, filepath.Join(staticDir, "index.html"))
				return
			}
			fs.ServeHTTP(w, req)
		})
		slog.Info("serving static files", "dir", staticDir)
	}

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  60 * time.Second,
		WriteTimeout: 3600 * time.Second, // large file downloads can take time
		IdleTimeout:  120 * time.Second,
	}

	// Start server in goroutine
	go func() {
		slog.Info("listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down server...")
	cancel() // stop cleanup goroutine

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("server forced to shutdown", "error", err)
	}

	slog.Info("server exited")
}
