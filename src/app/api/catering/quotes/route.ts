import { randomBytes } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, readJson, rateLimit, clientKey, safeErrorLog } from "@/lib/api";
import { getSettings } from "@/lib/settings";
import { notify } from "@/lib/outbox";
import type { CreateQuoteResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

const SERVICE_TYPES = [
  "staff_meals",
  "family_group",
  "meetings",
  "conference",
  "party",
  "canteen",
  "recurring",
  "custom",
] as const;

const schema = z.object({
  name: z.string().min(2).max(80),
  phone: z.string().min(9).max(15).regex(/^[0-9+\s-]+$/, "Enter a valid phone number"),
  email: z.string().email().max(120).optional().or(z.literal("")),
  organization: z.string().max(120).optional().or(z.literal("")),
  serviceType: z.enum(SERVICE_TYPES).default("custom"),
  people: z.number().int().min(1).max(5000),
  mealsPerPerson: z.number().int().min(1).max(10).default(1),
  eventDate: z.string().max(10).optional().or(z.literal("")),
  eventTime: z.string().max(40).optional().or(z.literal("")),
  venue: z.string().max(200).optional().or(z.literal("")),
  items: z
    .array(z.object({ label: z.string().min(1).max(120), qty: z.number().int().min(1).max(1000), note: z.string().max(200).optional() }))
    .max(20)
    .default([]),
  message: z.string().max(1000).optional().or(z.literal("")),
});

function quoteReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let ref = "";
  for (const b of bytes) ref += alphabet[b % alphabet.length];
  return `QT-${ref}`;
}

/** POST /api/catering/quotes — public catering & service-package quotation request (spec §8). */
export async function POST(req: Request) {
  if (!rateLimit(clientKey(req, "quote"), 5, 60_000)) {
    return fail("Too many requests. Please wait a moment.", 429);
  }
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message || "Please complete the quotation form.", 422);
  }
  const data = parsed.data;

  try {
    const settings = await getSettings();
    if (!settings.catering.enabled) {
      return fail("Catering requests are paused right now. Please contact us on WhatsApp instead.", 409);
    }

    const reference = quoteReference();
    await db.cateringQuote.create({
      data: {
        reference,
        name: data.name.trim(),
        phone: data.phone.replace(/\s/g, ""),
        email: data.email || null,
        organization: data.organization || null,
        serviceType: data.serviceType,
        people: data.people,
        mealsPerPerson: data.mealsPerPerson,
        eventDate: data.eventDate || null,
        eventTime: data.eventTime || null,
        venue: data.venue || null,
        items: JSON.stringify(data.items),
        message: data.message || null,
        status: "pending",
      },
    });

    await notify({
      type: "alert",
      subject: `New catering quote request ${reference} — ${data.people} people`,
      payload: { reference, people: data.people, serviceType: data.serviceType },
    });

    const response: CreateQuoteResponse = {
      reference,
      message: "We have received your request. Our catering team will reach out within 24 hours with a tailored quotation.",
    };
    return ok(response, { status: 201 });
  } catch (err) {
    safeErrorLog("quotes.POST", err);
    return fail("We could not submit your request. Please try again or reach us on WhatsApp.", 500);
  }
}
