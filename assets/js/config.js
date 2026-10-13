// Configuration de la base de données (Supabase).
//
// Tant que ces deux valeurs sont vides, le site fonctionne en MODE DÉMONSTRATION :
// les comptes et les cours sont enregistrés uniquement dans le navigateur.
//
// Pour connecter la vraie base : Supabase → Project Settings → API, puis copiez
//   - « Project URL »            → supabaseUrl
//   - la clé publique (« anon public » ou « publishable key » sb_publishable_…) → supabaseAnonKey
// Ces deux valeurs peuvent être publiques. Ne mettez JAMAIS ici la clé « service_role ».
window.CK_CONFIG = {
  supabaseUrl: "https://shyvfcadskhwcbktdgil.supabase.co",
  supabaseAnonKey: "sb_publishable_wPzA4COzU2GPmm0AA1AsZQ_X28dK7Uj",

  // Afficher les cours et professeurs d'exemple (data/*.json) à côté des vrais.
  // Passez à false quand vos vrais professeurs auront publié leurs cours.
  showSampleContent: true,

  // Taille maximale d'un fichier vidéo envoyé par un professeur, en Mo.
  // Offre gratuite de Supabase : 50 Mo par fichier. Augmentez-la si vous passez à une offre payante
  // (la limite globale se règle ensuite dans Supabase → Storage → Settings).
  maxVideoMB: 50
};
