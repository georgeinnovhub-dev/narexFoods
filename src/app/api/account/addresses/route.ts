import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, readJson, safeErrorLog } from "@/lib/api";
import { requireCustomer } from "@/lib/customers";
import type { SavedAddressDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

const schema = z.object({
  label: z.string().min(1).max(60),
  address: z.string().min(5).max(300),
  landmark: z.string().max(200).optional().or(z.literal("")),
  lat: z.string().max(40).optional().or(z.literal("")),
  lng: z.string().max(40).optional().or(z.literal("")),
  zoneName: z.string().max(80).optional().or(z.literal("")),
});

/** GET /api/account/addresses — saved addresses (owner-scoped). */
export async function GET() {
  const auth = await requireCustomer();
  if ("error" in auth) return fail(auth.error, auth.status);
  try {
    const rows = await db.savedAddress.findMany({
      where: { customerId: auth.session.customerId },
      orderBy: { createdAt: "desc" },
    });
    const addresses: SavedAddressDTO[] = rows.map((a) => ({
      id: a.id,
      label: a.label,
      address: a.address,
      landmark: a.landmark,
      lat: a.lat,
      lng: a.lng,
      zoneName: a.zoneName,
    }));
    return ok({ addresses });
  } catch (err) {
    safeErrorLog("account.addresses.GET", err);
    return fail("Could not load saved addresses.", 500);
  }
}

/** POST /api/account/addresses — save an address (owner-scoped, max 10). */
export async function POST(req: Request) {
  const auth = await requireCustomer();
  if ("error" in auth) return fail(auth.error, auth.status);
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Invalid address.", 422);
  try {
    const count = await db.savedAddress.count({ where: { customerId: auth.session.customerId } });
    if (count >= 10) return fail("You can save up to 10 addresses. Remove one to add another.", 409);
    const d = parsed.data;
    const saved = await db.savedAddress.create({
      data: {
        customerId: auth.session.customerId,
        label: d.label.trim(),
        address: d.address.trim(),
        landmark: d.landmark || null,
        lat: d.lat || null,
        lng: d.lng || null,
        zoneName: d.zoneName || null,
      },
    });
    const address: SavedAddressDTO = {
      id: saved.id,
      label: saved.label,
      address: saved.address,
      landmark: saved.landmark,
      lat: saved.lat,
      lng: saved.lng,
      zoneName: saved.zoneName,
    };
    return ok({ address }, { status: 201 });
  } catch (err) {
    safeErrorLog("account.addresses.POST", err);
    return fail("Could not save the address.", 500);
  }
}

/** DELETE /api/account/addresses?id= — remove a saved address (owner-scoped). */
export async function DELETE(req: Request) {
  const auth = await requireCustomer();
  if ("error" in auth) return fail(auth.error, auth.status);
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return fail("Address id is required.", 422);
  try {
    const existing = await db.savedAddress.findUnique({ where: { id } });
    if (!existing || existing.customerId !== auth.session.customerId) {
      // Same response either way — no existence leak across customers
      return fail("Address not found.", 404);
    }
    await db.savedAddress.delete({ where: { id } });
    return ok({ success: true });
  } catch (err) {
    safeErrorLog("account.addresses.DELETE", err);
    return fail("Could not remove the address.", 500);
  }
}
