-- =====================================================================
-- Photos de profil des professeurs — mise à jour d'une base existante
--
-- À exécuter UNE FOIS dans Supabase : SQL Editor → New query → coller → Run.
-- Peut être relancé sans danger. Ne touche pas aux politiques Storage déjà créées
-- pour le bucket « avatars ».
--
-- Ce script :
--   1. s'assure que la colonne profiles.avatar_url existe ;
--   2. n'accepte comme photo qu'un fichier du bucket « avatars » situé dans le dossier
--      du propriétaire du profil (impossible d'afficher une image venant d'ailleurs) ;
--   3. autorise chaque utilisateur à modifier SA colonne avatar_url (les autres droits
--      restent inchangés : rôle, statut et administration toujours protégés) ;
--   4. ajoute avatar_url à la liste publique des professeurs validés
--      (toujours sans téléphone ni e-mail) ;
--   5. crée le bucket « avatars » s'il n'existe pas encore.
-- =====================================================================

alter table public.profiles add column if not exists avatar_url text;

alter table public.profiles drop constraint if exists profiles_avatar_url_check;
alter table public.profiles add constraint profiles_avatar_url_check check (
  avatar_url is null
  or avatar_url ~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/avatars/' || id::text || '/[A-Za-z0-9._-]+(\?[A-Za-z0-9=&._-]*)?$')
) not valid;

grant update (avatar_url) on public.profiles to authenticated;

create or replace view public.public_teachers as
  select id, first_name, last_name, subject, levels, years, bio, avatar_url
  from public.profiles
  where role = 'prof' and teacher_status = 'approved';
grant select on public.public_teachers to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
