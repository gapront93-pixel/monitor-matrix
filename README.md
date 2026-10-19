# GIGABYTE Monitor Matrix

Công cụ nội bộ cho team Marketing GIGABYTE Việt Nam: tra cứu thông số các màn hình GIGABYTE đang bán (List LCD GBT + SO Model 2026), so sánh với đối thủ ASUS, MSI, Samsung, LG, AOC, ViewSonic theo 11 phân khúc, xem số đo review (kèm link nguồn), theo dõi giá tại các đại lý Việt Nam theo thời gian và xem doanh số LCD.

- Địa chỉ: **https://monitor.vnpromotion.com**
- Mỗi người đăng nhập bằng **tài khoản riêng** (email + mật khẩu) do Admin tạo. Có 3 vai trò: **Admin**, **Mod**, **Viewer** (xem mục 3).

| Trang | Dùng để |
|---|---|
| `/` Tổng quan | Số liệu nhanh + 11 phân khúc với nhãn kết luận |
| `/san-pham` | Ma trận các mẫu đang bán, bộ lọc (lưu trên URL), chọn 2–4 mẫu để so sánh |
| `/san-pham/<mã>` | Thông số đầy đủ, giá theo đại lý + biểu đồ lịch sử giá, so với đối thủ, benchmark |
| `/bang-gia` | Bảng giá theo đại lý, xem giá ngày cũ, xuất Excel |
| `/so-sanh?m=mã1,mã2` | So sánh 2–4 mẫu (cả đối thủ), tô giá trị tốt nhất |
| `/doi-thu` | GIGABYTE so với đối thủ theo từng phân khúc |
| `/doanh-so` | Doanh số LCD (sell-in) lấy từ dữ liệu vnpromotion, chỉ Mod và Admin xem được (mục 2c) |
| `/nhap-khau` | Import Data - LCD: số liệu nhập khẩu màn hình vào Việt Nam 2024–2026, chỉ Mod và Admin xem được (mục 2e) |
| `/admin` | Tải file giá, quản lý đại lý, sửa kết luận phân khúc |

**Giao diện và ngôn ngữ:** hai nút ở góc phải trên. Nút chữ A để đổi **Tiếng Việt / English**. Nút mặt trời để chọn giao diện **Tối / Sáng / Theo máy**. Lựa chọn được lưu trên trình duyệt của từng người. Ở chế độ English, các nhãn và menu chuyển sang tiếng Anh. Nội dung dữ liệu (kết luận phân khúc, trích dẫn review, tên phân khúc) vẫn giữ như bản gốc.

---

## 1. Cập nhật giá mới

Mọi việc làm trên web, không cần vào VPS.

1. Đăng nhập bằng tài khoản **Mod** hoặc **Admin**, mở **https://monitor.vnpromotion.com/admin**.
2. Tab **Cập nhật giá** → kéo thả file vào ô, hoặc bấm **Chọn file**.
3. Xem trước: app so file với giá hiện tại và liệt kê **Tăng giá** (đỏ), **Giảm giá** (xanh), **Mới**, **Đổi tình trạng**, **Bỏ niêm yết**, **Lỗi**. Lúc này chưa có gì được lưu.
4. Bấm **Áp dụng (n)**. Giá mới hiện ngay ở mọi trang; ngày giá mới xuất hiện trong ô "Ngày giá" ở Bảng giá, và biểu đồ lịch sử giá có thêm một điểm.
5. Lỡ tải nhầm? Ở mục **Lần tải lên gần đây**, bấm **Huỷ lần này**. Bảng giá quay về lần cập nhật trước.

### Ba định dạng file được nhận

**a) CSV theo dòng** (dễ nhất khi gõ tay hoặc copy từ Excel). Cột bắt buộc: `model, dealer, price, status`. Có thể thêm `url, note`.

```csv
model,dealer,price,status,url,note
MO27Q28G,GEARVN,16490000,ok,https://gearvn.com/products/...,
MO27Q28G,Thế Giới Di Động,15690000,oos,,
G27Q20,Nguyễn Công PC,,contact,,
```

