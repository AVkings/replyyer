import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import PricingClient from "@/components/pricing/PricingClient";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient();
  const { data: org } = await admin.from("organizations").select("id").eq("owner_id", user.id).maybeSingle();
  const orgId = org?.id || (await admin.from("organizations").select("id").limit(1).maybeSingle()).data?.id;
  let sub: { plan: string; conversation_limit: number; conversations_used: number } | null = null;
  if (orgId) {
    const { data } = await admin.from("organization_subscriptions").select("plan, conversation_limit, conversations_used").eq("organization_id", orgId).maybeSingle();
    if (data) sub = data;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-neutral-500">Free 180, Basic 300 $3, Pro 600 $5, Pay as you go. Current usage for your org.</p>
      </div>
      <div className="rounded-[20px] border border-neutral-800 bg-neutral-950 p-6">
        <p className="text-xs uppercase tracking-widest text-neutral-500">Current plan</p>
        <p className="mt-1 text-lg font-semibold text-white">{sub ? `${sub.plan} — ${sub.conversations_used}/${sub.conversation_limit}` : "Free — 0/180 (default)"}</p>
        <p className="text-xs text-neutral-600">Resets monthly. Pay as you go never blocks.</p>
      </div>
      <PricingClient />
      <div className="rounded-xl border border-neutral-800 bg-black p-4">
        <p className="text-xs text-neutral-500">Org ID: <code className="rounded bg-neutral-950 px-1 text-white">{orgId ?? "unknown"}</code> — use this at checkout.</p>
      </div>
    </div>
  );
}
