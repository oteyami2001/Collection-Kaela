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
| `professeurs.html` | Liste des professeurs, filtre par matière |
| `inscription.html` | Inscription élève (niveau BEPC/BAC + série) ou professeur (matière, niveaux) — `?role=prof` pré-sélectionne professeur |
| `connexion.html` | Connexion |
| `espace.html` | Espace élève (cours de son niveau, progression) ou espace professeur (publier un cours en vidéo) |

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

## Important : mode démonstration

Les comptes et les cours publiés par les professeurs sont enregistrés **uniquement dans le navigateur** (`localStorage`) ; le mot de passe n'est jamais enregistré. Pour la mise en ligne réelle, il faut brancher un serveur :

1. **Authentification** (comptes élèves / professeurs, mots de passe sécurisés) — ex. Supabase, Firebase ou une API Laravel / Node.
2. **Base de données** pour les cours, leçons, professeurs et progression.
3. **Hébergement des vidéos** — YouTube (non répertoriée), Vimeo, ou un service vidéo dédié.

Les fonctions à remplacer sont regroupées dans `assets/js/common.js` (`getUser`, `setUser`, `getLocalCourses`, `getProgress`) et `assets/js/auth.js`.

## Prochaines étapes prévues

Exercices corrigés, devoirs, quiz, examens blancs, suivi de progression, espace questions-réponses et statistiques de performance (annoncés sur l'accueil, section « Bientôt »).
