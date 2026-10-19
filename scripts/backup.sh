#!/usr/bin/env bash
# Nightly backup of monitor-matrix: the database (pg_dump, custom format) and storage/ (product photos, uploaded
# import data). Keeps the newest 14 of each in /home/deploy/backups/monitor_matrix.
# Cron (user deploy): 30 19 * * *  = 02:30 Asia/Ho_Chi_Minh
set -euo pipefail
umask 077

APP=/var/www/monitor-matrix
DEST=/home/deploy/backups/monitor_matrix
KEEP=14
mkdir -p "$DEST"

# DATABASE_URL from the app's .env, without any "?..." suffix
url=$(sed -n 's/^DATABASE_URL="\{0,1\}\([^"?]*\).*/\1/p' "$APP/.env")
[ -n "$url" ] || { echo "DATABASE_URL not found in $APP/.env" >&2; exit 1; }

stamp=$(date -u +%Y%m%dT%H%M%SZ)
db="$DEST/monitor_matrix_db_$stamp.dump"
files="$DEST/monitor_matrix_storage_$stamp.tgz"
/usr/bin/pg_dump -Fc -d "$url" -f "$db.tmp"
mv "$db.tmp" "$db"
tar -czf "$files.tmp" -C "$APP" storage
mv "$files.tmp" "$files"

# Remove everything but the newest $KEEP of each kind
ls -1t "$DEST"/monitor_matrix_db_*.dump | tail -n +$((KEEP + 1)) | xargs -r rm -f --
ls -1t "$DEST"/monitor_matrix_storage_*.tgz | tail -n +$((KEEP + 1)) | xargs -r rm -f --
echo "$(date -u +%FT%TZ) ok $db ($(du -h "$db" | cut -f1)) $files ($(du -h "$files" | cut -f1))"
