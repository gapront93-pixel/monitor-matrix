#!/usr/bin/env bash
# Deploy monitor-matrix from a build made by GitHub Actions (.github/workflows/deploy.yml). See docs/deploy.md.
#
# The VPS normally never builds: GitHub builds the commit into .next-<sha7> at the same path as here
# (/var/www/monitor-matrix) and streams it as a .tar.gz on stdin. This script fast-forwards the source to
# that commit, unpacks the build next to the live one, runs migrations (with a backup first), points PM2
# at the new build and health-checks it. A failed health check switches straight back to the previous build.
#
# GitHub reaches it through a key in ~deploy/.ssh/authorized_keys forced to run "deploy.sh --ci";
# the commit comes from SSH_ORIGINAL_COMMAND ("deploy <sha>").
#
# Usage, as user deploy (sudo -u deploy -H /var/www/monitor-matrix/scripts/deploy.sh ...):
#   --status    show what is live
#   --rollback  go back to the previous build and commit
#   --local     emergency only (GitHub down): build the committed HEAD here, then switch to it
#   --ci        (GitHub only) deploy the build on stdin
set -Eeuo pipefail

APP_DIR=/var/www/monitor-matrix
APP=monitor-matrix
BRANCH=main
PORT=3003
STATE="$APP_DIR/.deploy"
LOG_DIR=/home/deploy/logs
BACKUP_DIR=/home/deploy/backups/monitor_matrix

[ "$(id -un)" = deploy ] || { echo "Chạy bằng user deploy: sudo -u deploy -H $0 $*" >&2; exit 1; }
cd "$APP_DIR"
mkdir -p "$STATE" "$LOG_DIR"

say() { echo "[$(date '+%F %T')] $*"; }
die() { say "LỖI: $*"; exit 1; }

# State files: current / previous hold a build directory (empty = the legacy .next), *.commit their commit
read_state() { cat "$STATE/$1" 2>/dev/null || true; }
dir_of() { local d; d=$1; echo "${d:-.next}"; }

status() {
  echo "Đang chạy : $(dir_of "$(read_state current)") @ $(read_state current.commit) ($(git log -1 --format='%h %s' 2>/dev/null))"
  echo "Bản trước : $(dir_of "$(read_state previous)") @ $(read_state previous.commit)"
}

# The login page answers 200 and every JS/CSS file it references is served
health_check() {
  local page code f bad=0
  for _ in $(seq 1 30); do
    code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/dang-nhap" || true)
    [ "$code" = 200 ] && break
    sleep 1
  done
  [ "$code" = 200 ] || { say "/dang-nhap trả $code"; return 1; }
  page=$(curl -s "http://127.0.0.1:$PORT/dang-nhap") || return 1
  for f in $(grep -o '/_next/static/[^"\\]*\.\(js\|css\)' <<<"$page" | sort -u); do
    code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT$f" || true)
    [ "$code" = 200 ] || { say "$f trả $code"; bad=1; }
  done
  return $bad
}

# ecosystem.config.cjs reads the build directory from $STATE/current, so the state is written before the restart
switch_to() {
  echo "$1" >"$STATE/current"
  pm2 restart ecosystem.config.cjs --only "$APP" --update-env >/dev/null
  pm2 save >/dev/null
}

# Source and node_modules back to a commit
reset_source() {
  local to=$1 changed=$2
  git reset -q --hard "$to"
  if grep -qE '^package(-lock)?\.json$' <<<"$changed"; then npm ci --no-audit --no-fund >/dev/null; fi
  npx prisma generate >/dev/null || true
}

