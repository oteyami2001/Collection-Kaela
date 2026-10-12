// Catalogue: filters (level, subjects, teacher), search and sort, all synced to the URL.

(async () => {
  const data = await boot();
  const form = $("#filters"), q = $("#q"), sort = $("#sort");
  const params = new URLSearchParams(location.search);

  $("#subjectOpts").innerHTML = data.subjects.map(s =>
    `<label class="opt"><input type="checkbox" name="matiere" value="${esc(s.id)}"> ${esc(s.label)}</label>`).join("");
  $("#prof").insertAdjacentHTML("beforeend", data.teachers.filter(t => !t.pending).map(t =>
    `<option value="${esc(t.id)}">${esc(t.name)} — ${esc(data.bySubject[t.subject]?.label || "")}</option>`).join(""));

  // Restore state from the URL
  const level = params.get("niveau") || "";
  const levelInput = $(`input[name="niveau"][value="${CSS.escape(level)}"]`, form);
  if (levelInput) levelInput.checked = true;
  const subjects = params.getAll("matiere");
  $$('input[name="matiere"]', form).forEach(i => { i.checked = subjects.includes(i.value); });
  $("#prof").value = data.byTeacher[params.get("prof")] ? params.get("prof") : "";
  q.value = params.get("q") || "";
  if ([...sort.options].some(o => o.value === params.get("tri"))) sort.value = params.get("tri");

  // Collapse filters by default on small screens
  if (matchMedia("(max-width: 1023px)").matches) $("#filtersPanel").open = false;

  const norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  function render() {
    const lvl = form.niveau.value;
    const subs = $$('input[name="matiere"]:checked', form).map(i => i.value);
    const prof = $("#prof").value;
    const terms = norm(q.value.trim()).split(/\s+/).filter(Boolean);

    let list = data.publicCourses.filter(c => {
      if (lvl && c.level !== lvl) return false;
      if (subs.length && !subs.includes(c.subject)) return false;
      if (prof && c.teacher !== prof) return false;
      if (!terms.length) return true;
      const hay = norm([c.title, c.summary, data.bySubject[c.subject]?.label, data.byTeacher[c.teacher]?.name, ...c.lessons.map(l => l.t)].join(" "));
      return terms.every(t => hay.includes(t));
    });
    const by = {
      titre: (a, b) => a.title.localeCompare(b.title, "fr"),
      duree: (a, b) => totalMinutes(a) - totalMinutes(b),
      videos: (a, b) => b.lessons.length - a.lessons.length
    }[sort.value];
    if (by) list = [...list].sort(by);

    $("#results").innerHTML = list.map(c => courseCard(c, data)).join("");
    $("#empty").hidden = list.length > 0;
    $("#count").textContent = `${list.length} cours ${list.length > 1 ? "disponibles" : "disponible"}`;
    const subjLabel = subs.length === 1 ? data.bySubject[subs[0]]?.label : "";
    $("#title").textContent = [subjLabel || "Tous les cours", lvl ? `· ${LEVELS[lvl]}` : ""].join(" ").trim();
    document.title = `${$("#title").textContent} — Collection Kaela`;

    const next = new URLSearchParams();
    if (lvl) next.set("niveau", lvl);
    subs.forEach(s => next.append("matiere", s));
    if (prof) next.set("prof", prof);
    if (q.value.trim()) next.set("q", q.value.trim());
    if (sort.value !== "pertinence") next.set("tri", sort.value);
    const qs = next.toString();
    history.replaceState(null, "", `${location.pathname}${qs ? `?${qs}` : ""}`);
  }

  form.addEventListener("change", render);
  form.addEventListener("reset", () => setTimeout(render));
  q.addEventListener("input", render);
  $("#searchForm").addEventListener("submit", e => e.preventDefault());
  sort.addEventListener("change", render);
  $("#resetAll").addEventListener("click", () => { form.reset(); q.value = ""; sort.value = "pertinence"; render(); });
  render();
})();