- `model`: mã mẫu (`MO27Q28G`, `AORUS-FO32U2P`) hoặc tên mẫu (`AORUS FO32U2P`).
- `dealer`: tên đại lý hoặc mã đại lý (xem tab Đại lý).
- `price`: số, có hoặc không có dấu phẩy (`16490000` hay `16,490,000`). Để trống chỉ khi status là `contact`.
- `status`: `ok` (còn hàng) · `oos` (hết hàng) · `contact` (liên hệ).

**b) CSV bảng giá** (mỗi đại lý một cột, giống `data/bang-gia.csv`). Cách nhanh nhất: bấm nút **Bảng giá hiện tại (.csv)** để tải bảng đang có, sửa trong Excel, rồi tải lên lại. Ô trống = đại lý không bán; ô ghi `Liên hệ` = liên hệ; `10090000 (Hết hàng)` = hết hàng.

**c) JSON theo đại lý** (giống các file trong `data/prices/`). Nếu file có `retailer_id` chưa tồn tại, đại lý đó được tự thêm vào cuối danh sách.

Cả ba loại đều có **file mẫu** để tải ngay trong trang Quản trị.

### Hai lưu ý quan trọng

- **Một file = toàn bộ bảng giá của các đại lý có trong file.** Mẫu nào đại lý từng bán mà không có trong file sẽ bị coi là "bỏ niêm yết". Nếu file chỉ để sửa vài giá, tick **"Giữ giá cũ của các mẫu không có trong file"** (khi có giá sắp bị bỏ, màn hình xem trước cũng hiện nút này).
- **Ngày giá:** để trống thì app lấy ngày ghi trong file (trường `fetched` của JSON), không có thì lấy hôm nay. Nếu bạn nhập giá của một ngày cũ, hãy chọn ngày đó.

### Quy tắc giá trên toàn app

- **Giá thấp nhất** = giá thấp nhất của đại lý **bán lẻ** còn bán. Không tính giá **sỉ** (như Lê Phụng), không tính "hết hàng" / "ngừng kinh doanh" / "hàng sắp về".
- **Số nơi còn hàng** = số đại lý lẻ còn bán / số đại lý đang niêm yết.
- Tình trạng đọc từ ghi chú: có chữ "Hết hàng", "Tạm hết hàng", "Ngừng kinh doanh" hoặc "sắp về" → gạch ngang. Không có giá → "Liên hệ".

### Dòng giá chưa khớp mẫu

Tin đăng của đại lý không khớp mẫu nào (mẫu cũ như FI27Q, hoặc tên viết khác) không bị mất: chúng nằm ở mục **Dòng giá chưa khớp mẫu**.

- Chọn đúng mẫu rồi bấm **Gắn**: giá hiện ngay trên bảng giá, và các lần tải lên sau tự khớp.
- Mẫu không thuộc danh mục thì bấm **Bỏ qua**.

---

## 2. Thêm hoặc sửa đại lý

Trang **Quản trị → tab Đại lý** (Mod hoặc Admin). Mọi thay đổi được lưu ngay.

- **Thêm đại lý** → nhập tên + website → Lưu. App báo lại **mã** đại lý (ví dụ `cuahangabc`); dùng tên hoặc mã này trong cột `dealer` của file giá.
- **Thứ tự cột** trong Bảng giá = thứ tự trong danh sách; đổi bằng nút ▲ ▼.
- **Trọng điểm**: tên đại lý hiện màu xanh dương ở Bảng giá.
- **Loại giá Lẻ / Sỉ**: giá sỉ hiện in nghiêng và không tính vào giá thấp nhất.
- **Hiện cột**: tắt để ẩn đại lý khỏi Bảng giá mà vẫn giữ lịch sử.
- **Xoá** (chỉ Admin): chỉ xoá được đại lý chưa có giá nào trong lịch sử. Đại lý đã có giá thì tắt "Hiện cột" thay vì xoá.

Nhãn **Dẫn đầu / Ngang / Yếu hơn** và đoạn kết luận của từng phân khúc sửa ở tab **Phân khúc**.

---

## 2b. Ảnh sản phẩm

Menu **Quản lý → Ảnh sản phẩm** (Mod hoặc Admin).

