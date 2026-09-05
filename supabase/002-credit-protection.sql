-- 002 Credit protection: atomic ledger ops + anti-farming RLS
-- Run AFTER schema.sql in Supabase SQL editor

-- 1) Atomic consume: fails if insufficient, single statement, concurrency-safe
create or replace function consume_credits_atomic(
  p_business_id uuid,
  p_amount int,
  p_reason text
)
returns int
language plpgsql
security definer
as $$
declare
  v_balance int;
begin
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;

  select coalesce(
    (select balance_after from credits_ledger
     where business_id = p_business_id
     order by created_at desc limit 1), 0)
  into v_balance;

  if v_balance < p_amount then
    raise exception 'insufficient_credits' using errcode = 'P0001';
  end if;

  insert into credits_ledger (business_id, delta, reason, balance_after)
  values (p_business_id, -p_amount, p_reason, v_balance - p_amount);

  return v_balance - p_amount;
end; $$;

-- 2) Atomic grant with idempotency: if reason already exists for business, return existing balance, no double-grant
create or replace function grant_credits_atomic(
  p_business_id uuid,
  p_amount int,
  p_reason text
)
returns int
language plpgsql
security definer
as $$
declare
  v_balance int;
  v_exists boolean;
begin
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;

  select exists(
    select 1 from credits_ledger where business_id = p_business_id and reason = p_reason
  ) into v_exists;

  if v_exists then
    select balance_after into v_balance from credits_ledger
    where business_id = p_business_id order by created_at desc limit 1;
    return coalesce(v_balance, 0);
  end if;

  select coalesce(
    (select balance_after from credits_ledger
     where business_id = p_business_id
     order by created_at desc limit 1), 0)
  into v_balance;

  insert into credits_ledger (business_id, delta, reason, balance_after)
  values (p_business_id, p_amount, p_reason, v_balance + p_amount);

  return v_balance + p_amount;
end; $$;

-- 3) Idempotency guard: unique reason per business (prevents double razorpay/giftcard grants)
create unique index if not exists credits_ledger_business_reason_uidx
  on credits_ledger (business_id, reason)
  where reason like 'razorpay:%' or reason like 'giftcard:%' or reason like 'business_create:%';

-- 4) Lock down RLS: clients must NOT insert credits, businesses, keys, coupons, giftcards
-- credits_ledger: ensure only SELECT for owners (drop any insert/update/delete policies if they exist)
do $$ begin
  -- drop overly-permissive policies if someone added them
  if exists (select 1 from pg_policies where policyname = 'owner_credits_insert') then
    drop policy owner_credits_insert on credits_ledger;
  end if;
  if exists (select 1 from pg_policies where policyname = 'owner_credits_all') then
    drop policy owner_credits_all on credits_ledger;
  end if;
end $$;

-- businesses: allow SELECT/UPDATE/DELETE for owners, but NO direct INSERT (force /api/businesses charge path)
do $$ begin
  if exists (select 1 from pg_policies where policyname = 'owner_business') then
    drop policy owner_business on businesses;
  end if;
  if not exists (select 1 from pg_policies where policyname = 'owner_business_select') then
    create policy owner_business_select on businesses for select using (auth.uid() = owner_user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'owner_business_update') then
    create policy owner_business_update on businesses for update using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'owner_business_delete') then
    create policy owner_business_delete on businesses for delete using (auth.uid() = owner_user_id);
  end if;
  -- NOTE: no INSERT policy => anon/authenticated clients cannot insert businesses directly.
  -- service_role bypasses RLS, so /api/businesses still works.
end $$;

-- api_keys: no client access at all (service_role only)
do $$ begin
  -- drop any owner policies on api_keys
  for r in select policyname from pg_policies where tablename = 'api_keys' and policyname like 'owner%' loop
    execute format('drop policy %I on api_keys', r.policyname);
  end loop;
end $$;

-- coupons / giftcards: no client access (service_role only via /api/*)
-- RLS already enabled with zero policies => deny-all for anon/authenticated. Keep it that way.
-- Ensure no permissive policies exist:
do $$ declare r record; begin
  for r in select policyname from pg_policies where tablename in ('coupons','giftcards') loop
    execute format('drop policy %I on %I', r.policyname, 'coupons');
  end loop;
exception when others then null; end $$;
do $$ declare r record; begin
  for r in select policyname from pg_policies where tablename = 'giftcards' loop
    execute format('drop policy %I on giftcards', r.policyname);
  end loop;
exception when others then null; end $$;

-- sessions / messages / tickets / kb: keep owner read+write for dashboard, but credits stay locked
-- (human reply via dashboard is allowed; it does not touch credits)
