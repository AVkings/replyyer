-- ============================================
-- Repllyer — Phase 4 Migration
-- Run in Supabase SQL Editor AFTER Phase 1 schema
-- Adds owner_id linkage + tightened RLS for dashboard auth
-- ============================================

-- 1) Add owner_id to organizations (nullable for existing rows)
alter table public.organizations
  add column if not exists owner_id uuid references auth.users(id) on delete set null;

create index if not exists idx_org_owner on public.organizations(owner_id);

comment on column public.organizations.owner_id is 'Supabase auth user who owns this org (created on signup)';

-- 2) Backfill: if you had a demo org with no owner, leave it as is.
-- New orgs will have owner_id set via signup flow (admin insert).

-- 3) Helper: ensure one org per user (optional, not enforced as unique to allow multiples later)
-- create unique index if not exists uniq_org_owner_domain on public.organizations(owner_id, domain) where owner_id is not null;

-- 4) RLS: allow authenticated user to read their own orgs
-- We keep service_role full access (already) and add owner-scoped read
drop policy if exists "Authenticated can read own organizations" on public.organizations;
create policy "Authenticated can read own organizations"
  on public.organizations for select
  to authenticated
  using (owner_id = auth.uid() or owner_id is null);

-- Allow owner to update their own org (name/domain)
drop policy if exists "Owner can update own organization" on public.organizations;
create policy "Owner can update own organization"
  on public.organizations for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- 5) Knowledge bases, conversations, tickets: allow read via org ownership
-- These remain service_role full + authenticated read (broad). Tighten if you want strict isolation:
-- Example stricter version (commented, enable if you want isolation):
-- drop policy if exists "Owner read own knowledge" on public.knowledge_bases;
-- create policy "Owner read own knowledge"
--   on public.knowledge_bases for select to authenticated
--   using (exists (select 1 from public.organizations o where o.id = organization_id and o.owner_id = auth.uid()));

-- 6) Ensure updated_at trigger already exists (from phase 1) — no change