- **Lấy ảnh tự động:** bấm **Bắt đầu lấy ảnh**. App mở trang sản phẩm của các đại lý đang bán mẫu đó, theo thứ tự ưu tiên Thế Giới Di Động, Điện Máy Xanh, FPTShop, GEARVN, HaCom…, rồi lấy ảnh đại diện.
  - Ảnh chỉ được nhận khi tiêu đề trang có đúng mã mẫu, nên không bị lấy nhầm ảnh mẫu khác hay logo của shop.
  - Mất khoảng 1–3 phút cho toàn bộ danh mục.
  - Mẫu chưa có đại lý nào bán thì không lấy tự động được.
- **Tải ảnh lên:** kéo thả nhiều ảnh cùng lúc, **đặt tên file theo mã mẫu**: `MO27Q28G.jpg`, `AORUS-FO32U2P.png`, `G34WQCP-rev-20.webp`. Tên kiểu `MO27Q28G (1).jpg` cũng được nhận.
  - App tự gắn đúng mẫu, tự thu nhỏ (tối đa 1200px) và nén sang WebP.
  - Ảnh nền trắng là đẹp nhất. Mỗi ảnh tối đa 7.5MB.
  - Muốn đổi ảnh cho một mẫu thì bấm **Đổi** trên thẻ của mẫu đó.
- **Ảnh chính hãng GIGABYTE:** gigabyte.com và aorus.com chặn truy cập từ máy chủ, nên app không tự lấy ảnh từ hãng được. Ảnh tự động là ảnh đại diện trên trang đại lý (thường cũng là ảnh render của hãng).
  - Nếu một trang đại lý có nhúng ảnh từ `static.gigabyte.com`, app sẽ ưu tiên ảnh đó và ghi "Ảnh chính hãng". Hiện chưa đại lý nào làm vậy.
  - Muốn dùng đúng ảnh trên gigabyte.com, dùng **Dán link ảnh** (bên dưới) hoặc tải ảnh về máy rồi kéo thả lên.
  - Đánh dấu **Lấy lại cả ảnh tự động cũ** để lấy lại ảnh cho các mẫu đang có ảnh tự động.
- **Ảnh đối thủ:** đánh dấu **Thử cả mẫu đối thủ**. App thử trang của hãng trước (link "Trang hãng" của mẫu: ROG/ASUS, Samsung, Dell…), rồi mới đến trang đại lý.
  - MSI và LG (bản US) chặn máy chủ, nên các mẫu này chỉ lấy được từ đại lý hoặc bằng dán link.
  - Hiện dữ liệu chưa có mẫu ViewSonic hay AOC. Khi thêm các mẫu này, cách lấy ảnh cũng giống như trên.
- **Dán link ảnh:** ô **Dán link ảnh**, mỗi dòng một mẫu, dạng `MÃ-MẪU https://link-ảnh` (ví dụ `MO27Q28G https://static.gigabyte.com/...png`). Cũng có thể bấm nút link trên thẻ của từng mẫu. Đây là cách nhanh nhất để dùng ảnh từ gigabyte.com: mở ảnh trên trình duyệt, chuột phải chọn **Sao chép địa chỉ hình ảnh**, rồi dán vào.
- Ảnh bạn **tự tải lên hoặc dán link không bao giờ bị thay** bởi lần lấy tự động sau.
- Ảnh nằm trong `/var/www/monitor-matrix/storage/images`, không bị ảnh hưởng khi deploy. Nên sao lưu thư mục này cùng với database.

## 2c. Doanh số LCD

Menu **Tra cứu → Doanh số LCD** (chỉ Mod và Admin). Trang này hiển thị số liệu sell-in màn hình GIGABYTE (dòng `cat = LCD`) lấy từ database của vnpromotion (`/var/www/myproject`). Monitor Matrix **chỉ đọc**, không bao giờ sửa dữ liệu doanh số. Số liệu mới có sau tối đa 1 giờ.

- **Khoảng thời gian:** một ô chọn giống dashboard vnpromotion: Tháng này, Tháng trước, Quý này, **Quý trước** (mặc định), Năm nay, Năm trước, Tuỳ chọn (từ tháng… đến tháng…). Lọc thêm theo NPP (VSC, DGW, TLC).
- Các phần trên trang:
  - Số chiếc, doanh thu, giá sell-in trung bình, so với kỳ ngay trước (cùng số tháng).
  - Biểu đồ gộp theo tháng: cột = doanh thu (trục trái), đường = số lượng (trục phải).
  - Bảng **NPP và tỉ trọng**, bảng **Segment và tỉ trọng** (segment theo cột segment của file doanh số), có % số lượng và % doanh thu.
  - Bảng **SO Model** (mã đã gộp giữa các NPP), bấm mũi tên để xem mã gốc theo từng NPP; có link sang trang sản phẩm và so với giá lẻ thấp nhất hôm nay.
  - Phân bổ theo kích thước và tấm nền, top khách hàng.
