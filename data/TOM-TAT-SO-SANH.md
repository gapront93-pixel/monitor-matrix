# Matrix màn hình GIGABYTE so với đối thủ

Dữ liệu lấy ngày 18/10/2026. Specs GIGABYTE lấy trực tiếp từ trang `gigabyte.com/Monitor/<mẫu>/sp`. Benchmark lấy từ Tom's Hardware, TechSpot (Monitors Unboxed), TFTCentral, PCMonitors, PCWorld, KitGuru và 3DTested. Mỗi con số trong file đều kèm link nguồn.

## Các file

| File | Nội dung |
|---|---|
| `monitor-matrix.xlsx` | File chính. Gồm 99 mẫu GIGABYTE (bảng đã chuẩn hóa và bảng specs gốc), 8 sheet phân khúc (dòng vàng là GIGABYTE, các dòng còn lại là đối thủ) và sheet Benchmark |
| `gigabyte-specs.csv` / `.json` | 99 mẫu GIGABYTE: các cột chuẩn hóa và toàn bộ specs gốc |
| `competitors.csv` | 44 mẫu đối thủ thuộc ASUS, MSI, Samsung, LG, Dell/Alienware |
| `benchmarks.csv` | 392 dòng số đo kèm link review |
| `specs/gigabyte/*.json` | Specs gốc của từng mẫu |
| `segments/*.json` | Dữ liệu từng phân khúc kèm ghi chú |

## Kết luận nhanh theo phân khúc

1. **OLED 27" QHD 240–280Hz.** GIGABYTE mạnh ở phân khúc này. MO27Q28G (tandem WOLED, 335 nit SDR) sáng ngang ASUS XG27AQWMG và LG 27GX700A, và theo RTINGS thì dùng chung tấm nền với LG. Đo input lag trên Tom's Hardware: FO27Q2 13ms, MO27Q28G 14ms, cả hai đều thấp hơn Alienware AW2725D (17ms), Samsung G6 (18ms) và ASUS (20ms). TechSpot chọn MO27Q28GR là mẫu 280Hz đáng tiền nhất.
2. **OLED 27" QHD 360–500Hz.** FO27Q5P (500Hz) có nhiều tính năng nhất phân khúc: DP 2.1, KVM, loa, bảo hành burn-in 3 năm. Bù lại, input lag 18ms của nó cao hơn LG 27GX790A (10ms) và ASUS XG27AQDPG (16ms), và màu mặc định hơi ấm. TechSpot đánh giá các mẫu QD-OLED 500Hz gần như ngang nhau.
3. **OLED 32" 4K 240Hz.** FO32U2P được Tom's Hardware trao Editor's Choice với input lag 25ms và khoảng 108% DCI-P3. Đối thủ mạnh nhất là ASUS PG32UCDM3 thế hệ 2026, nhanh hơn (18ms) và sáng hơn (504 nit). LG 32GS95UE là mẫu duy nhất có dual-mode 4K240/1080p480. Hiện chưa có review đo đạc cho MO32U2, MO32U24 và FO32U24G.
4. **OLED 34" ultrawide.** MO34WQC2 được Tom's Hardware trao Editor's Choice nhờ gamut rộng nhất (hơn 110% P3) và có KVM. Tuy vậy, TechSpot đánh giá Alienware AW3425DW (799 USD, cùng tấm nền) tốt hơn về HDR. ASUS PG34WCDN 360Hz đối đầu trực tiếp với MO34WQC36, nhưng mẫu ASUS có input lag thấp kỷ lục 10.3ms.
5. **IPS 27" QHD 180–300Hz.** Trên giấy, M27Q3 (300Hz, OC 320Hz, có KVM) dẫn đầu phân khúc. Đối thủ trên giấy mạnh nhất là MSI MAG 274QRF QD E2 với 98% P3 và USB-C 65W. M27QA ICE có input lag thấp nhất (19ms, Tom's Hardware). ASUS XG27ACS chuẩn màu hơn và có overdrive tốt hơn.
6. **IPS 27" 4K 144–160Hz.** M27U (KVM, HDR600) có số đo tốt theo PCMonitors: 424 nit, 91% P3, dE 1.74. TechSpot đánh giá nó ngang LG 27GR93U và ASUS XG27UCS, và chọn M27UP là mẫu giá rẻ đáng mua. Alienware AW2725QF có dual-mode 4K180/1080p360 nên vượt về tính năng.
7. **FHD eSports 24–27".** Các mẫu GIGABYTE dòng GS/G gần như chưa có review đo đạc. Trên giấy, ASUS VG259QM5A và Dell G2524H (280Hz) mạnh hơn. Ở phân khúc này GIGABYTE chủ yếu cạnh tranh bằng giá.
8. **VA 34" ultrawide.** GIGABYTE dẫn đầu. G34WQC2 có 200Hz, 450 nit và 95% P3, cao hơn ASUS VG34VQL3A, MSI 345CQR và Samsung G5. G34WQCP được 3DTested trao Editor's Choice với tương phản đo được 5030:1.

## Lưu ý khi dùng số liệu

- **RTINGS bị chặn trong môi trường này**, nên file chưa có điểm RTINGS. Có thể bổ sung sau nếu bạn copy số từ trang RTINGS vào.
- **Chỉ so input lag giữa các máy do cùng một nguồn đo.** Tom's Hardware đo toàn bộ chuỗi (10–25ms), còn TFTCentral và TechSpot chỉ đo độ trễ xử lý (dưới 1ms).
- **Một số specs đối thủ lấy từ trang review hoặc nhà bán lẻ** khi trang chính hãng bị chặn. Cột `source_url` cho biết nguồn của từng dòng.
- **Danh sách GIGABYTE có cả mẫu cũ**, ví dụ M27Q Rev 1.0 và FO48U. Bạn có thể lọc theo nhu cầu.
- **Một vài giá trị ghi theo đúng trang GIGABYTE dù có thể là lỗi đánh máy của trang:** G27Q26 swivel ±160°, pixel pitch của GS24F14A, và Voltage "50/60H".
