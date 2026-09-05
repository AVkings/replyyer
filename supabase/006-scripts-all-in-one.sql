-- 006 Scripts + orders, ALL IN ONE. Run this single file and you're done.
-- Safe to run even if you never ran 003/004/005 (everything is IF NOT EXISTS).
-- Safe to re-run (idempotent).
--
-- What you get:
--  1. business_scripts  — client code/webhook scripts (code runs on Vercel, sandboxed)
--  2. script_runs        — audit log, 30 credits per run
--  3. orders             — Razorpay order tracking (fixes "order not found" after payment)
--  4. end_users.phone    — so the bot can save visitor phone numbers

-- end_users: add phone for reach-out
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='end_users' and column_name='phone') then
    alter table end_users add column phone text;
  end if;
end $$;

-- orders: track razorpay orders so webhook + verify can both grant safely
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  razorpay_order_id text not null unique,
  credits int not null check (credits > 0 and credits <= 100000),
  amount_paise int not null check (amount_paise >= 100),
  pack_id text not null,
  coupon text,
  discount_paise int not null default 0,
  status text not null default 'created' check (status in ('created','paid','failed')),
  created_at timestamptz default now()
);
create index if not exists orders_business_idx on orders(business_id, created_at desc);
alter table orders enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'owner_orders_select') then
    create policy owner_orders_select on orders for select using (business_id in (select id from businesses where owner_user_id = auth.uid()));
  end if;
end $$;

-- business_scripts: client-defined playground scripts.
-- action_type is ONLY 'code' (real JavaScript, runs sandboxed on Vercel)
-- or 'webhook' (POSTs out to the client's own server).
-- Secrets (Gmail, API keys...) live per-script in action_config.env — never shared.
create table if not exists business_scripts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  slug text not null,
  description text not null default '',
  trigger_keywords text not null default '',
  required_params text[] not null default '{email}',
  action_type text not null default 'code',
  action_config jsonb not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz default now(),
  unique(business_id, slug)
);
create index if not exists scripts_business_idx on business_scripts(business_id, is_active);
alter table business_scripts enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'owner_scripts') then
    create policy owner_scripts on business_scripts for all using (business_id in (select id from businesses where owner_user_id = auth.uid())) with check (business_id in (select id from businesses where owner_user_id = auth.uid()));
  end if;
end $$;

-- Convert any legacy send_email/mock rows into equivalent code scripts
update business_scripts
set action_type = 'code',
    action_config = jsonb_build_object(
      'language', 'javascript',
      'code', $$if (!params.email) throw new Error("email required");
sendEmail(params.email, "Your request", "Hi, your request was processed.");
result = { emailed: params.email };$$,
      'legacy', action_config
    )
where action_type in ('send_email', 'mock');

-- Lock action_type to code + webhook only
do $$ begin
  alter table business_scripts drop constraint if exists business_scripts_action_type_check;
  alter table business_scripts add constraint business_scripts_action_type_check
    check (action_type in ('code','webhook'));
end $$;

-- script_runs: audit log, 30 credits per execution
create table if not exists script_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  script_id uuid not null references business_scripts(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  message_id uuid references messages(id) on delete set null,
  params jsonb not null default '{}',
  result jsonb not null default '{}',
  credits_charged int not null default 30,
  created_at timestamptz default now(),
  unique(message_id, script_id)
);
create index if not exists script_runs_business_idx on script_runs(business_id, created_at desc);
alter table script_runs enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'owner_script_runs_select') then
    create policy owner_script_runs_select on script_runs for select using (business_id in (select id from businesses where owner_user_id = auth.uid()));
  end if;
end $$;
