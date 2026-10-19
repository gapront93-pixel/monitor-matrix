# Môi trường dev trên máy Windows

Code được sửa và chạy thử trên máy bạn (dev). VPS chỉ chạy production và chỉ nhận code đã push lên GitHub (xem [deploy.md](deploy.md)).

## Cài một lần

1. **Git for Windows**: https://git-scm.com/download/win
2. **Node.js 24 LTS**: https://nodejs.org (đúng bản VPS đang chạy, xem `.nvmrc`)
3. **Docker Desktop**: https://www.docker.com/products/docker-desktop (để chạy PostgreSQL local)
4. **GitHub CLI** (để `npm run ship` theo dõi deploy): `winget install GitHub.cli`, mở lại terminal, `gh auth login`
5. **SSH key cho GitHub** (bỏ qua nếu máy đã clone được vnpromotion):
   ```powershell
   ssh-keygen -t ed25519 -C "may-dev"
   Get-Content ~/.ssh/id_ed25519.pub
   ```
   Dán nội dung vào GitHub → Settings → SSH and GPG keys → New SSH key.

## Lấy code và chạy lần đầu

```powershell
git clone git@github.com:gapront93-pixel/monitor-matrix.git
cd monitor-matrix
npm ci

# Database local (chạy nền, dữ liệu giữ lại giữa các lần tắt máy)
docker compose -f docker-compose.dev.yml up -d

# File cấu hình local
Copy-Item .env.example .env
```

Mở `.env`, sửa:

```
DATABASE_URL="postgresql://monitor:monitor@127.0.0.1:5434/monitor_matrix_dev?schema=public"
SESSION_SECRET=<dán chuỗi từ lệnh: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
ADMIN_EMAIL=ban@gigabyte.vn
ADMIN_NAME=Tên bạn
ADMIN_PASSWORD=<mật khẩu dev>
```

Rồi:

```powershell
npm run db:generate              # tạo Prisma client
npm run db:deploy                # tạo bảng trong DB local
npm run seed                     # nạp dữ liệu mẫu từ data/
npm run user -- bootstrap        # tạo Admin từ ADMIN_EMAIL / ADMIN_PASSWORD
npm run dev                      # mở http://localhost:3003
```

Doanh số LCD (`SALES_DATABASE_URL`) không có ở local: trang đó báo không kết nối được, các trang khác chạy bình thường.

## Mỗi ngày

```powershell
git pull                         # lấy code mới nhất
npm run dev                      # sửa code, xem ở http://localhost:3003
npm run typecheck; npm test      # nên chạy trước khi ship
npm run ship -- "Mô tả thay đổi"  # commit + push + chờ GitHub deploy xong
```

Sau `git pull`, nếu có migration mới (thư mục `prisma/migrations/` đổi) thì chạy `npm run db:deploy`; `package-lock.json` đổi thì `npm ci`.

## Đổi database (Prisma)

1. Sửa `prisma/schema.prisma`.
2. `npx prisma migrate dev --name ten-thay-doi` tạo migration trong `prisma/migrations/` và áp vào DB local.
3. Commit cả schema lẫn migration. Khi deploy, VPS tự backup DB rồi chạy migration.

Rollback không hoàn tác migration, nên ưu tiên thay đổi chỉ **thêm** (thêm cột có giá trị mặc định, thêm bảng). Xoá hay đổi tên cột: làm hai lần deploy (bỏ dùng trong code trước, xoá cột sau).
