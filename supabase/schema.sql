-- Repllyer Supabase Schema
-- Run in Supabase SQL editor

-- Enable pgcrypto for hashes if needed
create extension if not exists "pgcrypto";

-- Businesses (1 per user for now)
create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  domain text,
  description text,
  webhook_url text,
  created_at timestamptz default now()
);

-- API keys (store hash only)
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  key_hash text not null unique,
  prefix text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- KB files metadata (file lives on gofile)
create table if not exists kb_files (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  gofile_id text not null,
  gofile_url text not null,
  filename text not null,
  mimetype text,
  size int,
  extracted_text text,
  created_at timestamptz default now()
);

-- Also keep a free-text KB chunk per business for quick prompt injection
create table if not exists knowledge_bases (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  raw_text text not null,
  created_at timestamptz default now()
);

-- End users (the customers chatting)
create table if not exists end_users (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz default now()
);

-- Sessions (closes on page reload by client discarding id; server expires after 30m idle)
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  end_user_id uuid not null references end_users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','expired')),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  role text not null check (role in ('user','assistant','human')),
  content text not null,
  created_at timestamptz default now()
);
create index if not exists messages_session_idx on messages(session_id, created_at);

-- Human handoff tickets
create table if not exists human_tickets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  priority text not null check (priority in ('urgent','high','medium','low')),
  topic text not null,
  status text not null default 'open' check (status in ('open','assigned','resolved')),
  ai_confidence numeric,
  ai_reason text,
  created_at timestamptz default now()
);
create index if not exists tickets_business_status_idx on human_tickets(business_id, status, priority);

-- Credits ledger (source of truth)
create table if not exists credits_ledger (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  delta int not null,
  reason text not null,
  balance_after int not null,
  created_at timestamptz default now()
);
create index if not exists credits_business_idx on credits_ledger(business_id, created_at desc);

-- RLS
alter table businesses enable row level security;
alter table api_keys enable row level security;
alter table kb_files enable row level security;
alter table knowledge_bases enable row level security;
alter table end_users enable row level security;
alter table sessions enable row level security;
alter table messages enable row level security;
alter table human_tickets enable row level security;
alter table credits_ledger enable row level security;

-- Policies: owner can manage own business rows (service_role bypasses RLS for API key auth)
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'owner_business') then
    create policy owner_business on businesses for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'owner_kb_files') then
    create policy owner_kb_files on kb_files for all using (business_id in (select id from businesses where owner_user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'owner_kb') then
    create policy owner_kb on knowledge_bases for all using (business_id in (select id from businesses where owner_user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'owner_tickets') then
    create policy owner_tickets on human_tickets for all using (business_id in (select id from businesses where owner_user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'owner_sessions') then
    create policy owner_sessions on sessions for all using (business_id in (select id from businesses where owner_user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'owner_messages') then
    create policy owner_messages on messages for all using (business_id in (select id from businesses where owner_user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'owner_credits') then
    create policy owner_credits on credits_ledger for select using (business_id in (select id from businesses where owner_user_id = auth.uid()));
  end if;
end $$;

-- Grant 180 credits on business creation
create or replace function grant_initial_credits()
returns trigger language plpgsql as $$
begin
  insert into credits_ledger (business_id, delta, reason, balance_after)
  values (new.id, 180, 'grant_initial', 180);
  return new;
end; $$;

drop trigger if exists trg_grant_initial on businesses;
create trigger trg_grant_initial after insert on businesses for each row execute function grant_initial_credits();

-- Coupons (percent off, redeemable at checkout)
create table if not exists coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  percent int not null check (percent > 0 and percent <= 90),
  max_uses int,
  uses int not null default 0,
  active boolean default true,
  expires_at timestamptz,
  created_at timestamptz default now()
);
alter table coupons enable row level security;
-- public read for validate (no RLS needed for checkout lookup via service_role)
-- Gift cards (prepaid credits)
create table if not exists giftcards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  credits int not null,
  redeemed boolean default false,
  redeemed_by uuid references businesses(id),
  created_at timestamptz default now()
);
alter table giftcards enable row level security;

-- Seed example coupons/giftcards (idempotent)
insert into coupons (code, percent, max_uses) values ('WELCOME10', 10, 100) on conflict (code) do nothing;
insert into coupons (code, percent, max_uses) values ('REPLLYER20', 20, 50) on conflict (code) do nothing;
insert into giftcards (code, credits) values ('GIFT-500', 500) on conflict (code) do nothing;
insert into giftcards (code, credits) values ('GIFT-1000', 1000) on conflict (code) do nothing;