- Số liệu là **số thuần**: đã trừ hàng trả về. Mã bán ra được tự khớp với các mẫu trong catalog. Mã không ghi revision (ví dụ `G34WQCP`) được tính vào bản mới nhất. Dòng cuối bảng Top mẫu cho biết bao nhiêu chiếc chưa khớp được.
- **Kết nối:** biến `SALES_DATABASE_URL` trong `.env`, dùng role PostgreSQL `monitor_reader`.
  - Role này chỉ có quyền `SELECT` trên bảng `"SaleRow"` của `vnpromotion_db`, luôn ở chế độ read-only và tối đa 4 kết nối.
  - Nếu vnpromotion **tạo lại** bảng `SaleRow` (ví dụ do migration xoá rồi tạo lại bảng), quyền sẽ mất và trang báo lỗi. Khi đó, chạy lại lệnh:

```bash
sudo -u postgres psql -d vnpromotion_db -c 'GRANT SELECT ON "SaleRow" TO monitor_reader;'
```

---

## 2d. Danh sách mẫu và đối thủ (lineup 2026)

Danh sách hiện trên web nằm trong file `data/lineup-2026.json`:
- **Mẫu GIGABYTE:** các mẫu trong **List LCD GBT (1).xlsx** cộng với các **SO Model** có bán LCD từ 01/2026 (dashboard vnpromotion). Hiện có 53 mẫu, gồm 6 mẫu mới: FO27Q54G, MO27Q54G, G25F30T, G27Q24, G27Q24T, GS25F16.
  - Riêng FO27Q54G có thông số đầy đủ, lấy theo TFTCentral vì GIGABYTE chưa đăng trang chính thức.
  - 5 mẫu còn lại mới có thông số cơ bản theo file: kích thước, độ phân giải, tấm nền, tần số quét, MSDP/MSRP.
- **11 phân khúc** chia theo nhóm của file (Light Gaming, FHD, QHD, OLED), tách tiếp theo kích thước, tấm nền và tần số quét.
- **Đối thủ:** mỗi phân khúc chọn tối đa 1 mẫu của mỗi hãng ASUS, MSI, Samsung, LG, AOC, ViewSonic.
  - Mẫu được chọn là mẫu nhập khẩu nhiều nhất năm 2026 theo file *LCD IMPORT DATA* (sheet RAW 2026).
  - Thông số lấy từ trang chính hãng.
  - Samsung không có trong dữ liệu nhập khẩu, nên chọn mẫu Odyssey tương ứng trên samsung.com/vn.
- **Mẫu ngoài danh sách được ẩn, không bị xoá:** dữ liệu, ảnh và lịch sử giá vẫn còn. Đường dẫn cũ báo "không còn trong danh mục".
- Nhãn và kết luận của các phân khúc đã được xoá khi đổi đối thủ. Admin đặt lại ở **Quản trị → Phân khúc**.

Đổi danh sách: sửa `data/lineup-2026.json`, rồi chạy:

```bash
sudo -u deploy -H bash -c 'cd /var/www/monitor-matrix && npm run lineup'
```

Lệnh này cũng tự chạy sau `npm run seed`. Bản sao lưu database trước khi đổi lineup: `/root/monitor_matrix_before_lineup_2026-10-19.dump`.

---

## 2e. Import Data - LCD

Menu **Import Data - LCD** (chỉ Mod và Admin), nằm dưới Doanh số LCD. Trang này hiển thị số liệu nhập khẩu màn hình vào Việt Nam 2024–2026, lấy từ sheet RAW của file *LCD IMPORT DATA - Analysis 2026*.

- **Biểu đồ theo tháng:**
  - Chọn một hoặc nhiều năm. Mỗi năm có một màu riêng: 2024 tím, 2025 cam AORUS, 2026 xanh GIGABYTE. Cột là kim ngạch, đường là số lượng. Chú thích nằm dưới biểu đồ.
  - Có thể lọc thêm theo Brand, kích thước, tấm nền, độ phân giải, tần số, hoặc tìm theo model / nhà nhập khẩu.
