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

export type AdminSegment = { id: string; name: string; verdict: "lead" | "even" | "weak" | null; conclusionVi: string };

export type AdminImport = {
  id: number;
  day: string;
  createdAt: string;
  source: string;
  fileName: string | null;
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
