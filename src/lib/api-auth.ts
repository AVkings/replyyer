import { createHash } from "crypto";
import { createServiceClient } from "./supabase";

export function hashKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export async function verifyApiKey(rawKey: string) {
  if (!rawKey) return null;
  const hash = hashKey(rawKey);
  const supa = createServiceClient();
  const { data, error } = await supa
    .from("api_keys")
    .select("id, business_id, is_active")
    .eq("key_hash", hash)
    .maybeSingle();
  if (error || !data || !data.is_active) return null;
  return data as { id: string; business_id: string; is_active: boolean };
}

export function extractApiKey(req: Request): string | null {
  const h = req.headers.get("x-api-key") || req.headers.get("authorization")?.replace("Bearer ", "");
  return h?.trim() || null;
}
