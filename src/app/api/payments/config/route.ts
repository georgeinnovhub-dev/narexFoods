import { getSettings } from "@/lib/settings";
import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET /api/payments/config — client-safe payment configuration (no secrets). */
export async function GET() {
  const settings = await getSettings();
  return ok({
    manual: settings.payments.manual,
    paystack: {
      enabled: settings.payments.paystack.enabled && Boolean(process.env.PAYSTACK_SECRET_KEY),
      publicKey: settings.payments.paystack.enabled ? settings.payments.paystack.publicKey : "",
    },
    zenobank: { enabled: false }, // stays disabled until real integration docs + credentials exist (spec §7)
  });
}
