export type AdminDealer = {
  id: string;
  name: string;
  website: string;
  isKey: boolean;
  priceType: "retail" | "dealer";
  visible: boolean;
  status: string;
  prices: number; // price rows in history
};

export type AdminSegment = {
  id: string;
  name: string;
  verdict: "lead" | "even" | "weak" | null;
  conclusionVi: string;
  representativeId: number | null;
  models: { id: number; model: string; hasImage: boolean }[]; // GIGABYTE models of the segment
  autoModel: string | null; // shown when no model is picked
};

export type AdminImport = {
  id: number;
  day: string;
  createdAt: string;
  source: string;
  fileName: string | null;
  uploadedBy: string | null;
  prices: number;
  dealers: number;
  unmatched: number;
  summary: Record<string, unknown>;
};

export type AdminUnmatched = {
  id: number;
  dealer: string;
  name: string;
  slug: string | null;
  price: number | null;
  url: string | null;
  note: string | null;
  day: string;
};

export type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "mod" | "viewer";
  active: boolean;
  lastLogin: string | null;
  created: string;
  uploads: number;
};
