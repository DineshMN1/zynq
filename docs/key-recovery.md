# Key Recovery

ZynqCloud encrypts every file with AES-256-GCM using a per-file Data Encryption Key (DEK). Each DEK is wrapped by the `FILE_ENCRYPTION_MASTER_KEY` (the Key Encryption Key, or KEK). This means:

> **If you lose `FILE_ENCRYPTION_MASTER_KEY`, all encrypted files are permanently unreadable — even with a full backup of the database and disk.**

---

## Store the key safely — right now

Before anything else, copy `FILE_ENCRYPTION_MASTER_KEY` from your `.env` into at least two of these:

- A password manager (1Password, Bitwarden, KeePass)
- An encrypted offline backup (USB drive in a safe location)
- A secrets manager if you use one (Vault, AWS Secrets Manager, etc.)

The key looks like:

```text
FILE_ENCRYPTION_MASTER_KEY=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=
```

---

## Startup fingerprint check

On first boot, ZynqCloud stores a SHA-256 fingerprint of the master key in the database. On every subsequent boot it verifies the key matches. If you accidentally change the key, the server **refuses to start** with this error:

```text
FILE_ENCRYPTION_MASTER_KEY has changed since first boot — all previously encrypted files
will be unreadable. Restore the original key or run a key migration before starting.
```

**Resolution:** Restore the original key in `.env` and restart.

---

## Disaster scenarios

### Scenario 1 — Server died, I have a backup

If you ran `./scripts/backup.sh`, the backup directory contains:

```text
backups/
  db-20250419-120000.sql       ← database dump
  files-20250419-120000.tar.gz ← encrypted files
  key-20250419-120000.env      ← FILE_ENCRYPTION_MASTER_KEY
  manifest-20250419-120000.txt
```

Restore using:

```bash
./scripts/restore.sh
```

The `key-*.env` file has the master key. As long as you have it, files are recoverable.

### Scenario 2 — I lost `.env` but have the key written down

1. Recreate `.env` from `.env.example`
2. Set all variables, including `FILE_ENCRYPTION_MASTER_KEY` to the saved value
3. Start the stack — the fingerprint check will pass because the key matches what's in the database

### Scenario 3 — I lost `.env` and never saved the key

**Files are not recoverable.** The key is not stored anywhere in the database or on disk in a recoverable form. Start a fresh instance and accept the data loss.

This is why storing the key separately is critical before the first upload.

---

## Moving to a new server

1. Run `./scripts/backup.sh` on the old server
2. Copy the backup directory to the new server
3. Clone the repo and copy your `.env` (including the key) to the new server
4. Run `./scripts/restore.sh`
5. Verify files are accessible before decommissioning the old server
