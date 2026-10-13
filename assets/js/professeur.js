// Individual teacher profile: professeur.html?id=<teacher id>.
// Uses only the public teacher fields (public_teachers in Supabase mode) and the teacher's
// published courses; "Voir le cours" opens the existing course page (cours.html).

(async () => {
  const data = await boot();
  const id = new URLSearchParams(location.search).get("id") || "";
  const t = data.byTeacher[id];

  // Validated teachers only (a signed-in teacher may preview their own pending profile)
  if (!t || (t.pending && !t.self)) {
    document.title = "Professeur introuvable — Préparation d'Examen Collection Kaela";
    $("#crumbName").textContent = "Introuvable";
    $("#profileHero").innerHTML = `<div><h1>Professeur introuvable</h1>
      <p class="muted">Ce profil n'existe pas ou n'est pas encore validé.</p>
      <a class="btn btn--primary" href="professeurs.html">Voir tous les professeurs</a></div>`;
    $("#cours").hidden = true;
    return;
  }

  const s = data.bySubject[t.subject], levels = teacherLevels(t);
  document.title = `${t.name} — Professeur · Préparation d'Examen Collection Kaela`;
  $("#crumbName").textContent = t.name;
  $("#profileHero").innerHTML = `
    ${avatarHtml(t.name, s?.color, t.avatar, "avatar--xl")}
    <div>
      ${t.sample ? `<span class="badge badge--sample">Profil d'exemple</span>` : ""}
      ${t.pending ? `<p class="alert">Votre profil sera visible par tous après sa validation par l'équipe Collection Kaela.</p>` : ""}
      <h1>${esc(t.name)}</h1>
      <p class="profile-hero__subject">${esc(s?.label || "")}</p>
      <div class="profile-hero__facts">
        ${levels.map(l => `<span class="badge badge--${l === "BAC" ? "bac" : "bepc"}">${l}</span>`).join("")}
        ${t.years ? `<span class="badge badge--soft">${esc(yearsLabel(t.years))}</span>` : ""}
      </div>
      ${t.bio ? `<p class="profile-hero__bio">${esc(t.bio)}</p>` : ""}
      <div class="profile-hero__actions">
        <a class="btn btn--primary" href="#cours">Voir ses cours</a>
        <a class="btn btn--secondary" href="professeurs.html">Tous les professeurs</a>
      </div>
    </div>`;

  // Published courses of this teacher (publicCourses = published + validated teacher)
  const courses = data.publicCourses.filter(c => c.teacher === t.id);
  $("#coursesCount").textContent = courses.length
    ? `${courses.length} cours publié${courses.length > 1 ? "s" : ""}`
    : "Ce professeur n'a pas encore publié de cours.";
  $("#teacherCourses").innerHTML = courses.map(c => {
    const subj = data.bySubject[c.subject];
    const series = c.series?.length ? ` · Série${c.series.length > 1 ? "s" : ""} ${c.series.join(", ")}` : "";
    const url = `cours.html?c=${encodeURIComponent(c.slug)}`;
    return `<article class="card">
      ${thumb(subj, subj?.label || "")}
      <div class="card__body">
        <div class="card__badges">
          <span class="badge badge--${esc(c.level)}">${esc(LEVEL_LONG[c.level] || c.level)}${esc(series)}</span>
          <span class="badge badge--soft">${esc(subj?.label || c.subject)}</span>
        </div>
        <h3><a href="${url}">${esc(c.title)}</a></h3>
        ${c.summary ? `<p class="card__summary">${esc(c.summary)}</p>` : ""}
        <p class="card__meta">${c.lessons.length} vidéo${c.lessons.length > 1 ? "s" : ""} · ${fmtDuration(totalMinutes(c))}</p>
        <a class="btn btn--primary btn--sm" href="${url}">Voir le cours</a>
      </div>
    </article>`;
  }).join("");

  // "Voir ses cours" from the directory links here with #cours: scroll once the content exists
  if (location.hash === "#cours") requestAnimationFrame(() => $("#cours").scrollIntoView());
})();
