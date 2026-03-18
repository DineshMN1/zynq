#!/bin/sh
# Fix ownership of bind-mounted data directory so the app user can write.
chown -R app:app /data/files 2>/dev/null || true
exec su-exec app "$@"
