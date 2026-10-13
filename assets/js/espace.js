// "Mon espace": student dashboard (level courses, progress) or teacher dashboard (publish courses).

(async () => {
  const data = await boot();
  const user = data.user;
  const welcome = new URLSearchParams(location.search).has("bienvenue");
  if (!user) { $("#guest").hidden = false; return; }

  $("#hello").textContent = `Bonjour ${user.firstName} 👋`;
  if (user.role === "prof") teacherView(data, user, welcome);
  else studentView(data, user, welcome);
})();

async function studentView(data, user, welcome) {
  $("#student").hidden = false;
  $("#welcomeStudent").hidden = !welcome;
  $("#subtitle").textContent = `Espace élève · ${LEVEL_LONG[user.level] || ""}${user.series ? ` · Série ${user.series}` : ""}`;
  $("#stLevel").textContent = LEVELS[user.level] || "—";

  const progress = await api.progress(data.courses);
  const started = data.courses.filter(c => progress[c.slug]?.length);
  $("#stCourses").textContent = started.length;
  $("#stVideos").textContent = started.reduce((n, c) => n + progress[c.slug].length, 0);
  if (started.length) {
    $("#continueBox").hidden = false;
    $("#continueList").innerHTML = started.map(c => {
      const pct = Math.round(progress[c.slug].length / c.lessons.length * 100);
      return `<li><div><a href="cours.html?c=${encodeURIComponent(c.slug)}">${esc(c.title)}</a>
        <p class="tcard__job">${esc(data.bySubject[c.subject]?.label || "")} · ${pct} % terminé</p></div>
        <a class="btn btn--secondary btn--sm" href="cours.html?c=${encodeURIComponent(c.slug)}">${pct === 100 ? "Revoir" : "Continuer"}</a></li>`;
    }).join("");
  }

  const mine = data.publicCourses.filter(c => c.level === user.level &&
    (!user.series || !c.series?.length || c.series.includes(user.series)));
  $("#myLevelCourses").innerHTML = mine.slice(0, 6).map(c => courseCard(c, data)).join("") ||
    `<p class="empty">Les cours de votre niveau arrivent bientôt.</p>`;
  $("#allMyLevel").href = `catalogue.html?niveau=${encodeURIComponent(user.level || "")}`;
}

