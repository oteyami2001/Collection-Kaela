-- Security tests for schema.sql (Row Level Security, column rights, sign-up trigger).
-- Each line prints PASS or **FAIL**. See supabase/README.md, section "Tester le schéma".
\set QUIET on
create or replace function public.t(label text, q text, should_pass boolean) returns void language plpgsql as $$
declare ok boolean := true; msg text := '';
begin
  begin execute q; exception when others then ok := false; msg := sqlerrm; end;
  raise notice '% %  %', case when ok = should_pass then 'PASS' else '**FAIL**' end, label, case when not ok then '('||msg||')' else '' end;
end $$;
grant execute on function public.t(text,text,boolean) to anon, authenticated;
create or replace function public.eq(label text, q text, expected bigint) returns void language plpgsql as $$
declare n bigint; begin execute q into n;
  raise notice '% %  (got %, expected %)', case when n = expected then 'PASS' else '**FAIL**' end, label, n, expected; end $$;
grant execute on function public.eq(text,text,bigint) to anon, authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a','admin@x.ci','{"role":"eleve","first_name":"Ad","last_name":"Min"}'),
 ('00000000-0000-0000-0000-000000000001','eleve@x.ci','{"role":"eleve","first_name":"Awa","last_name":"K","level":"bac","series":"D","phone":"0707"}'),
 ('00000000-0000-0000-0000-000000000002','prof@x.ci','{"role":"prof","first_name":"Yao","last_name":"B","subject":"maths","levels":["bac","xx"],"years":"12","phone":"0102"}'),
 ('00000000-0000-0000-0000-000000000003','prof2@x.ci','{"role":"prof","first_name":"Aya","last_name":"T","subject":"physique","levels":"oops"}'),
 ('00000000-0000-0000-0000-000000000004','pirate@x.ci','{"role":"admin","is_admin":true,"teacher_status":"approved","subject":"nope"}');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000a';
select eq('trigger: 5 profils créés', 'select count(*) from profiles', 5);
select eq('trigger: pirate = élève non admin', $$select count(*) from profiles where id='00000000-0000-0000-0000-000000000004' and role='eleve' and not is_admin and teacher_status='pending'$$, 1);
select eq('trigger: niveaux filtrés {bac}', $$select count(*) from profiles where id='00000000-0000-0000-0000-000000000002' and levels='{bac}' and years=12$$, 1);

-- ===== professeur en attente
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select t('prof en attente ne peut pas publier', $$insert into courses (subject, level, title) values ('maths','bac','Limites')$$, false);
select t('prof ne peut pas se valider lui-même', $$update profiles set teacher_status='approved' where id=auth.uid()$$, false);
select t('prof ne peut pas devenir admin', $$update profiles set is_admin=true where id=auth.uid()$$, false);
select t('prof ne peut pas appeler admin_set_teacher_status', $$select admin_set_teacher_status(auth.uid(),'approved')$$, false);
reset role;

-- ===== admin valide
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select t('admin valide le prof', $$select admin_set_teacher_status('00000000-0000-0000-0000-000000000002','approved')$$, true);
select eq('admin_list_teachers renvoie 2 profs avec e-mail', $$select count(*) from admin_list_teachers() where email like '%@x.ci'$$, 2);
reset role;

