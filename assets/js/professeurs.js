// "Nos professeurs": directory of validated teachers (public_teachers in Supabase mode),
// filterable by subject. Real teachers take priority over the example profiles.

(async () => {
  const data = await boot();
  const teachers = directoryTeachers(data);
  const count = id => data.publicCourses.filter(c => c.teacher === id).length;
  $("#sampleNote").hidden = !teachers.some(t => t.sample);

  const params = new URLSearchParams(location.search);
  const initial = data.bySubject[params.get("matiere")] ? params.get("matiere") : "all";
  $("#subjectFilters").innerHTML = [{ id: "all", label: "Toutes les matières" }, ...data.subjects].map(s =>
    `<button class="chip chip--filter" type="button" data-filter="${esc(s.id)}" aria-pressed="${s.id === initial}">${esc(s.label)}</button>`).join("");

  const render = f => {
    const list = teachers.filter(t => f === "all" || t.subject === f);
    $("#teacherCount").textContent = `${list.length} professeur${list.length > 1 ? "s" : ""}`;
    $("#teachers").innerHTML = list.length
      ? list.map(t => teacherCard(t, data, count(t.id))).join("")
      : `<p class="empty">Aucun professeur pour cette matière pour l'instant.</p>`;
  };

  $("#subjectFilters").addEventListener("click", e => {
    const b = e.target.closest("[data-filter]");
    if (!b) return;
    $$("[data-filter]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    const f = b.dataset.filter;
    history.replaceState(null, "", f === "all" ? location.pathname : `${location.pathname}?matiere=${encodeURIComponent(f)}`);
    render(f);
  });
  render(initial);
})();
