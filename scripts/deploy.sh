#!/usr/bin/env bash
# Rebuild and restart monitor-matrix on the VPS, as user deploy:
#   sudo -u deploy -H /var/www/monitor-matrix/scripts/deploy.sh
#
# The build goes to .next-build first, so a failed build never touches the running app.
# The 2 GB VPS cannot type-check and build at the same time: tsc runs on its own first.
set -euo pipefail

APP_DIR=/var/www/monitor-matrix
APP=monitor-matrix
PORT=3003
cd "$APP_DIR"
[ "$(id -un)" = deploy ] || { echo "Chạy bằng user deploy: sudo -u deploy -H $0" >&2; exit 1; }

say() { echo "[$(date '+%F %T')] $*"; }

say "1/6 Cài thư viện (chỉ khi package-lock.json đổi)"
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then npm ci --no-audit --no-fund; fi

say "2/6 Prisma: tạo client + chạy migration"
npx prisma generate >/dev/null
npx prisma migrate deploy

say "3/6 Kiểm tra TypeScript + test"
npm run typecheck
npm test --silent

say "4/6 Build vào .next-build"
rm -rf .next-build
NEXT_DIST_DIR=.next-build SKIP_BUILD_TYPECHECK=1 NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=900 npm run build

say "5/6 Thay bản build và khởi động lại PM2"
rm -rf .next-old
[ -d .next ] && mv .next .next-old
mv .next-build .next
if pm2 describe "$APP" >/dev/null 2>&1; then pm2 restart "$APP" --update-env >/dev/null; else pm2 start ecosystem.config.cjs >/dev/null; fi
pm2 save >/dev/null

say "6/6 Kiểm tra app trả lời"
for _ in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/dang-nhap" || true)
  [ "$code" = 200 ] && { say "Xong: app chạy bình thường (HTTP 200)."; rm -rf .next-old; exit 0; }
  sleep 1
done
say "LỖI: app không trả lời. Quay lại bản build trước."
if [ -d .next-old ]; then rm -rf .next && mv .next-old .next && pm2 restart "$APP" >/dev/null; fi
say "Xem log: pm2 logs $APP --lines 50"
exit 1
