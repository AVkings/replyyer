import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import ChatboxCustomizer from "@/components/dashboard/ChatboxCustomizer";

export const dynamic = "force-dynamic";

export default async function ChatboxPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient();
  let org: { id: string; api_key: string } | null = null;
  const { data: owned } = await admin.from("organizations").select("id, api_key").eq("owner_id", user.id).maybeSingle();
  if (owned) org = owned;
  else {
    const { data: anyOrg } = await admin.from("organizations").select("id, api_key").limit(1).maybeSingle();
    if (anyOrg) org = anyOrg;
  }
  if (!org) return <div className="p-6 text-sm text-neutral-500">No organization found</div>;
  const { data: cfg } = await admin.from("chatbox_configs").select("config").eq("organization_id", org.id).maybeSingle();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Chat Box</h1>
        <p className="mt-1 text-sm text-neutral-500">Customize your AI chat widget — generate a link + HTML you can drop in any site and it just works.</p>
      </div>
      <ChatboxCustomizer orgId={org.id} apiKey={org.api_key} initialConfig={cfg?.config as never} />
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
        <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">How to embed</p>
        <ol className="mt-2 list-decimal pl-5 text-xs leading-relaxed text-neutral-400">
          <li>Customize colors/title above → <b className="text-white">Save</b></li>
          <li>Copy the <b className="text-white">Iframe</b> or <b className="text-white">Script</b> code</li>
          <li>Paste in your site's <code className="rounded border border-neutral-800 bg-black px-1 text-white">&lt;body&gt;</code> (before <code className="rounded border border-neutral-800 bg-black px-1 text-white">&lt;/body&gt;</code>)</li>
          <li>Deploy your site — widget appears at <code className="rounded border border-neutral-800 bg-black px-1 text-white">{`bottom-${(cfg?.config as { position?: string })?.position?.includes('left') ? 'left' : 'right'}`}</code> with your exact UI + JS working, CORS * enabled.</li>
        </ol>
      </div>
    </div>
  );
}
