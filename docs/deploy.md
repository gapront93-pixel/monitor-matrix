# Deploy lên production (VPS)

```
Máy dev ──npm run ship──▶ GitHub (nhánh main) ──GitHub Actions: kiểm tra + build──▶ VPS (scripts/deploy.sh --ci)
```

- Code chỉ sửa ở máy dev ([dev-setup.md](dev-setup.md)). **Không sửa code trực tiếp trên VPS**: deploy.sh sẽ từ chối chạy khi thấy file sửa tay chưa commit.
- VPS **không build**: GitHub build rồi gửi bản build sang. VPS chỉ có 2GB RAM chung cho mọi app.
- `.env`, `storage/` (ảnh, dữ liệu import) và DB production chỉ nằm trên VPS, không có trong git.

## Deploy: một lệnh

Ở máy dev, PowerShell trong thư mục project:

```powershell
npm run ship -- "Mô tả thay đổi"
```

Lệnh này commit mọi thay đổi, push lên GitHub, rồi chờ đến khi xong: `✅ Đã lên production: ...` hoặc `❌ ...` kèm lỗi (site vẫn chạy bản cũ). Đã tự commit rồi thì chỉ cần `npm run ship`.

Push bằng `git push` thường cũng deploy y như vậy, chỉ là terminal không chờ báo kết quả. Xem ở tab **Actions** của repo.

## Các bước GitHub làm (`.github/workflows/deploy.yml`)

1. Chép code vào `/var/www/monitor-matrix` trên máy GitHub (cùng đường dẫn với VPS để bản build chạy được nguyên trạng).
2. `npm ci`, `prisma generate`, kiểm tra TypeScript, lint, test. Lỗi thì dừng, VPS không bị đụng tới.
3. Build vào `.next-<7 ký tự commit>`, nén lại.
4. SSH vào VPS bằng user `deploy` với key chỉ được phép chạy `deploy.sh --ci`, gửi gói build qua.

## Các bước VPS làm (`scripts/deploy.sh --ci`)

1. Dừng nếu có code sửa tay chưa commit, hoặc đang có lần deploy khác chạy.
2. Chỉ nhận commit nằm trên `origin/main` và nối tiếp bản đang chạy (fast-forward).
3. Giải nén bản build cạnh bản đang chạy. Cập nhật code; `package-lock.json` đổi thì `npm ci`. Luôn `prisma generate`.
4. Có migration mới thì backup DB vào `/home/deploy/backups/monitor_matrix/*_pre_deploy.dump` (giữ 5 bản) rồi `prisma migrate deploy`.
5. Ghi bản build mới vào `.deploy/current` (PM2 đọc qua `ecosystem.config.cjs`), restart `monitor-matrix`, kiểm tra `/login` và mọi file JS/CSS của nó phải trả 200. Lỗi thì **tự quay về bản cũ**.
6. `pm2 save`, xoá các bản build cũ, chỉ giữ bản đang chạy và bản trước.

Mỗi lần deploy, site gián đoạn vài giây lúc restart.

## Lệnh khác (trên VPS)

| Lệnh | Việc |
| --- | --- |
| `sudo -u deploy -H /var/www/monitor-matrix/scripts/deploy.sh --status` | Đang chạy commit nào, bản trước là gì |
| `sudo -u deploy -H /var/www/monitor-matrix/scripts/deploy.sh --rollback` | Quay lại bản build và commit trước, gần như tức thì |
| `sudo -u deploy -H /var/www/monitor-matrix/scripts/deploy.sh --local` | Khẩn cấp khi GitHub lỗi: build commit đang có trên VPS (tốn ~750MB RAM) |
| Tab Actions trên GitHub → lần chạy → **Re-run jobs** | Deploy lại một commit |

Log mọi lần deploy: `/home/deploy/logs/monitor-matrix-deploy.log`.

## Lưu ý

- GitHub gọi `deploy.sh` đang có trên VPS (bản của commit **đang chạy**). Sửa deploy.sh thì bản sửa có tác dụng từ lần deploy sau.
- Nếu bị dừng vì "file sửa tay trên VPS": xem `git status` và `git diff` trên VPS. Đưa thay đổi đó về máy dev, commit và push, rồi trên VPS chạy `git checkout -- .` và Re-run trên GitHub.
- Secret trên GitHub (Settings → Secrets and variables → Actions): `VPS_DEPLOY_KEY` (private key) và `VPS_KNOWN_HOSTS` (host key của VPS). Public key tương ứng nằm trong `/home/deploy/.ssh/authorized_keys`, bị giới hạn bằng `command="/var/www/monitor-matrix/scripts/deploy.sh --ci",restrict`.
- Sau deploy, nên mở trang qua domain thật: Cloudflare có thể cache nhầm file CSS 404 (purge ở Caching → Purge → Custom URL).
