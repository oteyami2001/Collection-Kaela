# Préparation d'Examen — Collection Kaela

Plateforme éducative ivoirienne pour préparer le **BEPC** et le **BAC** : des professeurs publient leurs cours en vidéo, les élèves les regardent selon leur niveau.

Site statique (HTML / CSS / JavaScript, sans framework), construit à partir du skill `e-learning-site`.

## Aperçu en local

Les données sont chargées depuis `data/*.json` : le site doit être servi en HTTP (pas en ouvrant le fichier directement).

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Pages

| Page | Rôle |
|---|---|
| `index.html` | Accueil : recherche, choix BEPC/BAC, matières, cours à la une, méthode, professeurs, fonctionnalités à venir, témoignages, FAQ |
| `catalogue.html` | Tous les cours, filtres niveau / matière / professeur, recherche et tri (synchronisés dans l'URL, ex. `?niveau=bac&matiere=maths`) |
| `cours.html?c=<slug>` | Page de cours : lecteur vidéo, sommaire, progression, vidéo précédente/suivante |
| `professeurs.html` | Annuaire des professeurs validés (photo, matière, expérience, niveaux, présentation), filtre par matière ; les vrais professeurs remplacent les profils d'exemple |
| `professeur.html?id=<id>` | Profil d'un professeur et ses cours publiés (« Voir le cours » ouvre `cours.html`) |
| `inscription.html` | Inscription élève (niveau BEPC/BAC + série) ou professeur (matière, niveaux) — `?role=prof` pré-sélectionne professeur |
| `connexion.html` | Connexion |
| `espace.html` | Espace élève (cours de son niveau, progression) ou espace professeur (photo de profil, publier un cours : fichiers vidéo ou liens YouTube, brouillons) |
| `admin.html` | Administration : valider les professeurs, mettre des cours à la une, masquer ou supprimer |
| `motdepasse.html` | Mot de passe oublié |

## Modifier le contenu

- **Matières** : `data/subjects.json` (libellé, icône, couleur)
- **Cours** : `data/courses.json` — chaque leçon : `t` (titre), `d` (durée en minutes), `v` (lien YouTube, facultatif)
- **Professeurs** : `data/teachers.json`
- **Témoignages / FAQ** : `data/testimonials.json`, `data/faq.json`
- **Livres Édition Kaela** : `data/books.json` (couvertures dans `img/livres/`)
- **Photos d'élèves** : `img/eleves/` · **Logo** : `img/logo-edition-kaela.webp` (version blanche pour le pied de page : `img/logo-edition-kaela-blanc.webp`)
- **Coordonnées** (téléphones, e-mail, adresse) : constante `CONTACT` dans `assets/js/common.js`
- **Couleurs et polices** : variables `:root` en haut de `assets/css/styles.css` (bleu `--brand` et marine `--brand-dark` du logo, rouge `--accent` et jaune `--sun` des affiches)

Les professeurs, cours et témoignages actuels sont **des exemples** à remplacer par les vrais.

### Mises à jour et cache des navigateurs

Les pages chargent les fichiers CSS et JavaScript avec un numéro de version (`styles.css?v=20261013c`, `espace.js?v=20261013c`…). Quand vous modifiez un fichier de `assets/`, changez ce numéro dans les pages HTML : les navigateurs téléchargeront alors la nouvelle version au lieu de garder l'ancienne en mémoire. GitHub Pages laisse aussi les navigateurs garder une page jusqu'à 10 minutes : après une mise à jour, attendez quelques minutes ou rechargez avec Ctrl+F5 (Cmd+Maj+R sur Mac).

## Base de données (Supabase)

Le site utilise [Supabase](https://supabase.com) pour les comptes, les cours, les vidéos et la progression.
**Guide d'installation pas à pas : [`supabase/README.md`](supabase/README.md).**

- `supabase/schema.sql` : tables, règles de sécurité et stockage des vidéos (à exécuter une fois dans Supabase)
- `assets/js/config.js` : l'adresse du projet et la clé publique à renseigner
- `assets/js/api.js` : toute la communication avec la base (inscription, connexion, catalogue, publication, envoi des vidéos, progression, administration)
- `admin.html` : validation des professeurs et gestion des cours (comptes administrateurs)
- `motdepasse.html` : mot de passe oublié

Tant que `config.js` est vide, le site fonctionne en **mode démonstration** : les comptes et les cours sont enregistrés uniquement dans le navigateur, et le mot de passe n'est jamais enregistré.

## Prochaines étapes prévues

Exercices corrigés, devoirs, quiz, examens blancs, suivi de progression, espace questions-réponses et statistiques de performance (annoncés sur l'accueil, section « Bientôt »).
