// Product rows from the data files, shared by seed.ts and lineup.ts
import {
  cleanStr,
  firstInt,
  firstNum,
  panelFamily,
  portVersion,
  resolutionOf,
  stripParens,
  yesNo,
} from "../src/lib/normalize";

export type GigabyteSpec = Record<string, string> & { raw: Record<string, string> };
export type SegmentFile = {
  segment_id: string;
  segment_name_vi: string;
  criteria: string;
  gigabyte_models: string[];
  competitors: { brand: string; model: string; spec_url?: string; spec_source_note?: string; kvm?: unknown; specs: Record<string, unknown> }[];
  benchmarks: { brand: string; model: string; source: string; url: string; date?: string; metrics: Record<string, unknown>; verdict?: string }[];
  notes?: string;
};

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function brandOf(b: string): string {
  return b.startsWith("Dell") ? "Dell" : b.trim();
}

export function gigabyteData(x: GigabyteSpec) {
  return {
    brand: "GIGABYTE",
    isGigabyte: true,
    model: x.model,
    series: cleanStr(x.series),
    line: cleanStr(x.line),
    sizeIn: firstNum(x.size_in),
    panel: panelFamily(x.panel),
    shape: cleanStr(x.shape),
    resolution: resolutionOf(x.resolution),
    refreshHz: firstInt(x.refresh_hz),
    responseMs: firstNum(x.response_ms),
    brightnessSdrNits: firstInt(x.brightness_sdr_nits),
    brightnessHdrPeakNits: firstInt(x.brightness_hdr_peak_nits),
    hdr: cleanStr(x.hdr),
    dciP3Pct: firstNum(x.dci_p3_pct),
    srgbPct: firstNum(x.srgb_pct),
    contrast: cleanStr(x.contrast),
    bitDepth: cleanStr(x.bit_depth),
    hdmiVer: cleanStr(x.hdmi_ver),
    dpVer: cleanStr(x.dp_ver),
    usbC: yesNo(x.usb_c),
    usbCPdW: firstNum(x.usb_c_pd_w),
    kvm: yesNo(x.kvm),
    heightAdjMm: firstInt(x.height_adj_mm),
    pivot: yesNo(x.pivot),
    speaker: cleanStr(x.speaker),
    warranty: cleanStr(x.warranty),
    msrpUsd: null,
    url: cleanStr(x.url),
    rawSpecs: x.raw,
  };
}

export function competitorData(c: SegmentFile["competitors"][number], segmentId: string) {
  const s = c.specs;
  const str = (k: string) => cleanStr(s[k]);
  const ports = str("ports");
  const pd = str("usb_c_pd_w");
  const ergo = str("ergonomics");
  const sdr = str("brightness_sdr");
  const p3 = str("dci_p3");
  const height = ergo?.match(/height[^,;]*?(?:(\d+)\s*[-–]\s*)?(\d+)\s*mm/i);
  return {
    brand: brandOf(c.brand),
    isGigabyte: false,
    model: stripParens(c.model),
    series: null,
    line: null,
    segmentId,
    sizeIn: firstNum(s.size),
    panel: panelFamily(s.panel),
    shape: /curv|cong|\d{4}r\b/i.test(String(s.panel ?? "")) ? "Curve" : null,
    resolution: resolutionOf(s.resolution),
    refreshHz: firstInt(s.refresh_hz),
    responseMs: firstNum(s.response_time),
    // Spec pages that do not list a value sometimes quote a review number: keep those out of the spec fields
    brightnessSdrNits: sdr && !/not listed/i.test(sdr) ? firstInt(sdr) : null,
    brightnessHdrPeakNits: firstInt(s.brightness_hdr_peak),
    hdr: str("hdr_cert"),
    dciP3Pct: p3 && !/not listed|no (dci-?)?p3|^srgb/i.test(p3) && !/^[\d.]+%\s*srgb/i.test(p3) ? firstNum(p3) : null,
    srgbPct: null,
    contrast: str("contrast"),
    bitDepth: null,
    hdmiVer: portVersion(ports, "hdmi"),
    dpVer: portVersion(ports, "dp"),
    usbC: pd ? !/no usb-?c/i.test(pd) : ports ? /usb-?c|type-?c/i.test(ports) : null,
    usbCPdW: pd && !/no usb-?c/i.test(pd) ? firstNum(pd.match(/(\d+(?:\.\d+)?)\s*W/i)?.[1]) : null,
    kvm: c.kvm === undefined ? null : typeof c.kvm === "boolean" ? c.kvm : yesNo(c.kvm),
    heightAdjMm: height ? Number(height[2]) - Number(height[1] ?? 0) : null,
    // Not mentioned = unknown, except "tilt only"
    pivot: !ergo || /pivot[^,;]*not listed/i.test(ergo)
      ? null
      : /no pivot|pivot:?\s*no|tilt only/i.test(ergo) ? false : /pivot/i.test(ergo) ? true : null,
    speaker: str("speakers"),
    warranty: str("warranty"),
    msrpUsd: str("msrp_usd"),
    url: cleanStr(c.spec_url),
    rawSpecs: { ...s, _model_full: c.model, _spec_source_note: c.spec_source_note ?? null, _kvm: c.kvm ?? null } as object,
  };
}
