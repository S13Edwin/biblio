-- V5 : supprime le champ « Sommaire » (remplacé par le bloc Issues)
alter table public.items drop column if exists contents;
