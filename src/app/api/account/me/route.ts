import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, readJson, safeErrorLog } from "@/lib/api";
import { requireCustomer } from "@/lib/customers";
import type { AccountMeResponse, SavedAddressDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/account/me — profile + saved addresses (owner-scoped, spec §16). */
export async function GET() {
  const auth = await requireCustomer();
  if ("error" in auth) return fail(auth.error, auth.status);
  try {
    const customer = await db.customer.findUnique({
      where: { id: auth.session.customerId },
      include: { addresses: { orderBy: { createdAt: "desc" } } },
    });
    if (!customer) return fail("Account not found.", 404);
    const addresses: SavedAddressDTO[] = customer.addresses.map((a) => ({
      id: a.id,
      label: a.label,
      address: a.address,
      landmark: a.landmark,
      lat: a.lat,
      lng: a.lng,
      zoneName: a.zoneName,
    }));
    const response: AccountMeResponse = {
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      },
      addresses,
    };
    return ok(response);
  } catch (err) {
    safeErrorLog("account.me.GET", err);
    return fail("Could not load your account.", 500);
  }
}

const patchSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  phone: z.string().min(9).max(15).regex(/^[0-9+\s-]+$/, "Enter a valid phone number").optional(),
});

/** PATCH /api/account/me — update profile (owner-scoped). */
export async function PATCH(req: Request) {
  const auth = await requireCustomer();
  if ("error" in auth) return fail(auth.error, auth.status);
  const parsed = patchSchema.safeParse(await readJson(req));
  if (!parsed.success) return fail("Invalid profile update.", 422);
  try {
    const customer = await db.customer.update({
      where: { id: auth.session.customerId },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name.trim() } : {}),
        ...(parsed.data.phone ? { phone: parsed.data.phone.replace(/\s/g, "") } : {}),
      },
    });
    return ok({
      customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone },
    });
  } catch (err) {
    safeErrorLog("account.me.PATCH", err);
    return fail("Could not update your profile.", 500);
  }
}
