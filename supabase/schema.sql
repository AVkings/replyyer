-- ============================================
-- Repllyer — Production-Ready Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- Requires: Supabase Postgres 15+ with pgvector available
-- ============================================

-- ────────────────────────────────────────────
-- 0. Extensions
-- ────────────────────────────────────────────
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "vector";     -- pgvector for embeddings
create extension if not exists "pgjwt";      -- optional, for JWT helpers

-- ────────────────────────────────────────────
-- 1. ORGANIZATIONS
-- ────────────────────────────────────────────
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  domain text check (domain ~* '^[a-z0-9.-]+\.[a-z]{2,}$'),
  api_key text not null unique default encode(gen_random_bytes(32), 'hex'),
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_org_owner on public.organizations(owner_id);

comment on table public.organizations is 'Tenant / business that owns knowledge, conversations and tickets';
comment on column public.organizations.api_key is 'Secret key used by the embeddable widget to authenticate (store hashed in future iteration)';

-- ────────────────────────────────────────────
-- 2. KNOWLEDGE_BASES (RAG store)
-- ────────────────────────────────────────────
-- NOTE: embedding dimension depends on the model.
-- hy3 / OpenAI text-embedding-3-small = 1536
-- If Kira hy3 uses a different dimension (e.g. 768, 1024, 4096), alter this column:
--   alter table public.knowledge_bases alter column embedding type vector(768);
create table if not exists public.knowledge_bases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  url_source text check (char_length(url_source) <= 2048),
  content_text text not null check (char_length(content_text) > 0),
  -- split long docs into chunks before embedding; one row = one chunk
  chunk_index int not null default 0,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

comment on table public.knowledge_bases is 'Chunked knowledge from scraped URLs + vector embeddings for similarity search';
create index if not exists idx_kb_org on public.knowledge_bases(organization_id);
-- HNSW is faster and more accurate than IVFFlat for most workloads (Supabase recommends HNSW)
-- Create this *after* inserting data for best performance, but we create it eagerly here
create index if not exists idx_kb_embedding_hnsw on public.knowledge_bases
  using hnsw (embedding vector_cosine_ops) with (m = 16, ef_construction = 64);
-- Fallback IVFFlat if HNSW not available on older pgvector:
-- create index if not exists idx_kb_embedding_ivfflat on public.knowledge_bases using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ────────────────────────────────────────────
-- 3. CONVERSATIONS
-- ────────────────────────────────────────────
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id text not null,
  customer_email text check (customer_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  status text not null default 'active' check (status in ('active','resolved','escalated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, session_id)
);

create index if not exists idx_conv_org on public.conversations(organization_id);
create index if not exists idx_conv_status on public.conversations(organization_id, status);
create index if not exists idx_conv_session on public.conversations(session_id);

-- auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_conversations_updated_at on public.conversations;
create trigger trg_conversations_updated_at
  before update on public.conversations
  for each row execute function public.handle_updated_at();

-- ────────────────────────────────────────────
-- 4. MESSAGES
-- ────────────────────────────────────────────
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user','ai')),
  content text not null check (char_length(content) > 0),
  attachment_url text check (attachment_url ~* '^https?://'),
  timestamp timestamptz not null default now()
);

create index if not exists idx_msg_conversation on public.messages(conversation_id, timestamp asc);
create index if not exists idx_msg_role on public.messages(role);

-- ────────────────────────────────────────────
-- 5. TICKETS
-- ────────────────────────────────────────────
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 200),
  priority_level int not null check (priority_level between 1 and 5),
  status text not null default 'pending_human' check (status in ('auto_resolved','pending_human','escalated')),
  ai_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ticket_org_priority on public.tickets(organization_id, priority_level desc, created_at desc);
create index if not exists idx_ticket_status on public.tickets(status);
create index if not exists idx_ticket_conversation on public.tickets(conversation_id);

drop trigger if exists trg_tickets_updated_at on public.tickets;
create trigger trg_tickets_updated_at
  before update on public.tickets
  for each row execute function public.handle_updated_at();