-- ===== professeur validé
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select t('prof validé publie dans sa matière', $$insert into courses (subject, level, title, summary) values ('maths','bac','Limites et continuité','x')$$, true);
reset role; update courses set id='10000000-0000-0000-0000-000000000001' where title='Limites et continuité';
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select t('prof ne publie pas hors de sa matière', $$insert into courses (subject, level, title) values ('physique','bac','Optique')$$, false);
select t('prof ne publie pas au nom d''un autre', $$insert into courses (teacher_id, subject, level, title) values ('00000000-0000-0000-0000-000000000003','maths','bac','Faux')$$, false);
select t('prof ne met pas son cours à la une', $$insert into courses (subject, level, title, featured) values ('maths','bac','Une', true)$$, false);
select t('prof ajoute des vidéos', $$insert into lessons (course_id, position, title, duration_min, video_url) values ('10000000-0000-0000-0000-000000000001',0,'Intro',12,'https://youtu.be/abcdefghijk'),('10000000-0000-0000-0000-000000000001',1,'Suite',10,null)$$, true);
select t('lien vidéo non https refusé', $$insert into lessons (course_id, title, video_url) values ('10000000-0000-0000-0000-000000000001','x','javascript:alert(1)')$$, false);
select t('prof envoie une vidéo dans son dossier', $$insert into storage.objects (bucket_id, name) values ('videos','00000000-0000-0000-0000-000000000002/a.mp4')$$, true);
select t('prof n''envoie pas dans le dossier d''un autre', $$insert into storage.objects (bucket_id, name) values ('videos','00000000-0000-0000-0000-000000000003/a.mp4')$$, false);
select t('prof crée un brouillon', $$insert into courses (subject, level, title, published) values ('maths','bepc','Brouillon', false)$$, true);
select t('prof modifie son cours', $$update courses set summary='Résumé' where title='Limites et continuité'$$, true);
select eq('prof voit ses 2 cours', 'select count(*) from courses', 2);
reset role;

-- ===== autre prof (en attente)
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
select t('autre prof n''ajoute pas de vidéo au cours d''un autre', $$insert into lessons (course_id, title) values ('10000000-0000-0000-0000-000000000001','pirate')$$, false);
select eq('autre prof ne modifie pas le cours d''un autre', $$with u as (update courses set title='hack' where id='10000000-0000-0000-0000-000000000001' returning 1) select count(*) from u$$, 0);
select eq('autre prof ne supprime pas le cours d''un autre', $$with d as (delete from courses where id='10000000-0000-0000-0000-000000000001' returning 1) select count(*) from d$$, 0);
select t('prof en attente n''envoie pas de vidéo', $$insert into storage.objects (bucket_id, name) values ('videos','00000000-0000-0000-0000-000000000003/a.mp4')$$, false);
reset role;

-- ===== visiteur anonyme
set role anon; set request.jwt.claim.sub = '';
select eq('anonyme voit 1 cours publié (pas le brouillon)', 'select count(*) from courses', 1);
select eq('anonyme voit les 2 vidéos', 'select count(*) from lessons', 2);
select eq('anonyme ne voit aucun profil', 'select count(*) from profiles', 0);
select eq('anonyme voit 1 professeur public', 'select count(*) from public_teachers', 1);
select t('vue publique sans téléphone', 'select phone from public_teachers', false);
select eq('anonyme voit 8 matières', 'select count(*) from subjects', 8);
select t('anonyme ne peut rien publier', $$insert into courses (subject, level, title) values ('maths','bac','x')$$, false);
select t('anonyme n''appelle pas admin_list_teachers', 'select * from admin_list_teachers()', false);
reset role;

-- ===== élève
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select eq('élève voit seulement son profil', 'select count(*) from profiles', 1);
select t('élève modifie son prénom', $$update profiles set first_name='Awa M.' where id=auth.uid()$$, true);
select t('élève ne change pas son rôle', $$update profiles set role='prof' where id=auth.uid()$$, false);
select t('élève enregistre sa progression', $$insert into progress (lesson_id) select id from lessons where position=0$$, true);
select t('élève n''écrit pas la progression d''un autre', $$insert into progress (student_id, lesson_id) select '00000000-0000-0000-0000-000000000004', id from lessons where position=1$$, false);
select t('élève ne publie pas', $$insert into courses (subject, level, title) values ('maths','bac','x')$$, false);
select eq('élève voit 1 cours', 'select count(*) from courses', 1);
reset role;
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
select eq('autre élève ne voit pas la progression d''Awa', 'select count(*) from progress', 0);
reset role;

-- ===== admin modère
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select t('admin met un cours à la une', $$select admin_set_course('10000000-0000-0000-0000-000000000001', true, true)$$, true);
select eq('admin voit le brouillon', 'select count(*) from courses', 2);
reset role;
select eq('cours à la une', 'select count(*) from courses where featured', 1);
-- suppression en cascade
delete from auth.users where id='00000000-0000-0000-0000-000000000002';
select eq('suppression du compte prof supprime ses cours', 'select count(*) from courses', 0);
