// Homepage: renders subjects, featured courses, teachers, testimonials and FAQ.

(async () => {
  const data = await boot();
  const [testimonials, faq] = await Promise.all([load("testimonials"), load("faq")]);
  const countBy = (key, id) => data.publicCourses.filter(c => c[key] === id).length;

  $("#subjects").innerHTML = data.subjects.map(s => `
    <a class="domain" style="--c:${esc(s.color)}" href="catalogue.html?matiere=${encodeURIComponent(s.id)}">
      <span class="domain__icon" aria-hidden="true">${esc(s.icon)}</span>
      <strong>${esc(s.label)}</strong><small>${countBy("subject", s.id)} cours</small>
    </a>`).join("");

  $("#subjects-mini").innerHTML = data.subjects.slice(0, 4).map(s => `
    <div class="domain" style="--c:${esc(s.color)}">
      <span class="domain__icon" aria-hidden="true">${esc(s.icon)}</span><strong>${esc(s.label)}</strong>
    </div>`).join("");

  // Featured courses + level filter
  const featuredEl = $("#featured");
  featuredEl.innerHTML = data.publicCourses.filter(c => c.featured).slice(0, 8).map(c => courseCard(c, data)).join("");
  $$(".chip--filter").forEach(btn => btn.addEventListener("click", () => {
    $$(".chip--filter").forEach(b => b.setAttribute("aria-pressed", String(b === btn)));
    const f = btn.dataset.filter;
    $$(".card", featuredEl).forEach(card => { card.hidden = f !== "all" && card.dataset.level !== f; });
  }));

  const books = await load("books");
  $("#books").innerHTML = books.map(bookCard).join("");

  $("#teachers").innerHTML = data.teachers.filter(t => !t.pending).slice(0, 4)
    .map(t => teacherCard(t, data, countBy("teacher", t.id))).join("");

  $("#testimonials").innerHTML = testimonials.map(t => `
    <figure class="tcard">
      <div class="tcard__who">
        <span class="avatar" aria-hidden="true">${esc(t.name.charAt(0))}</span>
        <div><strong>${esc(t.name)}</strong><p class="tcard__job">${esc(t.level)} · ${esc(t.subject)}</p></div>
      </div>
      <span class="stars" role="img" aria-label="${t.rating} sur 5">${"★".repeat(t.rating)}${"☆".repeat(5 - t.rating)}</span>
      <blockquote><p>${esc(t.quote)}</p></blockquote>
    </figure>`).join("");

  $("#faq-list").innerHTML = faq.map((f, i) => `
    <details name="faq"${i === 0 ? " open" : ""}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("");

  observeReveal();
})();

// Announcement bar (dismissal remembered)
const announce = $("#announce");
if (store.get("ck-announce-dismissed", false)) announce.remove();
$(".announce__close")?.addEventListener("click", () => { announce.remove(); store.set("ck-announce-dismissed", true); });
