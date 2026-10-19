// Full spec sheet of a product, grouped and labelled in Vietnamese. Values stay as published by the maker.

export type SpecGroupId = "display" | "connect" | "ergo" | "power" | "size" | "other";

export const SPEC_GROUPS: { id: SpecGroupId; label: string }[] = [
  { id: "display", label: "Hiển thị" },
  { id: "connect", label: "Kết nối" },
  { id: "ergo", label: "Công thái học" },
  { id: "power", label: "Điện" },
  { id: "size", label: "Kích thước" },
  { id: "other", label: "Khác" },
];

// gigabyte.com spec keys
const GIGABYTE: Record<string, [string, SpecGroupId]> = {
  "Panel Size (inch)": ["Kích thước", "display"],
  "Aspect Ratio": ["Tỉ lệ khung hình", "display"],
  "Panel Type": ["Tấm nền", "display"],
  Curve: ["Độ cong", "display"],
  "Display Viewing Area (HxV)": ["Vùng hiển thị (ngang × dọc)", "display"],
  "Color Saturation": ["Độ phủ màu", "display"],
  Resolution: ["Độ phân giải", "display"],
  "Display Surface": ["Bề mặt", "display"],
  "Pixel Pitch": ["Kích thước điểm ảnh", "display"],
  Brightness: ["Độ sáng", "display"],
  "Contrast Ratio (Typ.)": ["Độ tương phản", "display"],
  "Dynamic Contrast Ratio": ["Tương phản động", "display"],
  "Viewing Angle": ["Góc nhìn", "display"],
  "Display Colors": ["Số màu hiển thị", "display"],
  "Color Accuracy": ["Độ chính xác màu", "display"],
  "Factory Calibration": ["Cân màu xuất xưởng", "display"],
  "Refresh Rate (Max)": ["Tần số quét (tối đa)", "display"],
  "Response Time": ["Thời gian phản hồi", "display"],
  "HDR Support": ["Chuẩn HDR", "display"],
  "Local Dimming": ["Số vùng làm mờ cục bộ", "display"],
  "Flicker-free": ["Chống nhấp nháy", "display"],
  "VESA Certified ClearMR": ["Chứng nhận VESA ClearMR", "display"],
  VRR: ["Đồng bộ khung hình (VRR)", "display"],
  "V-Sync": ["Đồng bộ khung hình", "display"],
  "Digital Signal Frequency": ["Tần số tín hiệu", "display"],
  "Picture modes": ["Chế độ hình ảnh", "display"],
  "Light sensor": ["Cảm biến ánh sáng", "display"],
  Connectivity: ["Cổng kết nối", "connect"],
  HBR3: ["DisplayPort HBR3", "connect"],
  "USB port(s)": ["Cổng USB", "connect"],
  "Earphone Jack": ["Jack tai nghe", "connect"],
  "Microphone Jack": ["Jack micro", "connect"],
  "Digital Audio Output": ["Ngõ ra âm thanh số", "connect"],
  Speaker: ["Loa", "connect"],
  Audio: ["Âm thanh", "connect"],
  "Sound Modes": ["Chế độ âm thanh", "connect"],
  "Tilt(angle)": ["Nghiêng", "ergo"],
  "Swivel(angle)": ["Xoay ngang", "ergo"],
  "Pivot(angle/direction)": ["Xoay dọc (pivot)", "ergo"],
  "Height Adjustment (mm)": ["Nâng hạ", "ergo"],
  "Forward Extension (mm)": ["Kéo ra trước", "ergo"],
  "VESA Wall Mounting(mm)": ["Treo tường VESA", "ergo"],
  "Kensington lock": ["Khoá Kensington", "ergo"],
  "Power Type": ["Nguồn", "power"],
  "Power Consumption": ["Tiêu thụ điển hình", "power"],
  "AC Input Max": ["Công suất tối đa", "power"],
  "Power Saving Mode": ["Chế độ tiết kiệm", "power"],
  "Power Off Mode": ["Khi tắt", "power"],
  Voltage: ["Điện áp", "power"],
  "Phys. Dimension with Stand(WxHxD)": ["Có chân (R × C × S)", "size"],
  "Phys. Dimension w/o stand (WxHxD)": ["Không chân (R × C × S)", "size"],
  "Box Dimension (WxHxD)": ["Hộp (R × C × S)", "size"],
  "Net Weight with stand (Esti.)": ["Khối lượng (có chân)", "size"],
  "Net Weight without stand (Esti.)": ["Khối lượng (không chân)", "size"],
  "Net Weight (Esti.)": ["Khối lượng", "size"],
  "Gross Weight (Esti.)": ["Khối lượng cả hộp", "size"],
  "Unique Features": ["Tính năng riêng", "other"],
  Certified: ["Chứng nhận", "other"],
  Accessories: ["Phụ kiện kèm theo", "other"],
  Warranty: ["Bảo hành", "other"],
  OS: ["Hệ điều hành", "other"],
  "App Store": ["Kho ứng dụng", "other"],
  Type: ["Loại", "other"],
  Note: ["Ghi chú của hãng", "other"],
};

// Rival spec keys (segments/*.json "specs")
const RIVAL: Record<string, [string, SpecGroupId]> = {
  size: ["Kích thước", "display"],
  panel: ["Tấm nền", "display"],
  resolution: ["Độ phân giải", "display"],
  refresh_hz: ["Tần số quét", "display"],
  refresh_dual_mode: ["Chế độ kép", "display"],
  response_time: ["Thời gian phản hồi", "display"],
  brightness_sdr: ["Độ sáng SDR", "display"],
  brightness_hdr_peak: ["Độ sáng HDR (đỉnh)", "display"],
  hdr_cert: ["Chuẩn HDR", "display"],
  dci_p3: ["Độ phủ DCI-P3", "display"],
  contrast: ["Độ tương phản", "display"],
  ports: ["Cổng kết nối", "connect"],
  usb_c_pd_w: ["USB-C sạc (PD)", "connect"],
  _kvm: ["KVM", "connect"],
  speakers: ["Loa", "connect"],
  ergonomics: ["Chân đế", "ergo"],
  warranty: ["Bảo hành", "other"],
  msrp_usd: ["Giá niêm yết của hãng (USD)", "other"],
  _spec_source_note: ["Nguồn thông số", "other"],
};

function value(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s || s === "N/A") return null;
  if (/^yes$/i.test(s)) return "Có";
  if (/^no$/i.test(s)) return "Không";
  return s;
}

export type SpecGroup = { id: SpecGroupId; label: string; rows: { label: string; value: string }[] };

export function groupSpecs(raw: Record<string, unknown>, isGigabyte: boolean): SpecGroup[] {
  const dict = isGigabyte ? GIGABYTE : RIVAL;
  const groups = new Map<SpecGroupId, SpecGroup>(SPEC_GROUPS.map((g) => [g.id, { ...g, rows: [] }]));
  for (const [key, v] of Object.entries(raw)) {
    if (key === "_model_full") continue;
    const val = value(v);
    if (!val) continue;
    const [label, group] = dict[key] ?? [key, "other"];
    groups.get(group)!.rows.push({ label, value: val });
  }
  return [...groups.values()].filter((g) => g.rows.length);
}
