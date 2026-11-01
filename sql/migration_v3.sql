-- Ma bibliothèque : migration V3 (Supabase > SQL Editor > New query > Run)
-- Issues (numéros VO) liées à plusieurs comics, avec statut de lecture par issue.

create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  series text not null,            -- ex. « Batman (2011) »
  number text not null,            -- texte : « 1 », « 0 », « Annual 1 »…
  title text,                      -- facultatif
  read boolean not null default false,
  read_on date,
  created_at timestamptz not null default now(),
  unique (user_id, series, number)
);

create table if not exists public.item_issues (
  item_id uuid not null references public.items(id) on delete cascade,
  issue_id uuid not null references public.issues(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  primary key (item_id, issue_id)
);
create index if not exists item_issues_issue_idx on public.item_issues (issue_id);

alter table public.issues enable row level security;
alter table public.item_issues enable row level security;

drop policy if exists "owner_all_issues" on public.issues;
create policy "owner_all_issues" on public.issues
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "owner_all_item_issues" on public.item_issues;
create policy "owner_all_item_issues" on public.item_issues
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
