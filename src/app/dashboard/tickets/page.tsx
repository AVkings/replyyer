import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import TicketsClient from "@/components/dashboard/TicketsClient";

export const dynamic = "force-dynamic";

async function getTickets() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const admin = createSupabaseAdminClient();

  // Resolve org
  let orgId: string | null = null;
  try {
    const { data } = await admin.from("organizations").select("id").eq("owner_id", user.id).limit(1).single();
    if (data) orgId = data.id;
  } catch {}
  if (!orgId) {
    const { data: first } = await admin.from("organizations").select("id").limit(1).single();
    orgId = first?.id ?? null;
  }
  if (!orgId) return [];

  const { data, error } = await admin
    .from("tickets")
    .select("id, title, ai_summary, priority_level, status, created_at, conversation_id, organization_id")
    .eq("organization_id", orgId)
    .order("priority_level", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[tickets] fetch error", error.message);
    return [];
  }
  return data ?? [];
}

export default async function TicketsPage() {
  const tickets = await getTickets();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ticket Inbox</h1>
          <p className="mt-1 text-sm text-neutral-500">Sorted by priority 5 → 1. Auto-resolved first.</p>
        </div>
        <span className="rounded-full border border-neutral-800 bg-neutral-950 px-3 py-1 text-xs text-neutral-400">{tickets.length} tickets</span>
      </div>

      <TicketsClient tickets={tickets} />
    </div>
  );
}
