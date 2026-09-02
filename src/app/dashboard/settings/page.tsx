import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureOrganizationForUser } from "@/lib/auth/actions";
import SettingsClient from "@/components/dashboard/SettingsClient";

export const dynamic = "force-dynamic";

async function getOrg() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  await ensureOrganizationForUser().catch(() => {});
  const admin = createSupabaseAdminClient();

  let org: { id: string; name: string; domain: string | null; api_key: string } | null = null;

  try {
    const { data } = await admin.from("organizations").select("id, name, domain, api_key").eq("owner_id", user.id).order("created_at").limit(1).single();
    if (data) org = data;
  } catch {}

  if (!org) {
    const { data } = await admin.from("organizations").select("id, name, domain, api_key").order("created_at").limit(1).single();
    org = data as typeof org;
  }

  return { org, email: user.email };
}

export default async function SettingsPage() {
  const data = await getOrg();

  if (!data?.org) {
    return (
      <div className="rounded-[24px] border border-neutral-800 bg-neutral-950 p-8 text-center">
        <p className="text-sm text-neutral-500">No organization found. Try signing out and back in.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-neutral-500">Organization, API key, and knowledge ingestion.</p>
      </div>

      <SettingsClient org={data.org} email={data.email ?? ""} />
    </div>
  );
}
