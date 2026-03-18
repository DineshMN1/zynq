#!/bin/sh
# Fix ownership of bind-mounted data directory so the app user can write.
if ! chown -R app:app /data/files; then
  echo "ERROR: chown -R app:app /data/files failed (exit $?). Check volume permissions." >&2
  exit 1
fi
exec su-exec app "$@"
