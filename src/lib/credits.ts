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

export async function consumeCredit(businessId: string, reason = "consume", amount = 1) {
  const supa = createServiceClient();
  // Atomic server-side: prevents race / negative balances / farming
  const { data, error } = await supa.rpc("consume_credits_atomic", {
    p_business_id: businessId,
    p_amount: amount,
    p_reason: `${reason}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
  });
  if (error) {
    const msg = error.message || "";
    if (msg.includes("insufficient_credits")) {
      const balance = await getBalance(businessId).catch(() => 0);
      return { ok: false, balance } as const;
    }
    throw error;
  }
  return { ok: true, balance: data as number } as const;
}

export async function consumeCreditsExact(businessId: string, amount: number, reason: string) {
  const supa = createServiceClient();
  const { data, error } = await supa.rpc("consume_credits_atomic", {
    p_business_id: businessId,
    p_amount: amount,
    p_reason: reason,
  });
  if (error) {
    if ((error.message || "").includes("insufficient_credits")) {
      const balance = await getBalance(businessId).catch(() => 0);
      return { ok: false, balance } as const;
    }
    throw error;
  }
  return { ok: true, balance: data as number } as const;
}

export async function grantCredits(businessId: string, amount: number, reason: string) {
  const supa = createServiceClient();
  // Idempotent: same reason never double-grants (see grant_credits_atomic + unique index)
  const { data, error } = await supa.rpc("grant_credits_atomic", {
    p_business_id: businessId,
    p_amount: amount,
    p_reason: reason,
  });
  if (error) throw error;
  return data as number;
}
