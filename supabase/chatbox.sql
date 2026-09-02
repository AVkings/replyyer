-- Chatbox customizer configs
create table if not exists public.chatbox_configs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade unique,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_chatbox_org on public.chatbox_configs(organization_id);

-- Trigger to update updated_at
create or replace function public.handle_chatbox_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_chatbox_updated_at on public.chatbox_configs;
create trigger trg_chatbox_updated_at before update on public.chatbox_configs for each row execute function public.handle_chatbox_updated_at();

-- RLS
alter table public.chatbox_configs enable row level security;
do $$ declare r record; begin for r in (select policyname from pg_policies where schemaname='public' and tablename='chatbox_configs') loop execute format('drop policy if exists %I on public.chatbox_configs', r.policyname); end loop; end $$;
create policy "Service role full access on chatbox_configs" on public.chatbox_configs for all to service_role using (true) with check (true);
create policy "Authenticated read chatbox_configs" on public.chatbox_configs for select to authenticated using (true);

-- Example: select * from public.chatbox_configs where organization_id = '0bb77f3b-a2d8-4401-8590-624f54194a81';
