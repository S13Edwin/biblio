-- V6 : catégorie « Artbooks » + bloc-notes « Sorties à venir » (à coller dans Supabase > SQL Editor > Run)

-- 1) autoriser la nouvelle catégorie (on retire l'ancienne règle quel que soit son nom)
do $$ declare c text; begin
  for c in select conname from pg_constraint
    where conrelid = 'public.items'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%comics_vf%'
  loop execute format('alter table public.items drop constraint %I', c); end loop;
end $$;
alter table public.items add constraint items_category_check
  check (category in ('comics_vf','comics_vo','bd','livre','artbook','manga','vinyle','cd','dvd'));

-- 2) table des notes (une ligne par note, ici « upcoming »)
create table if not exists public.notes (
  user_id uuid not null default auth.uid(),
  key text not null,
  body text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.notes enable row level security;
drop policy if exists "owner_all_notes" on public.notes;
create policy "owner_all_notes" on public.notes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
