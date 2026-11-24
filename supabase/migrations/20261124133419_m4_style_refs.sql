-- M4: the hairstyle knowledge base (RAG) + similarity search.
create extension if not exists vector with schema extensions;

create table if not exists public.style_refs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  category    text not null check (category in ('cut','color','perm','beard')),
  description text not null,             -- the text that gets embedded
  embedding   extensions.vector(1536),   -- filled by /api/ai/autofill (text-embedding-3-small)
  created_at  timestamptz not null default now()
);

create index if not exists idx_style_refs_embedding
  on public.style_refs using hnsw (embedding extensions.vector_cosine_ops);

alter table public.style_refs enable row level security;

-- Anyone may read the knowledge base. No insert/update/delete policy: only the server writes it.
create policy "style_refs_select_all" on public.style_refs
  for select using (true);

-- Cosine similarity search: the "retrieval" step of RAG.
create or replace function public.match_style_refs(
  query_embedding extensions.vector(1536),
  match_count int default 3
)
returns table (id uuid, name text, category text, description text, similarity float)
language sql stable
set search_path = public, extensions
as $$
  select r.id, r.name, r.category, r.description,
         1 - (r.embedding <=> query_embedding) as similarity
  from public.style_refs r
  where r.embedding is not null
  order by r.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 10);
$$;

revoke execute on function public.match_style_refs(extensions.vector, int) from public, anon, authenticated;
grant execute on function public.match_style_refs(extensions.vector, int) to service_role;
