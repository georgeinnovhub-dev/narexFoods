/** Client-side hash deep links for the single-route webapp: /#/menu?category=x, /#/admin/orders, … */

export type HashView =
  | "home"
  | "menu"
  | "checkout"
  | "success"
  | "track"
  | "services"
  | "parlays"
  | "eatntour"
  | "account"
  | "blog"
  | "privacy"
  | "terms"
  | "delivery-info"
  | "admin";

const VIEWS: HashView[] = [
  "home",
  "menu",
  "checkout",
  "success",
  "track",
  "services",
  "parlays",
  "eatntour",
  "account",
  "blog",
  "privacy",
  "terms",
  "delivery-info",
  "admin",
];

const ADMIN_MODULES = [
  "overview",
  "orders",
  "menu",
  "payments",
  "staff",
  "dispatch",
  "marketing",
  "content",
  "reports",
  "quotes",
  "zones",
  "system",
] as const;

export interface ParsedHash {
  view: HashView | null;
  params: Record<string, string>;
  adminModule: (typeof ADMIN_MODULES)[number] | null;
}

/** Parses `#/menu?category=x` / `#/admin/orders` into view + params. */
export function parseHash(hash: string): ParsedHash {
  const empty: ParsedHash = { view: null, params: {}, adminModule: null };
  if (!hash.startsWith("#/")) return empty;
  const [path, query = ""] = hash.slice(2).split("?");
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return empty;

  const head = segments[0];
  if (!VIEWS.includes(head as HashView)) return empty;
  const view = head as HashView;

  const params: Record<string, string> = {};
  if (query.length > 0) {
    for (const [key, value] of new URLSearchParams(query).entries()) {
      params[key] = value;
    }
  }

  let adminModule: ParsedHash["adminModule"] = null;
  if (view === "admin" && segments[1]) {
    const mod = segments[1] as (typeof ADMIN_MODULES)[number];
    if (ADMIN_MODULES.includes(mod)) adminModule = mod;
  }

  return { view, params, adminModule };
}

/** Builds a shareable hash for a view (+params, or admin module path). */
export function buildHash(view: HashView, params?: Record<string, string>, adminModule?: string): string {
  if (view === "admin") {
    return adminModule ? `#/admin/${adminModule}` : "#/admin";
  }
  const entries = Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== "");
  const query = entries.length > 0 ? `?${new URLSearchParams(entries).toString()}` : "";
  return `#/${view}${query}`;
}
