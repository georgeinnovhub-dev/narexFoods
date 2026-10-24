/** Granular permission keys (spec §8). Enforced server-side on every protected API. */
export const PERMISSIONS = [
  "orders.manage", // view + update orders, accept/reject/prepare
  "payments.review", // review payment evidence, approve/reject
  "payments.configure", // enable/configure payment providers
  "menu.manage", // products, categories, variants, addons
  "dispatch.manage", // assignments, dispatchers, service areas
  "staff.manage", // enrollment, roles, activation
  "content.manage", // website editor, hero slides, blog
  "marketing.manage", // coupons, campaigns, popups
  "reports.view", // analytics, exports
  "settings.manage", // system settings, integrations
  "audit.view", // audit logs
  "catering.manage", // catering & service-package quotations (spec §8)
  "zones.manage", // delivery zones, fees & coverage (spec §7)
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  "orders.manage": "Order management",
  "payments.review": "Payment evidence review",
  "payments.configure": "Payment configuration",
  "menu.manage": "Menu & product editing",
  "dispatch.manage": "Dispatch management",
  "staff.manage": "Staff enrollment & roles",
  "content.manage": "Website editing & publishing",
  "marketing.manage": "Campaigns & coupons",
  "reports.view": "Analytics & exports",
  "settings.manage": "System settings",
  "audit.view": "Audit logs",
  "catering.manage": "Catering quotations",
  "zones.manage": "Delivery zones & fees",
};

export interface SessionPayload {
  sid: string;
  staffId: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  exp: number;
}

export const SESSION_COOKIE = "narex_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h

// ---------- Customer sessions (spec §16 — separate cookie from staff) ----------

export const CUSTOMER_COOKIE = "narex_customer";
export const CUSTOMER_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface CustomerSessionPayload {
  typ: "customer";
  customerId: string;
  email: string;
  name: string;
  exp: number;
}
