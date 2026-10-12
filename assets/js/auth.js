// Sign-up and login through the data layer (api.js): Supabase when configured, demo mode otherwise.

const showError = msg => { const el = $("#error"); el.textContent = msg; el.hidden = !msg; };
const busy = (form, on, label) => {
  const btn = $('button[type="submit"]', form);
  btn.disabled = on;
  if (label) btn.textContent = label;
};

(async () => {
  const data = await boot();
  if (api.mode === "demo") $("#demoNote")?.removeAttribute("hidden");

  // ----- Sign-up -----
  const signup = $("#signup");
  if (signup) {
    $("#subject").insertAdjacentHTML("beforeend", data.subjects.map(s => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join(""));
    const setRole = role => {
      $$("[data-role]", signup).forEach(el => { el.hidden = el.dataset.role !== role; });
      $("#level").required = role === "eleve";
      $("#subject").required = role === "prof";
      $(`input[name="role"][value="${role}"]`, signup).checked = true;
    };
    setRole(new URLSearchParams(location.search).get("role") === "prof" ? "prof" : "eleve");
    signup.addEventListener("change", e => {
      if (e.target.name === "role") setRole(e.target.value);
      if (e.target.id === "level") $("#seriesField").hidden = e.target.value !== "bac";
    });

    signup.addEventListener("submit", async e => {
      e.preventDefault();
      showError("");
      const f = new FormData(signup), role = f.get("role");
      const invalid = [...signup.elements].find(el => el.willValidate && !el.closest("[hidden]") && !el.checkValidity());
      if (invalid) {
        const label = invalid.labels?.[0]?.textContent.trim() || "Ce champ";
        showError(invalid.name === "cgu" ? "Veuillez accepter les conditions d'utilisation." : `${label} : ${invalid.validationMessage}`);
        invalid.focus();
        return;
      }
      if (role === "prof" && !f.getAll("levels").length) { showError("Indiquez au moins un niveau enseigné."); return; }

      const profile = {
        role, firstName: f.get("firstName").trim(), lastName: f.get("lastName").trim(),
        email: f.get("email").trim().toLowerCase(), phone: f.get("phone").trim(), school: f.get("school").trim(),
        ...(role === "eleve"
          ? { level: f.get("level"), series: f.get("level") === "bac" ? f.get("series") : "" }
          : { subject: f.get("subject"), levels: f.getAll("levels"), years: Number(f.get("years")) || 0, bio: f.get("bio").trim() })
      };
      busy(signup, true, "Création du compte…");
      try {
        const { needsConfirmation } = await api.signUp(profile, f.get("password"));
        if (needsConfirmation) {
          signup.innerHTML = `<h1>Vérifiez votre e-mail</h1>
            <p class="alert alert--ok">Un lien de confirmation a été envoyé à <strong>${esc(profile.email)}</strong>.
            Ouvrez-le pour activer votre compte, puis connectez-vous.</p>
            ${role === "prof" ? `<p class="muted">Votre compte professeur sera ensuite vérifié par notre équipe avant que vous puissiez publier.</p>` : ""}
            <a class="btn btn--primary btn--block" href="connexion.html">Aller à la connexion</a>`;
          return;
        }
        location.href = "espace.html?bienvenue=1";
      } catch (err) {
        showError(err.message);
        busy(signup, false, "Créer mon compte");
      }
    });
  }

  // ----- Login -----
  const login = $("#login");
  if (login) {
    if (data.user) { location.replace("espace.html"); return; }
    login.addEventListener("submit", async e => {
      e.preventDefault();
      showError("");
      const email = $("#email").value.trim().toLowerCase(), password = $("#password").value;
      if (!email || !password) { showError("Saisissez votre e-mail et votre mot de passe."); return; }
      busy(login, true, "Connexion…");
      try {
        await api.signIn(email, password);
        location.href = "espace.html";
      } catch (err) {
        showError(err.message);
        busy(login, false, "Se connecter");
      }
    });
  }
})();