# Migrations, with a backup first
migrate() {
  grep -q '^prisma/migrations/' <<<"$1" || return 0
  local url dump
  url=$(sed -n 's/^DATABASE_URL="\{0,1\}\([^"?]*\).*/\1/p' .env)
  dump="$BACKUP_DIR/monitor_matrix_db_$(date -u +%Y%m%dT%H%M%SZ)_pre_deploy.dump"
  mkdir -p "$BACKUP_DIR"
  say "Có migration mới: backup DB vào $dump"
  (umask 077; pg_dump -Fc -d "$url" -f "$dump")
  npx prisma migrate deploy
  ls -1t "$BACKUP_DIR"/*_pre_deploy.dump | tail -n +6 | xargs -r rm -f --
}

# Switch to the new build; a failed health check puts back the old build and source
go_live() {
  local next_dir=$1 sha=$2 cur=$3 old=$4 changed=$5
  say "Chuyển $APP sang $next_dir"
  switch_to "$next_dir"
  if ! health_check; then
    say "Health check lỗi, quay lại $cur"
    reset_source "$old" "$changed"
    switch_to "$cur"
    health_check || say "CẢNH BÁO: bản cũ cũng lỗi, kiểm tra pm2 logs $APP"
    grep -q '^prisma/migrations/' <<<"$changed" && say "CẢNH BÁO: migration đã chạy và không được hoàn tác"
    die "Deploy thất bại, site đã quay về bản cũ"
  fi
  local prev_commit
  prev_commit=$(read_state current.commit)
  echo "$cur" >"$STATE/previous"
  echo "${prev_commit:-$old}" >"$STATE/previous.commit"
  echo "$sha" >"$STATE/current.commit"
  # Keep only the live build and the rollback target
  for dir in .next .next-*; do
    if [ -d "$dir" ] && [ "$dir" != "$next_dir" ] && [ "$dir" != "$cur" ]; then rm -rf "$dir"; fi
  done
  say "Xong: $(git log -1 --format='%h %s') đang chạy từ $next_dir"
}

exec 9>"$STATE/lock"
flock -n 9 || die "Đang có một lần deploy khác chạy"

case "${1:-}" in
  --status) status; exit 0 ;;
  --rollback)
    exec > >(tee -a "$LOG_DIR/monitor-matrix-deploy.log") 2>&1
    prev=$(dir_of "$(read_state previous)"); prev_commit=$(read_state previous.commit)
    [ -n "$prev_commit" ] || die "Chưa có bản trước để quay lại"
    [ -d "$prev" ] || die "Không còn thư mục build $prev"
    [ -z "$(git status --porcelain --untracked-files=no)" ] || die "Có file sửa tay trên VPS chưa commit, xử lý trước khi rollback"
    cur=$(dir_of "$(read_state current)"); cur_commit=$(read_state current.commit)
    say "Rollback về $prev @ ${prev_commit:0:7}"
    reset_source "$prev_commit" "$(git diff --name-only "$prev_commit" HEAD)"
    switch_to "$prev"
    health_check || say "CẢNH BÁO: bản trước cũng không qua health check, kiểm tra pm2 logs $APP"
    echo "$prev_commit" >"$STATE/current.commit"
    echo "$cur" >"$STATE/previous"; echo "$cur_commit" >"$STATE/previous.commit"
    say "Đã rollback. Lưu ý: migration DB (nếu có) không được hoàn tác."
    exit 0 ;;
  --local)
    exec > >(tee -a "$LOG_DIR/monitor-matrix-deploy.log") 2>&1
    [ -z "$(git status --porcelain --untracked-files=no)" ] || die "Có file sửa chưa commit. Commit trước rồi chạy lại."
    sha=$(git rev-parse HEAD); next_dir=".next-${sha:0:7}"
    cur=$(dir_of "$(read_state current)")
    [ "$next_dir" != "$cur" ] || die "Bản ${sha:0:7} đang chạy rồi"
    say "Build trên VPS (khẩn cấp): $(git log -1 --format='%h %s')"
    if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then npm ci --no-audit --no-fund; fi
    npx prisma generate >/dev/null
    npm run typecheck
    npm test --silent
    rm -rf "$next_dir"
    NEXT_DIST_DIR="$next_dir" SKIP_BUILD_TYPECHECK=1 NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=900 npm run build
    # Migrations since the live commit (none known: let prisma decide, it skips applied ones)
    live=$(read_state current.commit)
    changed=$([ -n "$live" ] && git diff --name-only "$live" "$sha" || echo prisma/migrations/)
    migrate "$changed"
    go_live "$next_dir" "$sha" "$cur" "$sha" ""
    exit 0 ;;
  --ci) ;;
  *) die "Tham số không hợp lệ: ${1:-(trống)}. Deploy chạy từ GitHub khi push lên $BRANCH; xem docs/deploy.md" ;;
esac

# --- CI deploy: the build arrives on stdin ---
exec > >(tee -a "$LOG_DIR/monitor-matrix-deploy.log") 2>&1
read -r verb sha extra <<<"${SSH_ORIGINAL_COMMAND:-}" || true
[ "$verb" = deploy ] && [[ "$sha" =~ ^[0-9a-f]{40}$ ]] && [ -z "${extra:-}" ] || die "Lệnh không hợp lệ: ${SSH_ORIGINAL_COMMAND:-(trống)}"
next_dir=".next-${sha:0:7}"
cur=$(dir_of "$(read_state current)")
[ "$next_dir" != "$cur" ] || { say "Bản ${sha:0:7} đang chạy rồi"; cat >/dev/null; exit 0; }

# 1. Source: only fast-forward to a commit of origin/main; code edited by hand on the VPS blocks the deploy
[ -z "$(git status --porcelain --untracked-files=no)" ] ||
  die "Có file sửa tay trên VPS chưa commit (git status). Code chỉ sửa ở máy dev rồi push lên GitHub."
git fetch -q origin "$BRANCH"
git merge-base --is-ancestor "$sha" "origin/$BRANCH" || die "Commit ${sha:0:7} không nằm trên origin/$BRANCH"
old=$(git rev-parse HEAD)
git merge-base --is-ancestor "$old" "$sha" || die "Commit ${sha:0:7} không nối tiếp commit đang chạy trên VPS (${old:0:7})"
changed=$(git diff --name-only "$old" "$sha")
say "Deploy $(git log -1 --format='%h %s' "$sha") (từ ${old:0:7})"

# 2. Unpack the build beside the live one; the live build is never touched
incoming="$STATE/incoming"
rm -rf "$incoming"; mkdir -p "$incoming"
tar -xzf - -C "$incoming"
[ -f "$incoming/$next_dir/BUILD_ID" ] || die "Gói build không có $next_dir/BUILD_ID"
rm -rf "$next_dir"
mv "$incoming/$next_dir" "$next_dir"
rm -rf "$incoming"
say "Đã nhận build $next_dir ($(du -sh "$next_dir" | cut -f1))"

# Any failure before the switch puts the source back; the site keeps running the old build
trap 'say "Deploy dừng. Site vẫn chạy bản cũ ($cur). Trả code về ${old:0:7}."; reset_source "$old" "$changed"; rm -rf "$next_dir"' ERR
git merge -q --ff-only "$sha"

# 3. Dependencies (node_modules serve next start and the externals such as exceljs)
if grep -qE '^package(-lock)?\.json$' <<<"$changed"; then
  say "package.json đổi: npm ci"
  npm ci --no-audit --no-fund
fi
npx prisma generate >/dev/null

# 4. Migrations, with a backup first
migrate "$changed"
trap - ERR

# 5. Switch PM2 to the new build, check it, fall back if it is broken
go_live "$next_dir" "$sha" "$cur" "$old" "$changed"