- **Phân tích dữ liệu:**
  - Mọi bảng đều tính trực tiếp từ dữ liệu RAW.
  - Chọn **Dòng**, **Dòng con** và **Cột** theo một trong các chiều: Năm, Quý, Tháng, Kích thước, Brand, Độ phân giải, Tấm nền, Tần số quét, Kiểu màn (phẳng/cong), Xuất xứ, Cửa khẩu, Điều kiện giao hàng. Nhà nhập khẩu và Model chỉ dùng được cho dòng.
  - **Số liệu** có 5 lựa chọn:
    - Số lượng;
    - Kim ngạch;
    - cả hai;
    - **FOB bình quân** (= kim ngạch / số lượng, tính bằng USD);
    - **Tỉ trọng %** (phần của mỗi dòng trong cột, tức thị phần).
  - **Mẫu phân tích** có 15 mẫu, chia 4 nhóm:
    - Thị trường;
    - Gaming ≥144Hz;
    - Giá FOB;
    - Kênh nhập khẩu (nhà nhập khẩu, cửa khẩu, xuất xứ).
  - Khi có hơn 40 cột, các cột nhỏ được gộp vào cột "Khác".
- **Model & giá FOB:** mỗi model gồm số lượng, kim ngạch, FOB bình quân, FOB thấp – cao nhất, số nhà nhập khẩu và nhà nhập khẩu chính. Có lọc theo năm, Brand và "chỉ gaming ≥144Hz", có ô tìm kiếm và nhiều cách sắp xếp.
- **Dùng ở trang sản phẩm:**
  - Tab **So với đối thủ** chỉ hiện đối thủ có số lượng nhập khẩu lớn hơn 0 trong **9 tháng gần nhất**, xếp theo số lượng nhập khẩu.
  - Bảng so sánh, ở cả tab này lẫn trang So sánh, có hàng **Giá FOB nhập khẩu (9 tháng)** ngay trên hàng Giá thấp nhất.
  - Mẫu được so khớp với dữ liệu hải quan theo brand và mã model (tên model hoặc alias; nếu không khớp thì so theo mã con). Samsung không có trong dữ liệu hải quan, nên **Samsung không áp dụng điều kiện nhập khẩu**: mẫu Samsung cùng phân khúc luôn được thêm vào sau 3 đối thủ nhập khẩu nhiều nhất, hàng FOB của Samsung để "—".
- **Dữ liệu:** file `data/import/import-raw-2024-2026.json`, có số liệu đến 22/09/2026, chỉ tài khoản Mod và Admin tải được (`/api/nhap-khau`).
  - **Lưu ý về file gốc:** model "LEGION 27Q-10" (Lenovo) bị lặp ở nhiều brand khác, do lỗi kéo-điền trong file Excel. Trang vẫn hiển thị đúng như dữ liệu gốc.
- **Cập nhật số liệu mới:** thay file RAW trên (cùng định dạng), sửa ngày "cập nhật" trong `src/lib/i18n/messages/imports.ts`, rồi chạy `scripts/deploy.sh`.

---

## 3. Người dùng và phân quyền

| Quyền | Viewer | Mod | Admin |
|---|:-:|:-:|:-:|
| Xem mọi trang, xuất Excel | ✓ | ✓ | ✓ |
| Tải file giá, Áp dụng, huỷ lần tải lên | | ✓ | ✓ |
| Gắn / bỏ qua dòng chưa khớp, sửa phân khúc | | ✓ | ✓ |
| Sửa đại lý (thêm, tên, website, thứ tự, trọng điểm, lẻ/sỉ, ẩn/hiện) | | ✓ | ✓ |
| Ảnh sản phẩm (tải lên, lấy tự động, dán link, xoá) | | ✓ | ✓ |
| Xem Doanh số LCD | | ✓ | ✓ |
| Xoá đại lý | | | ✓ |
| Quản lý người dùng | | | ✓ |

