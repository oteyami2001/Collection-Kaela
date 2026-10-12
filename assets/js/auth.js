// Sign-up and login — DEMO ONLY: the profile is kept in this browser (localStorage)
// and the password is never stored. Connect a real backend (auth + database) before launch.

const showError = msg => { const el = $("#error"); el.textContent = msg; el.hidden = !msg; if (msg) el.focus?.(); };

(async () => {
  const data = await boot();

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

    signup.addEventListener("submit", e => {
      e.preventDefault();
      const f = new FormData(signup), role = f.get("role");
      const invalid = [...signup.elements].find(el => el.willValidate && !el.closest("[hidden]") && !el.checkValidity());
      if (invalid) {
        const label = invalid.labels?.[0]?.textContent.trim() || "Ce champ";
        showError(invalid.name === "cgu" ? "Veuillez accepter les conditions d'utilisation." : `${label} : ${invalid.validationMessage}`);
        invalid.focus();
        return;
      }
      if (role === "prof" && !f.getAll("levels").length) { showError("Indiquez au moins un niveau enseigné."); return; }

      const user = {
        role, firstName: f.get("firstName").trim(), lastName: f.get("lastName").trim(),
        email: f.get("email").trim().toLowerCase(), phone: f.get("phone").trim(), school: f.get("school").trim(),
        ...(role === "eleve"
          ? { level: f.get("level"), series: f.get("level") === "bac" ? f.get("series") : "" }
          : { subject: f.get("subject"), levels: f.getAll("levels"), years: Number(f.get("years")) || 0, bio: f.get("bio").trim() })
      };
      store.set("ck-account", user);
      setUser(user);
      location.href = "espace.html?bienvenue=1";
    });
  }

  // ----- Login -----
  const login = $("#login");
  if (login) {
    login.addEventListener("submit", e => {
      e.preventDefault();
      const email = $("#email").value.trim().toLowerCase();
      if (!email || !$("#password").value) { showError("Saisissez votre e-mail et votre mot de passe."); return; }
      const account = store.get("ck-account", null);
      if (!account || account.email !== email) {
        showError("Aucun compte trouvé avec cet e-mail sur cet appareil. Créez un compte pour commencer.");
        return;
      }
      setUser(account);
      location.href = "espace.html";
    });
  }
})();
