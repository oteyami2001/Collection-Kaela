// "Mon espace": student dashboard (level courses, progress) or teacher dashboard (publish courses).

(async () => {
  const data = await boot();
  const user = getUser();
  const welcome = new URLSearchParams(location.search).has("bienvenue");
  if (!user) { $("#guest").hidden = false; return; }

  $("#hello").textContent = `Bonjour ${user.firstName} 👋`;
  if (user.role === "prof") teacherView(data, user, welcome);
  else studentView(data, user, welcome);
})();

function studentView(data, user, welcome) {
  $("#student").hidden = false;
  $("#welcomeStudent").hidden = !welcome;
  $("#subtitle").textContent = `Espace élève · ${LEVEL_LONG[user.level] || ""}${user.series ? ` · Série ${user.series}` : ""}`;
  $("#stLevel").textContent = LEVELS[user.level] || "—";

  const progress = getProgress();
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

  const mine = data.courses.filter(c => c.level === user.level &&
    (!user.series || !c.series?.length || c.series.includes(user.series)));
  $("#myLevelCourses").innerHTML = mine.slice(0, 6).map(c => courseCard(c, data)).join("") ||
    `<p class="empty">Les cours de votre niveau arrivent bientôt.</p>`;
  $("#allMyLevel").href = `catalogue.html?niveau=${encodeURIComponent(user.level || "")}`;
}

function teacherView(data, user, welcome) {
  $("#teacher").hidden = false;
  $("#welcomeTeacher").hidden = !welcome;
  const subject = data.bySubject[user.subject];
  $("#subtitle").textContent = `Espace professeur · ${subject?.label || ""}`;
  $("#pAvatar").textContent = initials(`${user.firstName} ${user.lastName}`);
  $("#pAvatar").style.setProperty("--c", subject?.color || "var(--brand)");
  $("#pName").textContent = `${user.firstName} ${user.lastName}`;
  $("#pSubject").textContent = [subject?.label, (user.levels || []).map(l => LEVELS[l]).join(" & ")].filter(Boolean).join(" · ");
  $("#pBio").textContent = user.bio || "Ajoutez une présentation lors de votre inscription.";

  const levels = user.levels?.length ? user.levels : ["bepc", "bac"];
  $("#cLevel").innerHTML = levels.map(l => `<option value="${l}">${LEVEL_LONG[l]}</option>`).join("");

  const lessonsEl = $("#lessons");
  let n = 0;
  const addLesson = () => {
    n++;
    lessonsEl.insertAdjacentHTML("beforeend", `
      <div class="form-grid form-grid--2 lesson-row" style="padding:12px;border:1px solid var(--line);border-radius:8px">
        <div class="field"><label for="lt${n}">Titre de la vidéo</label><input id="lt${n}" name="lt" required></div>
        <div class="field"><label for="ld${n}">Durée (min)</label><input id="ld${n}" name="ld" type="number" min="1" max="300" inputmode="numeric"></div>
        <div class="field" style="grid-column:1/-1"><label for="lv${n}">Lien YouTube</label><input id="lv${n}" name="lv" type="url" placeholder="https://youtu.be/…"></div>
      </div>`);
  };
  addLesson();
  $("#addLesson").addEventListener("click", addLesson);

  const renderMine = () => {
    const mine = getLocalCourses();
    $("#myCourses").innerHTML = mine.length ? mine.map(c => `
      <li><div><a href="cours.html?c=${encodeURIComponent(c.slug)}">${esc(c.title)}</a>
        <p class="tcard__job">${esc(LEVELS[c.level])} · ${c.lessons.length} vidéo${c.lessons.length > 1 ? "s" : ""}</p></div>
        <div class="mine__actions"><button class="btn-danger" type="button" data-del="${esc(c.slug)}">Supprimer</button></div></li>`).join("")
      : `<li class="muted">Vous n'avez pas encore publié de cours.</li>`;
  };
  renderMine();
  $("#myCourses").addEventListener("click", e => {
    const slug = e.target.closest("[data-del]")?.dataset.del;
    if (slug && confirm("Supprimer ce cours ?")) {
      store.set("ck-courses", getLocalCourses().filter(c => c.slug !== slug));
      renderMine();
    }
  });

  const form = $("#publish"), err = $("#pubError");
  form.addEventListener("submit", e => {
    e.preventDefault();
    const invalid = [...form.elements].find(el => el.willValidate && !el.checkValidity());
    if (invalid) {
      err.textContent = `${invalid.labels?.[0]?.textContent.trim() || "Champ"} : ${invalid.validationMessage}`;
      err.hidden = false; invalid.focus(); return;
    }
    err.hidden = true;
    const rows = $$(".lesson-row", form);
    const course = {
      slug: `prof-${Date.now().toString(36)}`,
      title: $("#cTitle").value.trim(),
      subject: user.subject, level: form.level.value, teacher: "me", featured: false,
      series: form.series.value.split(/[,\s/]+/).map(s => s.trim().toUpperCase()).filter(Boolean),
      summary: form.summary.value.trim(),
      lessons: rows.map(r => ({ t: $('[name="lt"]', r).value.trim(), d: Number($('[name="ld"]', r).value) || 0, v: $('[name="lv"]', r).value.trim() }))
    };
    store.set("ck-courses", [...getLocalCourses(), course]);
    location.href = `cours.html?c=${encodeURIComponent(course.slug)}`;
  });
}
