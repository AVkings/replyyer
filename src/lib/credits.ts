import { createServiceClient } from "./supabase";

export async function getBalance(businessId: string): Promise<number> {
  const supa = createServiceClient();
  const { data, error } = await supa
    .from("credits_ledger")
    .select("balance_after")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.balance_after ?? 0;
}

export async function consumeCredit(businessId: string, reason = "consume") {
  const supa = createServiceClient();
  // atomic via RPC if available, else simple read-then-write with check
  const balance = await getBalance(businessId);
  if (balance <= 0) return { ok: false, balance } as const;

  const { data, error } = await supa
    .from("credits_ledger")
    .insert({
      business_id: businessId,
      delta: -1,
      reason,
      balance_after: balance - 1,
    })
    .select("balance_after")
    .single();
  if (error) throw error;
  return { ok: true, balance: data.balance_after } as const;
}

export async function grantCredits(businessId: string, amount: number, reason: string) {
  const supa = createServiceClient();
  const balance = await getBalance(businessId);
  const { data, error } = await supa
    .from("credits_ledger")
    .insert({
      business_id: businessId,
      delta: amount,
      reason,
      balance_after: balance + amount,
    })
    .select("balance_after")
    .single();
  if (error) throw error;
  return data.balance_after;
}
