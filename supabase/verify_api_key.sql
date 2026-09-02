-- ============================================
-- Repllyer — API Key Verification for Widget
-- Run this in Supabase Dashboard → SQL Editor
-- Ensures only valid organizationId + api_key can chat/upload
-- ============================================

-- 1. Ensure api_key is indexed and unique (already unique via schema, but ensure index exists)
create unique index if not exists idx_organizations_api_key on public.organizations(api_key);
create index if not exists idx_organizations_id_api_key on public.organizations(id, api_key);

-- 2. Helper function to verify api_key for an organization
-- Usage: SELECT public.verify_api_key('0bb77f3b-a2d8-4401-8590-624f54194a81', '467d98266aac4ce585b7049e9f469125d25b8594a7e8440fb698f902cf810fb8');
create or replace function public.verify_api_key(org_id uuid, provided_key text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organizations
    where id = org_id
      and api_key = provided_key
  );
$$;

comment on function public.verify_api_key is 'Returns true if api_key matches organization id — used by API routes to gate widget access';

-- 3. Optional: RLS tightening — keep service_role full, but ensure anon cannot read api_key
-- (Already: anon has no select on organizations via RLS, only service_role)
-- Verify:
-- select * from pg_policies where tablename = 'organizations';

-- 4. Test with your org (should return true):
-- select public.verify_api_key('0bb77f3b-a2d8-4401-8590-624f54194a81', '467d98266aac4ce585b7049e9f469125d25b8594a7e8440fb698f902cf810fb8') as is_valid; -- true
-- select public.verify_api_key('0bb77f3b-a2d8-4401-8590-624f54194a81', 'wrong-key') as is_valid; -- false
-- select public.verify_api_key('00000000-0000-0000-0000-000000000000', '467d98266aac4ce585b7049e9f469125d25b8594a7e8440fb698f902cf810fb8') as is_valid; -- false

-- 5. Check your org:
-- select id, name, domain, api_key, owner_id from public.organizations where id = '0bb77f3b-a2d8-4401-8590-624f54194a81';

-- 6. Rotate API key if needed (generates new random hex):
-- update public.organizations set api_key = encode(gen_random_bytes(32), 'hex') where id = '0bb77f3b-a2d8-4401-8590-624f54194a81' returning api_key;
