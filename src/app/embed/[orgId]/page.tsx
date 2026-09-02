import AIChatWidget from "@/components/chat/AIChatWidget";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function EmbedPage({ params, searchParams }: { params: { orgId: string }; searchParams: { api_key?: string } }) {
  const orgId = params.orgId;
  const apiKey = searchParams.api_key || undefined;
  const admin = createSupabaseAdminClient();
  const { data: cfg } = await admin.from("chatbox_configs").select("config").eq("organization_id", orgId).maybeSingle();
  const config = cfg?.config as { headerTitle?: string; headerSubtitle?: string; welcomeMessage?: string } | null;

  return (
    <div className="min-h-screen bg-black p-2 flex items-center justify-center">
      <AIChatWidget organizationId={orgId} apiKey={apiKey} variant="inline" defaultOpen title={config?.headerTitle || "Repllyer Support"} subtitle={config?.headerSubtitle || "AI • Replies instantly"} />
    </div>
  );
}