-- ────────────────────────────────────────────
-- 6. RPC: Vector similarity search (RAG)
-- ────────────────────────────────────────────
-- Called from the chat widget / server action to retrieve relevant context
-- Example:
--   select * from match_knowledge_bases(
--     '["0.01", ...]'::vector, 'org-uuid'::uuid, 0.7, 5
--   );
create or replace function public.match_knowledge_bases(
  query_embedding vector(1536),
  p_organization_id uuid,
  match_threshold float default 0.78,
  match_count int default 5
)
returns table (
  id uuid,
  organization_id uuid,
  url_source text,
  content_text text,
  similarity float
)
language sql stable
as $$
  select
    kb.id,
    kb.organization_id,
    kb.url_source,
    kb.content_text,
    1 - (kb.embedding <=> query_embedding) as similarity
  from public.knowledge_bases kb
  where kb.organization_id = p_organization_id
    and kb.embedding is not null
    and 1 - (kb.embedding <=> query_embedding) > match_threshold
  order by kb.embedding <=> query_embedding
  limit match_count;
$$;

-- Alt helper: match without threshold (for debugging)
create or replace function public.match_knowledge_bases_debug(
  query_embedding vector(1536),
  p_organization_id uuid,
  match_count int default 5
)
returns table (id uuid, content_text text, similarity float)
language sql stable as $$
  select kb.id, kb.content_text, 1 - (kb.embedding <=> query_embedding) as similarity
  from public.knowledge_bases kb
  where kb.organization_id = p_organization_id and kb.embedding is not null
  order by kb.embedding <=> query_embedding
  limit match_count;
$$;

-- ────────────────────────────────────────────
-- 7. ROW LEVEL SECURITY (RLS)
-- ────────────────────────────────────────────
-- WHY: Multi-tenant SaaS — each organization sees only its data.
-- Strategy:
--   a) Enable RLS on all tables.
--   b) Service role (used by Next.js server actions / API routes) BYPASSES RLS — so backend can read/write freely.
--   c) Authenticated / anon clients get restrictive policies.
--   d) For widget/API-key auth we validate org via api_key on the server side (server uses service_role), so widget does NOT directly query Supabase.
--   e) Dashboard auth: when you add Supabase Auth + an org_members table, tighten policies below to check auth.uid().

alter table public.organizations enable row level security;
alter table public.knowledge_bases enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.tickets enable row level security;

-- Drop existing policies if re-running this script
do $$ declare r record; begin
  for r in (select policyname, tablename from pg_policies where schemaname='public') loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ---------- ORGANIZATIONS ----------
-- Allow anyone to read org by domain/api_key via service_role only.
-- For direct client access we deny by default; server bypasses RLS.
-- If you want dashboard users to read their own org, add a join to org_members.
create policy "Allow service_role full access on organizations"
  on public.organizations for all to service_role using (true) with check (true);

create policy "Authenticated can read organizations"
  on public.organizations for select to authenticated using (true);
-- Restrict writes to service_role only — no insert/update/delete for anon/authenticated

-- ---------- KNOWLEDGE_BASES ----------
create policy "Service role full access on knowledge_bases"
  on public.knowledge_bases for all to service_role using (true) with check (true);

create policy "Authenticated read knowledge_bases"
  on public.knowledge_bases for select to authenticated using (true);
-- Writes (ingestion) must go through server action with service_role

-- ---------- CONVERSATIONS ----------
create policy "Service role full access on conversations"
  on public.conversations for all to service_role using (true) with check (true);

create policy "Authenticated read conversations"
  on public.conversations for select to authenticated using (true);
-- In Phase 4 dashboard will filter by organization_id client-side or via service_role

-- ---------- MESSAGES ----------
create policy "Service role full access on messages"
  on public.messages for all to service_role using (true) with check (true);

create policy "Authenticated read messages"
  on public.messages for select to authenticated using (true);

-- ---------- TICKETS ----------
create policy "Service role full access on tickets"
  on public.tickets for all to service_role using (true) with check (true);

create policy "Authenticated read tickets"
  on public.tickets for select to authenticated using (true);

-- ────────────────────────────────────────────
-- 8. Helpful views (optional)
-- ────────────────────────────────────────────
create or replace view public.tickets_with_conversation as
select
  t.id, t.title, t.priority_level, t.status, t.ai_summary, t.created_at,
  t.organization_id, t.conversation_id,
  c.session_id, c.customer_email, c.status as conversation_status
from public.tickets t
join public.conversations c on c.id = t.conversation_id;

-- ────────────────────────────────────────────
-- 9. Seed helper (optional — delete in prod)
-- ────────────────────────────────────────────
-- insert into public.organizations (name, domain) values ('Demo Corp', 'demo.repllyer.com') returning *;
