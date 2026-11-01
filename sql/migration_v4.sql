-- Ma bibliothèque : migration V4 (Supabase > SQL Editor > New query > Run)
-- Séries de comics / livres / BD / manga, avec leur statut, et lien de chaque tome vers sa série.

create table if not exists public.series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  status text not null default 'en_cours' check (status in ('en_cours', 'terminee')),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.items
  add column if not exists series_id uuid references public.series(id) on delete set null,  -- supprimer une série ne supprime pas les tomes
  add column if not exists volume numeric(6,1);                                              -- n° de tome (1, 2, 2.5…)

create index if not exists items_series_idx on public.items (series_id);

alter table public.series enable row level security;
drop policy if exists "owner_all_series" on public.series;
create policy "owner_all_series" on public.series
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
