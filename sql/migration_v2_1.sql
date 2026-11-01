-- Ma bibliothèque : migration V2.1 (Supabase > SQL Editor > New query > Run)
alter table public.items add column if not exists contents text;   -- sommaire / épisodes

alter table public.options add column if not exists parent text;   -- éditeur auquel appartient une collection
alter table public.options drop constraint if exists options_user_id_kind_name_key;
create unique index if not exists options_uniq
  on public.options (user_id, kind, name, coalesce(parent, ''));

-- Rattache les collections existantes à leur éditeur le plus fréquent
update public.options o set parent = (
  select i.publisher from public.items i
  where i.user_id = o.user_id and i.collection = o.name and coalesce(i.publisher, '') <> ''
  group by i.publisher order by count(*) desc limit 1)
where o.kind = 'collection' and o.parent is null;
