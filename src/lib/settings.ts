import { db } from "@/lib/db";

export interface SiteSettings {
  brand: { name: string; tagline: string; developerCredit: string };
  contact: { phone: string; whatsapp: string; whatsappIntl: string; email: string; address: string };
  hours: Record<string, string>;
  ordering: { enabled: boolean; pauseNote: string };
  delivery: { enabled: boolean; baseFee: number; freeOver: number | null; areas: string[]; note: string };
  payments: {
    manual: { enabled: boolean; recipientName: string; method: string; details: string; instructions: string };
    paystack: { enabled: boolean; publicKey: string };
    zenobank: { enabled: boolean };
  };
}

export const DEFAULT_SETTINGS: SiteSettings = {
  brand: {
    name: "NAREX Foods",
    tagline: "Good Food. Great Taste. Made with Care.",
    developerCredit: "Engineered by iDe8 Flow Hub",
  },
  contact: {
    phone: "0559291195",
    whatsapp: "0559291195",
    whatsappIntl: "233559291195",
    email: "hello@narexfoods.com",
    address: "Mampong-Akuapem, Eastern Region, Ghana",
  },
  hours: {
    monday: "08:00 – 18:00",
    tuesday: "08:00 – 18:00",
    wednesday: "08:00 – 18:00",
    thursday: "08:00 – 18:00",
    friday: "08:00 – 18:00",
    saturday: "10:00 – 20:00",
    sunday: "12:00 – 18:00",
  },
  ordering: {
    enabled: true,
    pauseNote:
      "Online ordering is paused right now. Please call or WhatsApp us and we will be happy to serve you.",
  },
  delivery: {
    enabled: true,
    baseFee: 1000,
    freeOver: null,
    areas: ["Mampong-Akuapem", "Akropong", "Aburi", "Nsawam", "Koforidua"],
    note: "Delivery is available within our configured service areas only.",
  },
  payments: {
    manual: {
      enabled: true,
      recipientName: "NAREX Foods",
      method: "Mobile Money (MTN)",
      details: "MTN MoMo · 0559291195 · Account name: NAREX Foods",
      instructions:
        "Transfer the exact total to the account above, then upload your payment evidence (screenshot or receipt) after placing your order. Your order is confirmed once our team verifies the payment.",
    },
    paystack: { enabled: false, publicKey: "" },
    zenobank: { enabled: false },
  },
};

const SITE_KEY = "site";

function deepMerge<T>(base: T, override: unknown): T {
  if (override === null || override === undefined) return base;
  if (typeof base !== "object" || Array.isArray(base) || typeof override !== "object" || Array.isArray(override)) {
    return override as T;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(override as Record<string, unknown>)) {
    out[k] = k in (base as Record<string, unknown>) ? deepMerge((base as Record<string, unknown>)[k], v) : v;
  }
  return out as T;
}

/** Load site settings merged over safe defaults. Missing/invalid values never break the site. */
export async function getSettings(): Promise<SiteSettings> {
  try {
    const row = await db.setting.findUnique({ where: { key: SITE_KEY } });
    if (!row) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(row.value);
    return deepMerge(DEFAULT_SETTINGS, parsed);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(patch: unknown, actor: string): Promise<SiteSettings> {
  const current = await getSettings();
  const next = deepMerge(current, patch);
  await db.setting.upsert({
    where: { key: SITE_KEY },
    create: { key: SITE_KEY, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  });
  const { logAudit } = await import("@/lib/audit");
  await logAudit({ actor, action: "settings.update", target: "site" });
  return next;
}

/** Client-safe view: everything except provider secrets. */
export function publicSettings(s: SiteSettings) {
  return {
    brand: s.brand,
    contact: s.contact,
    hours: s.hours,
    ordering: s.ordering,
    delivery: s.delivery,
    payments: {
      manual: s.payments.manual,
      paystack: { enabled: s.payments.paystack.enabled, publicKey: s.payments.paystack.publicKey },
      zenobank: { enabled: false },
    },
  };
}
