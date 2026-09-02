-- Billing & conversation limits
create table if not exists public.organization_subscriptions (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  plan text not null check (plan in ('free','basic_300','basic_600','payg')) default 'free',
  conversation_limit int not null default 180,
  conversations_used int not null default 0,
  period_start timestamptz not null default now(),
  razorpay_order_id text,
  razorpay_payment_id text,
  updated_at timestamptz not null default now()
);
create index if not exists idx_sub_org on public.organization_subscriptions(organization_id);

create or replace function public.handle_billing_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_billing_updated_at on public.organization_subscriptions;
create trigger trg_billing_updated_at before update on public.organization_subscriptions for each row execute function public.handle_billing_updated_at();

alter table public.organization_subscriptions enable row level security;
do $$ declare r record; begin for r in (select policyname from pg_policies where schemaname='public' and tablename='organization_subscriptions') loop execute format('drop policy if exists %I on public.organization_subscriptions', r.policyname); end loop; end $$;
create policy "Service role full access on billing" on public.organization_subscriptions for all to service_role using (true) with check (true);
create policy "Authenticated read billing" on public.organization_subscriptions for select to authenticated using (true);

-- Helper to increment usage and check limit
create or replace function public.increment_conversation_usage(org_id uuid)
returns boolean language plpgsql as $$
declare
  sub record;
begin
  select * into sub from public.organization_subscriptions where organization_id = org_id;
  if not found then
    insert into public.organization_subscriptions(organization_id, plan, conversation_limit) values (org_id, 'free', 180);
    return true;
  end if;
  -- Reset if new month
  if sub.period_start < date_trunc('month', now()) then
    update public.organization_subscriptions set conversations_used = 1, period_start = date_trunc('month', now()) where organization_id = org_id;
    return true;
  end if;
  if sub.plan = 'payg' then
    update public.organization_subscriptions set conversations_used = conversations_used + 1 where organization_id = org_id;
    return true;
  end if;
  if sub.conversations_used >= sub.conversation_limit then
    return false;
  end if;
  update public.organization_subscriptions set conversations_used = conversations_used + 1 where organization_id = org_id;
  return true;
end; $$;
