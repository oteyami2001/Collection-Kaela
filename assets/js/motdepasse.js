// Forgotten password: request a reset e-mail, then choose a new password from the e-mailed link.

(async () => {
  const isReset = new URLSearchParams(location.search).has("reset");   // read before Supabase cleans the URL
  const data = await boot();
  const show = (id, text, ok) => { const el = $(id); el.textContent = text; el.hidden = !text; el.classList.toggle("alert--ok", !!ok); };

  if (isReset) {
    $("#requestForm").hidden = true;
    $("#resetForm").hidden = false;
    if (!data.user) show("#error2", "Ce lien a expiré ou a déjà été utilisé. Demandez un nouveau lien.");
  }

  $("#requestForm").addEventListener("submit", async e => {
    e.preventDefault();
    const email = $("#email").value.trim().toLowerCase();
    if (!$("#email").checkValidity() || !email) return show("#error", "Saisissez une adresse e-mail valide.");
    const btn = $('button[type="submit"]', e.target);
    btn.disabled = true;
    try {
      await api.resetPassword(email);
      show("#error", "Si un compte existe avec cet e-mail, un lien vient de vous être envoyé. Pensez à vérifier vos spams.", true);
    } catch (err) { show("#error", err.message); btn.disabled = false; }
  });

  $("#resetForm").addEventListener("submit", async e => {
    e.preventDefault();
    const p1 = $("#password").value, p2 = $("#password2").value;
    if (p1.length < 8) return show("#error2", "8 caractères minimum.");
    if (p1 !== p2) return show("#error2", "Les deux mots de passe ne correspondent pas.");
    try {
      await api.updatePassword(p1);
      show("#error2", "Mot de passe modifié. Redirection vers votre espace…", true);
      setTimeout(() => { location.href = "espace.html"; }, 1200);
    } catch (err) { show("#error2", err.message); }
  });
})();
