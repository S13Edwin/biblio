-- Ma bibliothèque : migration V2.2 (Supabase > SQL Editor > New query > Run)
-- Autorise les demi-étoiles (0,5 à 5, par pas de 0,5)
do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.items'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ilike '%rating%'
  loop
    execute format('alter table public.items drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.items alter column rating type numeric(2,1) using rating::numeric;

alter table public.items add constraint items_rating_check
  check (rating between 0.5 and 5 and rating * 2 = round(rating * 2));
