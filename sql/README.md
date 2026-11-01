# Scripts SQL

À lancer **dans l'ordre**, une seule fois chacun, dans Supabase > SQL Editor > Run.
Les scripts sont rejouables sans danger (`if not exists` / `drop ... if exists`).

| Fichier | Version | Contenu |
|---|---|---|
| `schema.sql` | 0.1 | Table `items`, droits (RLS), stockage des couvertures |
| `migration_v2.sql` | 0.2 | Table `options` (éditeurs, collections), champs note / résumé / sortie |
| `migration_v2_1.sql` | 0.2.1 | Collections rattachées à un éditeur |
| `migration_v2_2.sql` | 0.2.2 | Notes par demi-étoiles |
| `migration_v3.sql` | 0.3 | Issues et liens issues ↔ comics |
| `migration_v4.sql` | 0.4 | Séries et numéro de tome |
| `migration_v5.sql` | 0.5 | Suppression du champ « Sommaire » |
| `migration_v6.sql` | 0.6 | Catégorie Artbooks et table `notes` (Sorties à venir) |

La version 0.7.0 n'ajoute aucun script SQL.
