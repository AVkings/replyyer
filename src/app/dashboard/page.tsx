import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureOrganizationForUser } from "@/lib/auth/actions";
import OverviewStats from "@/components/dashboard/OverviewStats";

export const dynamic = "force-dynamic";

async function getOverviewData() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createSupabaseAdminClient();

  // Ensure org exists (idempotent)
  await ensureOrganizationForUser().catch(() => {});

  // Try to find org for user (owner_id)
  let orgId: string | null = null;
  try {
    const { data } = await admin.from("organizations").select("id").eq("owner_id", user.id).limit(1).single();
    if (data) orgId = data.id;
  } catch {}

  if (!orgId) {
    const { data: first } = await admin.from("organizations").select("id").limit(1).single();
    orgId = first?.id ?? null;
  }

  if (!orgId) return { total: 0, autoResolved: 0, autoPct: 0, active: 0, orgId: null };

  const [{ count: total }, { count: autoResolved }, { count: active }] = await Promise.all([
    admin.from("tickets").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    admin.from("tickets").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "auto_resolved"),
    admin.from("conversations").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "active"),
  ]);

  const totalNum = total ?? 0;
  const autoNum = autoResolved ?? 0;
  const pct = totalNum > 0 ? Math.round((autoNum / totalNum) * 100) : 0;

  return { total: totalNum, autoResolved: autoNum, autoPct: pct, active: active ?? 0, orgId };
}

export default async function DashboardOverviewPage() {
  const data = await getOverviewData();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-neutral-500">Monochrome CRM. Real-time tickets & conversations.</p>
      </div>

      <OverviewStats
        total={data?.total ?? 0}
        autoPct={data?.autoPct ?? 0}
        autoResolved={data?.autoResolved ?? 0}
        active={data?.active ?? 0}
      />

      <div className="rounded-[24px] border border-neutral-800 bg-neutral-950 p-6">
        <h2 className="text-sm font-semibold tracking-tight">How it works</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            { k: "01", t: "Ingest", d: "Paste a URL in Settings → Knowledge. Scraped → chunked → embedded via Kira hy3." },
            { k: "02", t: "Chat", d: "Widget uses RAG + tool calling. Resolved → ticket auto_resolved." },
            { k: "03", t: "Triage", d: "Tickets sorted by priority 5→1. View chat, Take over." },
          ].map((s) => (
            <div key={s.k} className="rounded-2xl border border-neutral-800 bg-black p-4">
              <p className="text-xs font-mono text-neutral-500">{s.k}</p>
              <p className="mt-1 text-sm font-semibold text-white">{s.t}</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
