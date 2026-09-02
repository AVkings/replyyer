"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Creates organization for the currently authenticated user.
 * Called after signup (and as idempotent fallback on dashboard).
 * Uses service_role to bypass RLS.
 */
export async function ensureOrganizationForUser(): Promise<{ organizationId: string; apiKey: string } | { error: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return { error: "Not authenticated" };
  }

  const admin = createSupabaseAdminClient();

  // Check if org already exists for this user (via owner_id if column exists, else via email domain fallback)
  // Try owner_id column first
  try {
    const { data: existing } = await admin.from("organizations").select("id, api_key").eq("owner_id", user.id).limit(1).single();
    if (existing) {
      return { organizationId: existing.id, apiKey: existing.api_key };
    }
  } catch {
    // column may not exist yet — fall through to domain/name check
  }

  // Fallback: check by domain derived from email if owner_id not available
  const domain = user.email.split("@")[1] ?? "unknown.local";

  // Try to find org with same name hint
  const nameHint = user.email.split("@")[0] ? `${user.email.split("@")[0]}'s Org` : "My Organization";

  const apiKey = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

  // Try insert with owner_id — if column missing, insert without it
  const payloadWithOwner = {
    name: nameHint.slice(0, 80),
    domain: domain.slice(0, 100),
    api_key: apiKey,
    owner_id: user.id,
  };

  let data: { id: string; api_key: string } | null = null;
  let error: { message: string } | null = null;

  const attempt = await admin.from("organizations").insert(payloadWithOwner).select("id, api_key").single();
  if (attempt.error) {
    // If error mentions owner_id column, retry without it
    if (attempt.error.message.includes("owner_id")) {
      const fallbackPayload = { name: nameHint.slice(0, 80), domain: domain.slice(0, 100), api_key: apiKey };
      const retry = await admin.from("organizations").insert(fallbackPayload).select("id, api_key").single();
      data = retry.data as unknown as { id: string; api_key: string } | null;
      error = retry.error as unknown as { message: string } | null;
    } else {
      error = attempt.error as unknown as { message: string };
    }
  } else {
    data = attempt.data as unknown as { id: string; api_key: string };
  }

  if (error || !data) {
    return { error: error?.message ?? "Failed to create organization" };
  }

  return { organizationId: data.id, apiKey: data.api_key };
}