**Thêm người dùng** (Admin): **Quản trị → tab Người dùng → Thêm người dùng**, nhập họ tên, email, vai trò và mật khẩu (ít nhất 8 ký tự, có chữ và số), rồi gửi email + mật khẩu cho họ qua kênh riêng. Họ tự đổi mật khẩu ở **menu tài khoản (góc phải trên) → Tài khoản · đổi mật khẩu**.

Trong tab Người dùng, Admin có thể:
- **Đổi vai trò** (Admin / Mod / Viewer): người đó phải đăng nhập lại.
- **Tắt "Hoạt động"** để khoá tài khoản (ví dụ khi nhân viên nghỉ): người đó bị đăng xuất ngay.
- **Đặt lại mật khẩu** khi họ quên.
- **Xoá**: các lần tải giá của họ vẫn được giữ.

Không ai tự khoá, tự hạ quyền hay tự xoá chính mình; luôn phải còn ít nhất một Admin.

**Quên mật khẩu Admin** (không còn ai đăng nhập được Admin): trên VPS chạy

```bash
sudo -u deploy -H bash -c 'cd /var/www/monitor-matrix && npm run user -- reset email@cua-admin.com'
```

Lệnh in ra một mật khẩu mới (và mở khoá tài khoản nếu đang bị khoá). Các lệnh khác: `npm run user -- list` (xem danh sách), `npm run user -- create <email> <admin|mod|viewer> "<Họ tên>"`.

Đăng nhập sai quá 8 lần trong 15 phút (theo IP hoặc theo email) sẽ bị chặn 15 phút. Phiên đăng nhập kéo dài: Viewer 30 ngày, Mod 7 ngày, Admin 12 giờ.

---

## 4. Khởi động lại app

Đăng nhập VPS bằng SSH rồi chạy (app chạy bằng user `deploy`, tên PM2 là `monitor-matrix`):

```bash
sudo -u deploy pm2 restart monitor-matrix     # khởi động lại
sudo -u deploy pm2 status                      # xem trạng thái các app
sudo -u deploy pm2 logs monitor-matrix --lines 100   # xem log khi có lỗi
```

- Sửa `.env` → chỉ cần `pm2 restart monitor-matrix`, không cần build lại.
- VPS khởi động lại → PM2 tự bật app (đã `pm2 save`).
- Lệnh trên chỉ khởi động lại app này; vnpromotion, sample-manager, promotion-hub không bị ảnh hưởng.

## 5. Cập nhật code (sau khi sửa code)

```bash
sudo -u deploy -H /var/www/monitor-matrix/scripts/deploy.sh
```

Script làm lần lượt:
1. Cài thư viện nếu `package-lock.json` đổi.
2. Chạy migration database.
3. Kiểm tra TypeScript và chạy test.
4. Build vào thư mục `.next-build` (bản đang chạy chưa bị đụng tới).
5. Thay bản build và restart PM2.
6. Kiểm tra app trả lời; nếu không, tự quay lại bản trước.

Build mất khoảng 1 phút và dùng khoảng 750MB RAM. VPS chỉ có 2GB, nên tránh build lúc đang build app khác.

## 6. Nạp lại dữ liệu gốc (`data/`)

Khi có bản mới của `gigabyte-specs.json`, `segments/*.json` hay `data/prices/`, chép đè vào `/var/www/monitor-matrix/data`, rồi chạy:

```bash
sudo -u deploy -H bash -c 'cd /var/www/monitor-matrix && npm run seed'
```

Seed chạy lại bao nhiêu lần cũng được, không tạo bản ghi trùng:
- **Cập nhật:** specs, đối thủ, benchmark, và lần nhập giá "Dữ liệu khởi tạo".
- **Giữ nguyên:**
  - Những gì bạn chỉnh trong Quản trị: thứ tự đại lý, trọng điểm, loại giá, ẩn/hiện, nhãn kết luận.
  - Các lần tải giá từ Quản trị.
  - Các mẫu bạn đã "Gắn".

## 7. Cấu hình và bảo mật

File `/var/www/monitor-matrix/.env` (chỉ user deploy đọc được, không đưa lên git):

