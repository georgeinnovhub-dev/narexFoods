import { ok } from "@/lib/api";
import { SESSION_COOKIE } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSession();
  if (session) await logAudit({ actor: session.name, actorId: session.staffId, action: "auth.logout" });
  const res = ok({ success: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
