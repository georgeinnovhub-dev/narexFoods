import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { fail, safeErrorLog } from "@/lib/api";
import { requireStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

const UPLOAD_DIR = path.join(process.cwd(), "public", "images", "uploads");
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

/** POST /api/admin/uploads — staff image upload for products/blog/campaigns/hero (validated). */
export async function POST(req: Request) {
  const auth = await requireStaff("content.manage");
  if ("error" in auth) return fail(auth.error, auth.status);
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") return fail("No file provided.", 422);
    if (file.size > MAX_SIZE) return fail("File too large (max 5MB).", 422);
    const ext = ALLOWED.get(file.type);
    if (!ext) return fail("Only JPG, PNG or WEBP images are accepted.", 422);

    const bytes = Buffer.from(await file.arrayBuffer());
    const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
    const isWebp = bytes.subarray(0, 4).toString("ascii") === "RIFF";
    if (!isJpg && !isPng && !isWebp) return fail("The file is not a valid image.", 422);

    await mkdir(UPLOAD_DIR, { recursive: true });
    const name = `${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
    await writeFile(path.join(UPLOAD_DIR, name), bytes);
    return Response.json({ url: `/images/uploads/${name}` });
  } catch (err) {
    safeErrorLog("admin.uploads", err);
    return fail("Upload failed.", 500);
  }
}
