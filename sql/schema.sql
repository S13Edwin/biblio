-- Ma bibliothèque : schéma V1 (à coller dans Supabase > SQL Editor > Run)

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  category text not null check (category in
    ('comics_vf','comics_vo','bd','livre','manga','vinyle','cd','dvd')),
  title text not null,                 -- titre, ou nom de l'album
  authors text[] not null default '{}',-- auteurs (ou artistes pour CD/vinyles)
  illustrators text[] not null default '{}', -- dessinateurs
  collection text,
  publisher text,
  price numeric(8,2),
  cover_url text,
  owned boolean not null default true,      -- possédé physiquement
  wishlist boolean not null default false,  -- à acheter
  read_status text not null default 'non_commence'
    check (read_status in ('non_commence','en_cours','termine')),
  finished_on date,
  format text,                         -- DVD, Blu-ray, 4K (DVD/Blu-ray)
  created_at timestamptz not null default now()
);

alter table public.items enable row level security;

create policy "owner_all" on public.items
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Stockage des couvertures
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true) on conflict do nothing;

create policy "covers_read" on storage.objects
  for select using (bucket_id = 'covers');
create policy "covers_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'covers');
create policy "covers_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'covers');