function teacherView(data, user, welcome) {
  const MAX_MB = Number(CK_CONFIG.maxVideoMB) || 50;
  const canUpload = api.mode === "supabase";
  $("#teacher").hidden = false;
  $("#demoTeacher").hidden = api.mode !== "demo";
  const approved = user.status === "approved";
  $("#welcomeTeacher").hidden = !(welcome && approved);
  $("#pendingTeacher").hidden = user.status !== "pending";
  $("#rejectedTeacher").hidden = user.status !== "rejected";
  $("#publishPanel").hidden = !approved;

  const subject = data.bySubject[user.subject];
  $("#subtitle").textContent = `Espace professeur · ${subject?.label || ""}`;
  setupAvatar(user, subject);
  $("#pName").textContent = `${user.firstName} ${user.lastName}`;
  $("#pSubject").textContent = [subject?.label, (user.levels || []).map(l => LEVELS[l]).join(" & ")].filter(Boolean).join(" · ");
  $("#pBio").textContent = user.bio || "Ajoutez une présentation lors de votre inscription.";

  // ----- My courses -----
  const myCourses = () => data.courses.filter(c => c.teacher === user.id && !c.sample);
  const renderMine = () => {
    const mine = myCourses();
    $("#myCourses").innerHTML = mine.length ? mine.map(c => `
      <li><div><a href="cours.html?c=${encodeURIComponent(c.slug)}">${esc(c.title)}</a>
        <p class="tcard__job">${esc(LEVELS[c.level])} · ${c.lessons.length} vidéo${c.lessons.length > 1 ? "s" : ""} ·
          ${c.published === false ? `<span class="badge badge--draft">Brouillon</span>` : "Publié"}</p></div>
        <div class="mine__actions">
          <button class="btn btn--secondary btn--sm" type="button" data-toggle="${esc(c.slug)}">${c.published === false ? "Publier" : "Masquer"}</button>
          <button class="btn-danger" type="button" data-del="${esc(c.slug)}">Supprimer</button>
        </div></li>`).join("")
      : `<li class="muted">Vous n'avez pas encore publié de cours.</li>`;
  };
  renderMine();
  $("#myCourses").addEventListener("click", async e => {
    const btn = e.target.closest("[data-del],[data-toggle]");
    if (!btn) return;
    const course = myCourses().find(c => c.slug === (btn.dataset.del || btn.dataset.toggle));
    if (!course) return;
    try {
      btn.disabled = true;
      if (btn.dataset.del) {
        if (!confirm(`Supprimer définitivement « ${course.title} » et ses vidéos ?`)) { btn.disabled = false; return; }
        await api.deleteCourse(course);
        data.courses = data.courses.filter(c => c !== course);
      } else {
        const published = course.published === false;
        await api.setPublished(course, published);
        course.published = published;
      }
      renderMine();
    } catch (err) { alert(err.message); btn.disabled = false; }
  });

  if (!approved) return;

  // ----- Publish form -----
  const levels = user.levels?.length ? user.levels : ["bepc", "bac"];
  $("#cLevel").innerHTML = levels.map(l => `<option value="${l}">${LEVEL_LONG[l]}</option>`).join("");
  if (!canUpload) $("#videoHelp").textContent = "Collez le lien YouTube de chaque vidéo (vous pouvez la mettre en « non répertoriée »). L'envoi de fichiers sera disponible quand la base de données sera connectée.";

  const lessonsEl = $("#lessons");
  let n = 0;
  const addLesson = () => {
    n++;
    lessonsEl.insertAdjacentHTML("beforeend", `
      <div class="form-grid lesson-row" style="padding:12px;border:1px solid var(--line);border-radius:8px">
        <div class="form-grid form-grid--2">
          <div class="field"><label for="lt${n}">Titre de la vidéo</label><input id="lt${n}" name="lt" required maxlength="120"></div>
          <div class="field"><label for="ld${n}">Durée (min)</label><input id="ld${n}" name="ld" type="number" min="1" max="600" inputmode="numeric"></div>
        </div>
        ${canUpload ? `<div class="field"><label for="lf${n}">Fichier vidéo <small>(MP4, WebM ou MOV — ${MAX_MB} Mo max.)</small></label>
          <input id="lf${n}" name="lf" type="file" accept="video/mp4,video/webm,video/quicktime"></div>` : ""}
        <div class="field"><label for="lv${n}">${canUpload ? "… ou lien YouTube" : "Lien YouTube"}</label><input id="lv${n}" name="lv" type="url" placeholder="https://youtu.be/…"></div>
        ${n > 1 ? `<button type="button" class="btn-danger" data-remove style="justify-self:start">Retirer cette vidéo</button>` : ""}
      </div>`);
  };
  addLesson();
  $("#addLesson").addEventListener("click", addLesson);
  lessonsEl.addEventListener("click", e => { if (e.target.matches("[data-remove]")) e.target.closest(".lesson-row").remove(); });
  // Fill the duration from the chosen file's metadata
  lessonsEl.addEventListener("change", e => {
    if (e.target.name !== "lf" || !e.target.files[0]) return;
    const row = e.target.closest(".lesson-row"), dur = $('[name="ld"]', row);
    const v = document.createElement("video"), url = URL.createObjectURL(e.target.files[0]);
    v.preload = "metadata";
    v.onloadedmetadata = () => { if (!dur.value && isFinite(v.duration)) dur.value = Math.max(1, Math.round(v.duration / 60)); URL.revokeObjectURL(url); };
    v.onerror = () => URL.revokeObjectURL(url);
    v.src = url;
  });

  const form = $("#publish"), err = $("#pubError");
  const showErr = msg => { err.textContent = msg; err.hidden = !msg; };
  form.addEventListener("submit", async e => {
    e.preventDefault();
    showErr("");
    const invalid = [...form.elements].find(el => el.willValidate && !el.checkValidity());
    if (invalid) { showErr(`${invalid.labels?.[0]?.textContent.trim() || "Champ"} : ${invalid.validationMessage}`); invalid.focus(); return; }

    const lessons = $$(".lesson-row", form).map(r => ({
      t: $('[name="lt"]', r).value.trim(),
      d: Number($('[name="ld"]', r).value) || 0,
      v: $('[name="lv"]', r).value.trim(),
      file: $('[name="lf"]', r)?.files[0] || null
    }));
    const bad = lessons.findIndex(l => !l.file && !l.v);
    if (bad >= 0) { showErr(`Vidéo ${bad + 1} : ${canUpload ? "choisissez un fichier ou collez un lien" : "collez un lien"}.`); return; }
    const notHttps = lessons.findIndex(l => !l.file && !/^https:\/\//.test(l.v));
    if (notHttps >= 0) { showErr(`Vidéo ${notHttps + 1} : le lien doit commencer par https://`); return; }
    const big = lessons.findIndex(l => l.file && l.file.size > MAX_MB * 1024 * 1024);
    if (big >= 0) { showErr(`Vidéo ${big + 1} : fichier trop lourd (${Math.round(lessons[big].file.size / 1048576)} Mo, maximum ${MAX_MB} Mo). Compressez-la ou publiez-la sur YouTube.`); return; }

    const course = {
      title: $("#cTitle").value.trim(), level: $("#cLevel").value, summary: $("#cSummary").value.trim(),
      series: $("#cSeries").value.split(/[,\s/]+/).map(s => s.trim().toUpperCase()).filter(Boolean),
      published: form.elements.published.checked
    };
    const submit = $('button[type="submit"]', form);
    submit.disabled = true; submit.textContent = "Publication…";
    const hasFiles = lessons.some(l => l.file);
    $("#uploadBox").hidden = !hasFiles;
    try {
      const slug = await api.publishCourse(user, course, lessons, (ratio, i) => {
        $("#uploadBar").style.width = `${Math.round(ratio * 100)}%`;
        $("#uploadLabel").textContent = `Envoi de la vidéo ${i + 1}… ${Math.round(ratio * 100)} % — gardez cette page ouverte.`;
      });
      location.href = `cours.html?c=${encodeURIComponent(slug)}`;
    } catch (e2) {
      showErr(e2.message);
      submit.disabled = false; submit.textContent = "Publier le cours";
      $("#uploadBox").hidden = true;
    }
  });
}

// "Mon profil": profile picture with the initials as fallback, uploaded through api.uploadAvatar.
function setupAvatar(user, subject) {
  const name = `${user.firstName} ${user.lastName}`;
  const show = url => { $("#pAvatar").innerHTML = avatarHtml(name, subject?.color, url, "avatar--lg"); };
  const msg = (text, ok) => { const el = $("#avatarMsg"); el.textContent = text; el.hidden = !text; el.classList.toggle("alert--ok", !!ok); };
  const setLabel = () => { $("#avatarBtn").textContent = user.avatarUrl ? "Changer ma photo" : "Choisir une photo"; };
  show(user.avatarUrl);
  setLabel();

  $("#avatarInput").addEventListener("change", async e => {
    const file = e.target.files[0];
    e.target.value = "";                         // allow choosing the same file again
    if (!file) return;
    msg("");
    try { checkAvatarFile(file); } catch (err) { return msg(err.message); }
    const previous = user.avatarUrl;
    const preview = URL.createObjectURL(file);   // show the chosen photo right away
    $("#pAvatar").innerHTML = avatarHtml(name, subject?.color, "", "avatar--lg is-uploading");
    $(".avatar", $("#pAvatar")).insertAdjacentHTML("beforeend", `<img src="${preview}" alt="">`);
    $("#avatarBtn").textContent = "Envoi…";
    $("#avatarInput").disabled = true;
    try {
      const url = await api.uploadAvatar(user, file);
      show(url);
      msg("Photo de profil enregistrée.", true);
    } catch (err) {
      show(previous);
      msg(err.message);
    } finally {
      URL.revokeObjectURL(preview);
      $("#avatarInput").disabled = false;
      setLabel();
    }
  });
}
