/**
 * Supabase Admin Client (SERVICE_ROLE)
 * ⚠️ SERVER ONLY — never import in Client Components.
 * Bypasses RLS — used for ingestion, chat RAG, tickets, widget API-key auth.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

export function createSupabaseAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. " +
        "This client is server-only — do not call from the browser."
    );
  }

  // Singleton to avoid creating multiple clients per request batch
  if (adminClient) return adminClient;

  adminClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}

// Alias for ergonomics
export const getSupabaseAdmin = createSupabaseAdminClient;
