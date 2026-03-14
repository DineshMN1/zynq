ZynqCloud Codebase Review
I've read the core source files across all three layers. Here's the structured review. Per your instructions, I'll go section by section and pause for your input before moving on.

Section 1: Architecture Review
1.1 — Dual Storage Paths (Critical)
Problem: There are two separate storage implementations that both write to /data/files:

Path A: NestJS StorageService (storage.service.ts:91-170) — writes AES-256-GCM encrypted .enc files directly to the local filesystem.
Path B: The Go go-storage service (upload.go:48-160) — a separate HTTP service with its own upload/CAS/dedup logic.
From reading the NestJS code, it never makes HTTP calls to the Go service — it writes to disk directly. The Go service appears to be a standalone service not integrated into the NestJS upload flow.

This means:

Files uploaded via NestJS are AES-256-GCM encrypted by NestJS, then written to disk.
The Go service's CAS/dedup is a parallel system — if it's ever called (e.g. by a future direct-upload feature), those files would be unencrypted at the Go layer, since Go knows nothing about the master key or DEK scheme.
The Go service's dedup (ShouldDedup) and the NestJS dedup (shouldCheckDuplicates) have different extension/MIME lists — they will make different dedup decisions for the same file.
Options:

Option A: Keep both, document clearly Option B: Remove Go service entirely Option C: Integrate Go as the storage backend for NestJS (Go stores encrypted blobs, NestJS orchestrates)
Effort Low Low-medium (remove docker compose entry, files) High
Risk Confusion persists; encryption gap if Go is ever wired in Loses Go CAS dedup Requires NestJS to send encrypted data to Go over HTTP
Impact Low Medium — simpler architecture High — clean separation
Maintenance Grows over time Shrinks Higher initially
My recommendation: Option B unless there's a roadmap plan for the Go service as a direct-upload path. A dead service adds maintenance surface and creates security risk if someone mistakenly wires it in without encryption. If the Go service is intentional for future use, it needs a design doc and the encryption concern needs to be resolved before integration.

→ What's the intended role of the Go storage service? Is it actively used or experimental?

1.2 — Role Drift via JWT (Security)
Problem: The JWT payload includes the user's role (auth.service.ts:137). If an admin is downgraded to a regular user in the DB, their existing JWT still carries the old role until expiry. There is no token revocation mechanism.

Options:

Option A: Short JWT TTL (15 min) + refresh tokens Option B: DB lookup on each request Option C: Token blocklist on role change
Effort Medium Low Medium
Risk Session UX changes Adds DB call per request Blocklist must be persisted
Impact Forces refresh token infra Minor perf hit Handles only role changes
My recommendation: Option B is simplest and correct for a self-hosted app — add a middleware that reloads the user from DB on role-sensitive endpoints (admin actions). Token TTL is probably already short enough for most use cases, but I'd want to see what it's set to.

→ What's your current JWT TTL? Are you concerned about the role drift window?

1.3 — No Storage Replication / Single Point of Failure
Problem: All files live on a single local filesystem. There's no backup strategy in the code or compose files.

Options:

Option A: Document as user responsibility (BYOB) Option B: Add S3/object storage backend option Option C: Add volume backup cron to compose
Effort Minimal High Low
Risk Data loss for users who don't back up Significant refactor Users still need to configure
My recommendation: For a self-hosted product, Option A is fine initially — but add a CONTRIBUTING.md or SECURITY.md note with a backup recommendation. Option B is the right long-term path.

→ Is S3/object storage on the roadmap?

Section 1 complete. Please give me your thoughts on these three architecture issues before I proceed to Section 2 (Code Quality).
Quick-fire observations for later sections (previewing):
Code quality — will detail in Section 2:

as any casting in auth.service.ts:238,296 to set password_hash — bypasses type system
resolveStorageTarget(file) called twice in getDecryptedFileContent (file.service.ts:691,694)
bulkSoftDelete saves files one-by-one in a loop (N DB writes) — should batch
emptyTrash deletes one-by-one in a loop (N DB deletes) — should batch
downloadFileStream loads the whole file into memory despite being called "stream"
streamFolderZip loads all decrypted file contents into memory before zipping — OOM risk on large folders
getFolderEntries is unbounded recursive — deep nesting can stackoverflow
Testing — will detail in Section 3:

forgotPassword, resetPassword, changePassword, updateProfile have zero tests in auth.service.spec.ts
The dedup "upload anyway" / linked-metadata path has very thin test coverage
No E2E test suite found
Performance — will detail in Section 4:

loadRelationCountAndMap spawns 3 extra queries per findAll call
getSharedWithMe and getPrivateSharesByUser have no pagination
What's your take on the architecture findings above?