| Biến | Ý nghĩa |
|---|---|
| `DATABASE_URL` | PostgreSQL `monitor_matrix_db`, user riêng `monitor_user` (chỉ có quyền trên database này) |
| `SALES_DATABASE_URL` | Kết nối **chỉ đọc** tới `vnpromotion_db` (role `monitor_reader`) cho trang Doanh số LCD |
| `SESSION_SECRET` | Khoá ký cookie đăng nhập. Đổi khoá = mọi người phải đăng nhập lại |
| `ADMIN_EMAIL` (+ `ADMIN_NAME`, `ADMIN_PASSWORD`) | Chỉ dùng một lần để tạo Admin đầu tiên (`npm run user -- bootstrap`) khi database chưa có tài khoản nào. Tạo xong thì xoá `ADMIN_PASSWORD` khỏi `.env` |

Mật khẩu người dùng **không** nằm trong `.env`: chúng được mã hoá một chiều (scrypt) trong database, không ai đọc lại được, kể cả Admin. Trang có header `noindex` để Google không đưa lên kết quả tìm kiếm.

**Sao lưu database** (nên làm trước khi nạp dữ liệu lớn):

```bash
sudo -u postgres pg_dump -Fc monitor_matrix_db > ~/monitor_matrix_$(date +%F).dump
sudo tar czf ~/monitor_matrix_images_$(date +%F).tgz -C /var/www/monitor-matrix storage/images
```

## 8. Hạ tầng trên VPS

| Thành phần | Giá trị |
|---|---|
| Thư mục | `/var/www/monitor-matrix` (chủ sở hữu: `deploy`) |
| PM2 | `monitor-matrix`, `next start -H 127.0.0.1 -p 3003` (`ecosystem.config.cjs`) |
| Nginx | `/etc/nginx/sites-available/monitor.vnpromotion.com` (bản gốc: `deploy/nginx-monitor.vnpromotion.com.conf`) |
| SSL | Let's Encrypt, Certbot tự gia hạn (`certbot renew`) |
| DNS | Cloudflare, bản ghi A `monitor` → 157.66.24.196, **Proxied** (tường lửa VPS chỉ nhận cổng 80/443 từ Cloudflare) |

## 9. Cho lập trình viên

- **Stack:** Next.js 16 (App Router) + TypeScript, Tailwind CSS 4 (token màu trong `src/app/globals.css` theo bộ màu vnpromotion: cyan GIGABYTE, hồng AORUS, gradient INFINITY; bảng màu mặc định bị tắt), sharp (xử lý ảnh), component kiểu shadcn trên Base UI, TanStack Table + Virtual (bảng giá), Recharts, Prisma 7 + PostgreSQL, Papa Parse, exceljs (xuất .xlsx có tô màu), Vitest.
- **Cấu trúc chính:**
  - `prisma/schema.prisma`: Product, Segment, Benchmark, Dealer, PriceImport, PriceImportDealer, PriceSnapshot, UnmatchedPrice, User.
  - `src/lib/permissions.ts`: bảng quyền theo vai trò; `src/lib/auth.ts`: phiên đăng nhập (cookie ký HMAC, kiểm tra lại tài khoản trong database ở mỗi request).
  - `scripts/seed.ts`: nạp `data/`.
  - `src/lib/import/`: đọc file giá, so sánh, áp dụng (dùng chung cho seed và Quản trị).
  - `src/lib/catalog.ts`: dữ liệu và giá tại một ngày bất kỳ.
  - `src/lib/pricing.ts`: quy tắc giá thấp nhất.
  - `src/app/(app)/`: các trang.
- **Lịch sử giá:** mỗi lần tải lên là một `PriceImport`. Giá của một đại lý tại ngày X lấy từ lần tải lên gần nhất (≤ X) có đại lý đó.
- **Lệnh thường dùng:**

  ```bash
  npm test             # 43 test: giá thấp nhất, diff khi tải file, đọc CSV/JSON, so sánh, phân quyền, mật khẩu, khớp tên ảnh
  npm run typecheck
  npm run lint
  npm run db:deploy    # chạy migration
  npm run seed
  ```

- **Chạy thử trên máy khác:** cần PostgreSQL. Chép `.env.example` thành `.env` rồi điền giá trị, sau đó:

  ```bash
  npm i && npx prisma migrate deploy && npm run seed && npm run user -- bootstrap && npm run dev
  ```

  Mở http://127.0.0.1:3003. Muốn tạo migration mới thì dùng `npx prisma migrate dev`; lệnh này cần quyền tạo database tạm.
