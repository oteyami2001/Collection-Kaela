-- =====================================================================
-- Préparation d'Examen Collection Kaela — base de données Supabase
--
-- À exécuter une fois dans Supabase : SQL Editor → New query → coller → Run.
-- Le script peut être relancé sans danger (il ne supprime aucune donnée).
--
-- Contenu :
--   subjects   les matières
--   profiles   un profil par compte (élève ou professeur), créé à l'inscription
--   courses    les cours publiés par les professeurs
--   lessons    les vidéos de chaque cours
--   progress   les vidéos vues par chaque élève
--   bucket « videos » pour les fichiers vidéo envoyés par les professeurs
--
-- Sécurité (Row Level Security) :
--   - tout le monde voit les cours publiés des professeurs validés ;
--   - un professeur ne peut publier que s'il est validé, dans sa matière,
--     et ne peut modifier que ses propres cours et vidéos ;
--   - un élève ne voit et ne modifie que sa propre progression ;
--   - les coordonnées (téléphone, e-mail, établissement) ne sont jamais publiques ;
--   - seuls les administrateurs valident les professeurs et mettent des cours « à la une ».
-- =====================================================================

-- ---------- Matières ----------
create table if not exists public.subjects (
  id       text primary key,
  label    text not null,
  icon     text not null default '•',
  color    text not null default '#0a6cbd',
  position int  not null default 0
);

insert into public.subjects (id, label, icon, color, position) values
  ('maths',        'Mathématiques',      '∑',   '#0b7a4b', 1),
  ('physique',     'Sciences Physiques', '⚡',  '#1d4ed8', 2),
  ('chimie',       'Chimie',             '⚗',   '#7c3aed', 3),
  ('svt',          'Sciences Naturelles','🌿',  '#15803d', 4),
  ('informatique', 'Informatique',       '</>', '#0f766e', 5),
  ('anglais',      'Anglais',            'EN',  '#b91c1c', 6),
  ('francais',     'Français',           'FR',  '#1e3a8a', 7),
  ('espagnol',     'Espagnol',           'ES',  '#c2410c', 8)
on conflict (id) do nothing;

-- ---------- Profils ----------
create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  role           text not null check (role in ('eleve', 'prof')),
  first_name     text not null check (char_length(first_name) between 1 and 60),
  last_name      text not null check (char_length(last_name) between 1 and 60),
  phone          text check (char_length(phone) <= 30),
  school         text check (char_length(school) <= 120),
  -- élèves
  level          text check (level in ('bepc', 'bac')),
  series         text check (char_length(series) <= 5),
  -- professeurs
  subject        text references public.subjects (id),
  levels         text[] not null default '{}' check (levels <@ array['bepc', 'bac']),
  years          int check (years between 0 and 60),
  bio            text check (char_length(bio) <= 400),
  teacher_status text not null default 'pending' check (teacher_status in ('pending', 'approved', 'rejected')),
  is_admin       boolean not null default false,
  created_at     timestamptz not null default now()
);

