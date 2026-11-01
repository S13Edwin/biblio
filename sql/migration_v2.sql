-- Ma bibliothèque : migration V2 (Supabase > SQL Editor > New query > Run)
alter table public.items
  add column if not exists isbn text,
  add column if not exists rating smallint check (rating between 1 and 5),
  add column if not exists favorite boolean not null default false,
  add column if not exists summary text,
  add column if not exists release_date date;

create table if not exists public.options (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  kind text not null check (kind in ('collection','publisher')),
  name text not null,
  unique (user_id, kind, name)
);
alter table public.options enable row level security;
create policy "owner_all_options" on public.options
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Reprend les collections / éditeurs déjà présents dans tes items
insert into public.options (user_id, kind, name)
  select distinct user_id, 'collection', trim(collection) from public.items
  where coalesce(trim(collection),'') <> '' on conflict do nothing;
insert into public.options (user_id, kind, name)
  select distinct user_id, 'publisher', trim(publisher) from public.items
  where coalesce(trim(publisher),'') <> '' on conflict do nothing;
