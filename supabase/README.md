# Connecter la base de données Supabase

Ce guide met en place la vraie base de données du site : comptes élèves et professeurs, cours, vidéos et progression.
Comptez environ 20 minutes. Tant que ces étapes ne sont pas faites, le site reste en **mode démonstration** : il fonctionne, mais ce qui est enregistré ne reste que dans le navigateur du visiteur.

## 1. Créer le projet Supabase

1. Créez un compte gratuit sur [supabase.com](https://supabase.com), puis cliquez sur **New project**.
2. Donnez-lui un nom (par exemple `collection-kaela`), choisissez un **mot de passe de base de données** (gardez-le précieusement) et la **région Europe** la plus proche (Francfort, Londres ou Paris si disponible).
3. Attendez une à deux minutes que le projet soit prêt.

## 2. Créer les tables et les règles de sécurité

1. Dans le menu de gauche : **SQL Editor** → **New query**.
2. Copiez **tout** le contenu du fichier [`schema.sql`](schema.sql), collez-le, puis cliquez sur **Run**.
3. Le message « Success. No rows returned » confirme que tout est créé : tables, règles de sécurité, matières et espace de stockage `videos`.

Le script peut être relancé sans risque : il ne supprime aucune donnée.

## 3. Régler l'authentification

Dans **Authentication** → **URL Configuration** :

- **Site URL** : `https://oteyami2001.github.io/Collection-Kaela/`
- **Redirect URLs** : ajoutez `https://oteyami2001.github.io/Collection-Kaela/**`

Ces adresses permettent aux liens envoyés par e-mail (confirmation d'inscription, mot de passe oublié) de ramener sur votre site.

### Les e-mails (important avant le lancement)

Le service d'e-mail intégré à Supabase sert uniquement aux essais : il envoie très peu de messages. Pour de vrais élèves et professeurs, branchez votre propre service d'envoi dans **Authentication** → **Emails** → **SMTP Settings**, par exemple Brevo ou Resend, qui ont des offres gratuites. Vous pouvez aussi traduire les modèles d'e-mails en français dans **Authentication** → **Emails** → **Templates**.

Pour tester rapidement avant cela, vous pouvez désactiver la confirmation d'e-mail : **Authentication** → **Sign In / Providers** → **Email** → décochez **Confirm email**. Pensez à la réactiver ensuite.

## 4. Relier le site à la base

1. Dans **Project Settings** → **API** (ou **Data API**), copiez :
   - **Project URL** (de la forme `https://xxxxxxxx.supabase.co`) ;
   - la clé publique : **anon public** (`eyJ…`) ou, sur les projets récents, la **publishable key** (`sb_publishable_…`).
2. Collez-les dans [`assets/js/config.js`](../assets/js/config.js) :

```js
window.CK_CONFIG = {
  supabaseUrl: "https://xxxxxxxx.supabase.co",
  supabaseAnonKey: "eyJhbGciOi...",
  showSampleContent: true,
  maxVideoMB: 50
};
```

3. Enregistrez le fichier sur GitHub (dans la branche `main`) : le site publié se met à jour en une à deux minutes.

Ces deux valeurs peuvent être publiques : les règles de sécurité de la base protègent les données.
**Ne mettez jamais la clé `service_role`** dans le site : elle donne tous les droits sur la base.

## 5. Devenir administrateur

1. Sur le site, créez votre propre compte (par exemple avec `editionkaela@gmail.com`) et confirmez l'e-mail.
2. Dans Supabase, **SQL Editor** → **New query**, puis exécutez (en remplaçant l'e-mail) :

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'editionkaela@gmail.com');
```

3. Reconnectez-vous sur le site : un lien **Administration** apparaît dans le menu. Depuis cette page, vous pouvez :
   - **valider ou refuser les professeurs** inscrits (ils ne peuvent publier qu'après validation) ;
   - mettre des cours **à la une** sur l'accueil, les masquer ou les supprimer.

## 6. Retirer les exemples

Quand vos vrais professeurs auront publié leurs cours, passez `showSampleContent` à `false` dans `assets/js/config.js` : les professeurs et cours d'exemple disparaîtront du site.

## Ce que fait la base

| Table | Contenu | Qui peut voir / modifier |
|---|---|---|
| `subjects` | Les 8 matières | Tout le monde voit ; seul Supabase modifie |
| `profiles` | Un profil par compte : rôle, nom, téléphone, niveau et série (élève), matière, niveaux, présentation et statut (professeur) | Chacun voit et modifie le sien (sauf rôle, statut et droits d'administration) ; les administrateurs voient tout |
| `courses` | Les cours : titre, matière, niveau, séries, description, publié ou brouillon, à la une | Tout le monde voit les cours publiés des professeurs validés ; un professeur validé crée des cours **dans sa matière** et ne modifie que les siens |
| `lessons` | Les vidéos de chaque cours : ordre, titre, durée, lien ou fichier | Visibles avec leur cours ; modifiables par le professeur du cours |
| `progress` | Les vidéos vues par chaque élève | Chaque élève ne voit et ne modifie que sa progression |
| Stockage `videos` | Les fichiers vidéo, rangés dans un dossier par professeur | Lecture publique par lien ; envoi par les professeurs validés, dans leur propre dossier |

Les coordonnées (e-mail, téléphone, établissement) ne sont jamais visibles du public : la liste publique des professeurs (`public_teachers`) ne montre que le nom, la matière, les niveaux, l'expérience et la présentation.

## Les vidéos et leur taille

- **Offre gratuite de Supabase** : 1 Go de stockage et 50 Mo maximum par fichier. Une vidéo de cours de 10 à 15 minutes, bien compressée en 720p, pèse souvent 50 à 150 Mo.
- Pour commencer sans frais, les professeurs peuvent **mettre leurs vidéos sur YouTube en « non répertoriée » et coller le lien** : le site les affiche directement.
- Quand la plateforme grandit, passez à une offre payante de Supabase (plus de stockage, fichiers plus lourds), puis augmentez `maxVideoMB` dans `assets/js/config.js`. Vérifiez les tarifs actuels sur le site de Supabase.
- Pour de nombreux élèves sur données mobiles, un service vidéo dédié (Bunny Stream, Cloudflare Stream…) qui adapte la qualité à la connexion sera le meilleur choix à terme.

## Tester le schéma (pour les développeurs)

Le dossier [`tests/`](tests) permet de vérifier les règles de sécurité sur un PostgreSQL local (sans Supabase) :

```bash
createdb ck_test
psql -d ck_test -f supabase/tests/supabase-stub.sql   # imitation minimale d'auth/storage de Supabase
psql -d ck_test -f supabase/schema.sql
psql -d ck_test -f supabase/tests/security-tests.sql  # chaque ligne affiche PASS ou **FAIL**
```

Les 44 vérifications couvrent l'inscription, la validation des professeurs, la publication, les vidéos, la progression et l'administration.
