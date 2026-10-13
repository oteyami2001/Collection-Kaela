// Administration: validate teacher accounts, publish/feature/delete courses.
// Only works with the database connected and for accounts marked is_admin (see README).

(async () => {
  const data = await boot();
  const msg = text => { $("#adminMsg").textContent = text; $("#adminMsg").hidden = !text; };
  if (api.mode === "demo") return msg("L'administration est disponible quand la base de données Supabase est connectée (voir le README).");
  if (!data.user) return msg("Connectez-vous avec un compte administrateur.");
  if (!data.user.isAdmin) return msg("Cette page est réservée aux administrateurs.");

  // ----- Teachers -----
  let teachers = [], status = "pending";
  const STATUS = { pending: "En attente", approved: "Validé", rejected: "Refusé" };
  const renderTeachers = () => {
    const list = teachers.filter(t => t.teacher_status === status);
    $$("[data-status]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.status === status)));
    $("#teacherList").innerHTML = list.length ? list.map(t => `
      <li><div>
        <strong>${esc(t.first_name)} ${esc(t.last_name)}</strong> · ${esc(data.bySubject[t.subject]?.label || "Matière non précisée")}
        <p class="tcard__job">${(t.levels || []).map(l => LEVELS[l]).join(" & ") || "—"}${t.years ? ` · ${t.years} ans d'expérience` : ""}${t.school ? ` · ${esc(t.school)}` : ""}</p>
        <p class="tcard__job"><a href="mailto:${esc(t.email)}">${esc(t.email)}</a>${t.phone ? ` · <a href="tel:${esc(t.phone.replace(/\s+/g, ""))}">${esc(t.phone)}</a>` : ""} · inscrit le ${new Date(t.created_at).toLocaleDateString("fr-FR")}</p>
        ${t.bio ? `<p class="muted" style="margin:6px 0 0">${esc(t.bio)}</p>` : ""}
      </div>
      <div class="mine__actions">
        ${t.teacher_status !== "approved" ? `<button class="btn btn--primary btn--sm" type="button" data-set="approved" data-id="${esc(t.id)}">Valider</button>` : ""}
        ${t.teacher_status !== "rejected" ? `<button class="btn-danger" type="button" data-set="rejected" data-id="${esc(t.id)}">Refuser</button>` : ""}
        ${t.teacher_status !== "pending" ? `<button class="btn btn--ghost btn--sm" type="button" data-set="pending" data-id="${esc(t.id)}">Remettre en attente</button>` : ""}
      </div></li>`).join("")
      : `<li class="muted">Aucun professeur « ${STATUS[status].toLowerCase()} ».</li>`;
  };
  try { teachers = await api.adminTeachers(); }
  catch (err) { return msg(err.message); }
  $("#teachersPanel").hidden = false;
  renderTeachers();
  $("#teachersPanel").addEventListener("click", async e => {
    const filter = e.target.closest("[data-status]");
    if (filter) { status = filter.dataset.status; return renderTeachers(); }
    const btn = e.target.closest("[data-set]");
    if (!btn) return;
    btn.disabled = true;
    try {
      await api.adminSetTeacher(btn.dataset.id, btn.dataset.set);
      teachers.find(t => t.id === btn.dataset.id).teacher_status = btn.dataset.set;
      renderTeachers();
      msg("");
    } catch (err) { msg(err.message); btn.disabled = false; }
  });

  // ----- Courses (RLS lets admins read every course, drafts included) -----
  const names = Object.fromEntries(teachers.map(t => [t.id, `${t.first_name} ${t.last_name}`]));
  let courses = data.courses.filter(c => !c.sample);
  const renderCourses = () => {
    $("#courseList").innerHTML = courses.length ? courses.map(c => `
      <li><div><a href="cours.html?c=${encodeURIComponent(c.slug)}">${esc(c.title)}</a>
        <p class="tcard__job">${esc(names[c.teacher] || "Professeur")} · ${esc(data.bySubject[c.subject]?.label || "")} · ${esc(LEVELS[c.level])} · ${c.lessons.length} vidéo(s)
          ${c.published ? "" : ` · <span class="badge badge--draft">Non publié</span>`}${c.featured ? ` · <span class="badge">À la une</span>` : ""}</p></div>
        <div class="mine__actions">
          <button class="btn btn--secondary btn--sm" type="button" data-course="${esc(c.id)}" data-act="featured">${c.featured ? "Retirer de la une" : "Mettre à la une"}</button>
          <button class="btn btn--ghost btn--sm" type="button" data-course="${esc(c.id)}" data-act="published">${c.published ? "Masquer" : "Publier"}</button>
          <button class="btn-danger" type="button" data-course="${esc(c.id)}" data-act="delete">Supprimer</button>
        </div></li>`).join("")
      : `<li class="muted">Aucun cours publié pour l'instant.</li>`;
  };
  $("#coursesPanel").hidden = false;
  renderCourses();
  $("#courseList").addEventListener("click", async e => {
    const btn = e.target.closest("[data-course]");
    if (!btn) return;
    const c = courses.find(x => x.id === btn.dataset.course);
    btn.disabled = true;
    try {
      if (btn.dataset.act === "delete") {
        if (!confirm(`Supprimer définitivement « ${c.title} » et ses vidéos ?`)) { btn.disabled = false; return; }
        await api.deleteCourse(c);
        courses = courses.filter(x => x !== c);
      } else {
        const next = { published: c.published, featured: c.featured, [btn.dataset.act]: !c[btn.dataset.act] };
        await api.adminSetCourse(c.id, next.published, next.featured);
        Object.assign(c, next);
      }
      renderCourses();
      msg("");
    } catch (err) { msg(err.message); btn.disabled = false; }
  });
})();
