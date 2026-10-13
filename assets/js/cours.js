// Course page: video player, lesson list with progress, prev/next navigation.

(async () => {
  const data = await boot();
  const slug = new URLSearchParams(location.search).get("c");
  const course = data.courses.find(c => c.slug === slug);
  if (!course || !course.lessons.length) {
    $("#title").textContent = "Cours introuvable";
    $("#summary").innerHTML = `Ce cours n'existe pas ou a été retiré. <a href="catalogue.html">Voir tous les cours</a>`;
    $("#course").hidden = true;
    $("#related").closest("section").hidden = true;
    return;
  }

  const subject = data.bySubject[course.subject], teacher = data.byTeacher[course.teacher];
  const series = course.series?.length ? ` ${course.series.join("/")}` : "";
  document.title = `${course.title} — Collection Kaela`;
  $("#crumbs").insertAdjacentHTML("beforeend",
    `<li><a href="catalogue.html?matiere=${encodeURIComponent(course.subject)}">${esc(subject?.label || "")}</a></li><li aria-current="page">${esc(course.title)}</li>`);
  $("#badges").innerHTML = `<span class="badge badge--${esc(course.level)}">${esc(LEVEL_LONG[course.level] || "")}${esc(series)}</span>
    <span class="badge badge--soft">${esc(subject?.label || "")}</span>
    <span class="badge badge--soft">${course.lessons.length} vidéos · ${fmtDuration(totalMinutes(course))}</span>`;
  $("#title").textContent = course.title;
  if (course.published === false) $("#badges").insertAdjacentHTML("afterbegin", `<span class="badge badge--draft">Brouillon — visible par vous seul</span>`);
  $("#summary").textContent = course.summary || "";
  $("#course").style.setProperty("--c", subject?.color || "var(--brand)");

  if (teacher) {
    $("#profBox").innerHTML = `
      ${avatarHtml(teacher.name, subject?.color, teacher.avatar)}
      <div><strong>${esc(teacher.name)}</strong><p class="muted">${esc(teacher.bio)}</p>
      <a class="link-arrow" href="catalogue.html?prof=${encodeURIComponent(teacher.id)}">Tous ses cours →</a></div>`;
  }

  // Matching Édition Kaela book: same subject, preferring the course's exam level
  const books = await load("books");
  const book = books.filter(b => b.subject === course.subject).sort((a, b) => (b.exam === course.level) - (a.exam === course.level))[0]
    || books.find(b => !b.subject && b.exam === course.level);
  if (book) {
    $("#bookAside").hidden = false;
    $("#bookAside").innerHTML = `<img src="${esc(book.image)}" alt="Couverture EDHC ${esc(book.title)} ${esc(book.grade)}" width="300" height="470" loading="lazy">
      <div><span class="eyebrow">Le livre pour aller plus loin</span><p><strong>EDHC ${esc(book.title)} · ${esc(book.grade)}</strong></p>
      <p class="muted">${esc(book.tagline)}</p><a class="link-arrow" href="index.html#livres">Voir nos livres →</a></div>`;
  }

  const progress = await api.progress(data.courses);
  const done = new Set(progress[slug] || []);
  let current = Math.max(0, course.lessons.findIndex((_, i) => !done.has(i)));

  function show(i) {
    current = i;
    const lesson = course.lessons[i];
    const id = youtubeId(lesson.v);
    const isFile = !id && /^https:\/\//.test(lesson.v || "");
    $("#player").innerHTML = id
      ? `<iframe src="https://www.youtube-nocookie.com/embed/${id}" title="${esc(lesson.t)}" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe>`
      : isFile
      ? `<video src="${esc(lesson.v)}" controls preload="metadata" playsinline title="${esc(lesson.t)}"></video>`
      : `<div class="player__placeholder"><div><span class="player__icon" aria-hidden="true"></span>
           <p><strong>${esc(lesson.t)}</strong><br>La vidéo de cette leçon sera ajoutée par le professeur.</p></div></div>`;
    $("#lessonTitle").textContent = `${i + 1}. ${lesson.t}`;
    $("#prev").disabled = i === 0;
    $("#next").disabled = i === course.lessons.length - 1;
    renderToc();
  }

  function renderToc() {
    $("#toc").innerHTML = course.lessons.map((l, i) => `
      <li><button type="button" data-i="${i}" class="${done.has(i) ? "is-done" : ""}" ${i === current ? 'aria-current="true"' : ""}>
        <span>${esc(l.t)}</span><small>${l.d ? `${l.d} min` : ""}</small></button></li>`).join("");
    const pct = Math.round(done.size / course.lessons.length * 100);
    $("#progressBar").style.width = `${pct}%`;
    $("#progressLabel").textContent = `${done.size} / ${course.lessons.length} vidéos vues · ${pct} %`;
    $("#tocCount").textContent = fmtDuration(totalMinutes(course));
    const isDone = done.has(current);
    $("#markDone").textContent = isDone ? "✓ Vue" : "Marquer comme vue";
    $("#markDone").setAttribute("aria-pressed", String(isDone));
  }

  $("#toc").addEventListener("click", e => {
    const b = e.target.closest("button[data-i]");
    if (b) { show(Number(b.dataset.i)); $("#player").scrollIntoView({ block: "nearest" }); }
  });
  $("#prev").addEventListener("click", () => current > 0 && show(current - 1));
  $("#next").addEventListener("click", () => current < course.lessons.length - 1 && show(current + 1));
  $("#markDone").addEventListener("click", async () => {
    const i = current, nowDone = !done.has(i);
    nowDone ? done.add(i) : done.delete(i);
    renderToc();
    try { await api.setDone(course, i, nowDone); }
    catch (err) {
      nowDone ? done.delete(i) : done.add(i);
      renderToc();
      alert(err.message);
    }
  });

  show(current);

  const related = data.publicCourses.filter(c => c.subject === course.subject && c.slug !== slug)
    .sort((a, b) => (b.level === course.level) - (a.level === course.level)).slice(0, 3);
  if (related.length) $("#related").innerHTML = related.map(c => courseCard(c, data)).join("");
  else $("#related").closest("section").hidden = true;
})();