-- ---------- Cours et vidéos ----------
create table if not exists public.courses (
  id         uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  subject    text not null references public.subjects (id),
  level      text not null check (level in ('bepc', 'bac')),
  series     text[] not null default '{}',
  title      text not null check (char_length(title) between 3 and 120),
  summary    text not null default '' check (char_length(summary) <= 600),
  published  boolean not null default true,
  featured   boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists courses_teacher_idx on public.courses (teacher_id);

create table if not exists public.lessons (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses (id) on delete cascade,
  position     int  not null default 0,
  title        text not null check (char_length(title) between 1 and 120),
  duration_min int  check (duration_min between 0 and 600),
  video_url    text check (video_url ~ '^https://'),   -- lien YouTube / Vimeo…
  video_path   text,                                    -- fichier dans le bucket « videos »
  created_at   timestamptz not null default now()
);
create index if not exists lessons_course_idx on public.lessons (course_id, position);

create table if not exists public.progress (
  student_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  lesson_id    uuid not null references public.lessons (id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (student_id, lesson_id)
);

-- ---------- Fonctions d'aide (utilisées par les règles de sécurité) ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_approved_teacher(uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles
                 where id = uid and role = 'prof' and teacher_status = 'approved');
$$;

create or replace function public.my_subject() returns text
language sql stable security definer set search_path = '' as $$
  select subject from public.profiles where id = auth.uid();
$$;

-- ---------- Création automatique du profil à l'inscription ----------
-- Les informations du formulaire arrivent dans raw_user_meta_data (supabase.auth.signUp options.data).
-- Elles sont filtrées ici : impossible de s'inscrire directement « validé » ou « administrateur ».
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  r text  := case when m ->> 'role' = 'prof' then 'prof' else 'eleve' end;
begin
  insert into public.profiles (id, role, first_name, last_name, phone, school,
                               level, series, subject, levels, years, bio)
  values (
    new.id, r,
    left(coalesce(nullif(trim(m ->> 'first_name'), ''), '—'), 60),
    left(coalesce(nullif(trim(m ->> 'last_name'), ''), '—'), 60),
    left(nullif(trim(m ->> 'phone'), ''), 30),
    left(nullif(trim(m ->> 'school'), ''), 120),
    case when r = 'eleve' and m ->> 'level' in ('bepc', 'bac') then m ->> 'level' end,
    case when r = 'eleve' and m ->> 'level' = 'bac' then left(nullif(m ->> 'series', ''), 5) end,
    case when r = 'prof' then (select id from public.subjects where id = m ->> 'subject') end,
    case when r = 'prof' and jsonb_typeof(m -> 'levels') = 'array'
         then array(select distinct x from jsonb_array_elements_text(m -> 'levels') x where x in ('bepc', 'bac'))
         else '{}' end,
    case when r = 'prof' and (m ->> 'years') ~ '^[0-9]{1,2}$' then (m ->> 'years')::int end,
    case when r = 'prof' then left(nullif(trim(m ->> 'bio'), ''), 400) end
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Liste publique des professeurs (sans coordonnées) ----------
create or replace view public.public_teachers as
  select id, first_name, last_name, subject, levels, years, bio
  from public.profiles
  where role = 'prof' and teacher_status = 'approved';
grant select on public.public_teachers to anon, authenticated;

-- ---------- Actions réservées aux administrateurs ----------
create or replace function public.admin_set_teacher_status(teacher uuid, status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  if status not in ('pending', 'approved', 'rejected') then raise exception 'Statut invalide'; end if;
  update public.profiles set teacher_status = status where id = teacher and role = 'prof';
end $$;

create or replace function public.admin_set_course(course uuid, is_published boolean, is_featured boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  update public.courses set published = is_published, featured = is_featured where id = course;
end $$;

-- Liste des professeurs pour l'administration (avec e-mail), réservée aux administrateurs.
create or replace function public.admin_list_teachers()
returns table (id uuid, email text, first_name text, last_name text, phone text, school text,
               subject text, levels text[], years int, bio text, teacher_status text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs'; end if;
  return query
    select p.id, u.email::text, p.first_name, p.last_name, p.phone, p.school,
           p.subject, p.levels, p.years, p.bio, p.teacher_status, p.created_at
    from public.profiles p join auth.users u on u.id = p.id
    where p.role = 'prof'
    order by (p.teacher_status = 'pending') desc, p.created_at desc;
end $$;

revoke execute on function public.admin_set_teacher_status(uuid, text) from public, anon;
revoke execute on function public.admin_set_course(uuid, boolean, boolean) from public, anon;
revoke execute on function public.admin_list_teachers() from public, anon;
grant execute on function public.admin_set_teacher_status(uuid, text) to authenticated;
grant execute on function public.admin_set_course(uuid, boolean, boolean) to authenticated;
grant execute on function public.admin_list_teachers() to authenticated;

-- ---------- Droits par colonne ----------
-- Un utilisateur peut modifier son profil, mais jamais son rôle, son statut ni le droit administrateur.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (first_name, last_name, phone, school, level, series, subject, levels, years, bio)
  on public.profiles to authenticated;
-- Un professeur ne peut pas mettre son propre cours « à la une ».
revoke insert, update on public.courses from anon, authenticated;
grant insert (teacher_id, subject, level, series, title, summary, published) on public.courses to authenticated;
grant update (level, series, title, summary, published) on public.courses to authenticated;
revoke insert, update, delete on public.subjects from anon, authenticated;

-- ---------- Règles de sécurité (Row Level Security) ----------
alter table public.subjects enable row level security;
alter table public.profiles enable row level security;
alter table public.courses  enable row level security;
alter table public.lessons  enable row level security;
alter table public.progress enable row level security;

drop policy if exists "subjects: lecture publique" on public.subjects;
create policy "subjects: lecture publique" on public.subjects for select using (true);

drop policy if exists "profiles: lire son profil" on public.profiles;
create policy "profiles: lire son profil" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles: modifier son profil" on public.profiles;
create policy "profiles: modifier son profil" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "courses: lecture" on public.courses;
create policy "courses: lecture" on public.courses for select
  using ((published and public.is_approved_teacher(teacher_id))
         or teacher_id = auth.uid() or public.is_admin());
drop policy if exists "courses: créer (professeur validé, sa matière)" on public.courses;
create policy "courses: créer (professeur validé, sa matière)" on public.courses for insert to authenticated
  with check (teacher_id = auth.uid() and public.is_approved_teacher() and subject = public.my_subject());
drop policy if exists "courses: modifier ses cours" on public.courses;
create policy "courses: modifier ses cours" on public.courses for update to authenticated
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
drop policy if exists "courses: supprimer ses cours" on public.courses;
create policy "courses: supprimer ses cours" on public.courses for delete to authenticated
  using (teacher_id = auth.uid() or public.is_admin());

drop policy if exists "lessons: lecture" on public.lessons;
create policy "lessons: lecture" on public.lessons for select
  using (exists (select 1 from public.courses c where c.id = course_id));   -- suit la visibilité du cours
drop policy if exists "lessons: gérer ses vidéos" on public.lessons;
create policy "lessons: gérer ses vidéos" on public.lessons for all to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.teacher_id = auth.uid()))
  with check (exists (select 1 from public.courses c where c.id = course_id and c.teacher_id = auth.uid()));

drop policy if exists "progress: sa progression" on public.progress;
create policy "progress: sa progression" on public.progress for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());

-- ---------- Stockage des vidéos ----------
-- Bucket public : les vidéos se lisent par simple lien. Taille max par fichier : 500 Mo
-- (l'offre gratuite de Supabase applique sa propre limite, plus basse — voir le README).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', true, 524288000, array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do nothing;

-- Chaque professeur validé envoie ses fichiers dans son propre dossier : videos/<son id>/...
drop policy if exists "videos: envoi par les professeurs validés" on storage.objects;
create policy "videos: envoi par les professeurs validés" on storage.objects for insert to authenticated
  with check (bucket_id = 'videos'
              and (storage.foldername(name))[1] = auth.uid()::text
              and public.is_approved_teacher());
drop policy if exists "videos: suppression de ses fichiers" on storage.objects;
create policy "videos: suppression de ses fichiers" on storage.objects for delete to authenticated
  using (bucket_id = 'videos'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
