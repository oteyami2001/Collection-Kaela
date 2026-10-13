// Collection Kaela — shared helpers, header, footer and demo account storage.
// Serve the site over HTTP (e.g. `python3 -m http.server`): fetch() does not work from file://.

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s = "") => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const load = async name => {
  try { const r = await fetch(`data/${name}.json`); return r.ok ? r.json() : []; }
  catch { return []; }
};

const LEVELS = { bepc: "BEPC", bac: "BAC" };
const LEVEL_LONG = { bepc: "BEPC · 3e", bac: "BAC · Terminale" };

// Per-browser storage (demo mode, progress on sample courses, small UI preferences).
const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
  remove(key) { try { localStorage.removeItem(key); } catch {} }
};

// Loads the signed-in user and the catalog through the data layer (assets/js/api.js).
// publicCourses = what visitors may see: published courses of validated teachers.
async function loadAll() {
  await api.init();
  const [user, cat] = await Promise.all([api.user(), api.catalog()]);
  const byTeacher = index(cat.teachers);
  const publicCourses = cat.courses.filter(c => c.published !== false && byTeacher[c.teacher] && !byTeacher[c.teacher].pending);
  return { ...cat, user, publicCourses, bySubject: index(cat.subjects), byTeacher };
}
const index = list => Object.fromEntries(list.map(x => [x.id, x]));
const totalMinutes = c => c.lessons.reduce((n, l) => n + (l.d || 0), 0);
const fmtDuration = min => min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}` : `${min} min`;
const initials = name => name.replace(/^(M\.|Mme|Mlle)\s+/, "").split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();

// ----- Cards -----
function thumb(subject, label) {
  const color = subject?.color || "var(--brand)";
  return `<div class="thumb" style="--c:${esc(color)}" aria-hidden="true">
    <span class="thumb__icon">${esc(subject?.icon || "•")}</span>
    <span class="thumb__label">${esc(label)}</span>
    <span class="thumb__play"></span>
  </div>`;
}

function courseCard(c, data) {
  const s = data.bySubject[c.subject], t = data.byTeacher[c.teacher];
  const series = c.series?.length ? ` ${c.series.join("/")}` : "";
  return `<article class="card" data-level="${esc(c.level)}" data-subject="${esc(c.subject)}">
    ${thumb(s, s?.label || "")}
    <div class="card__body">
      <div class="card__badges">
        <span class="badge badge--${esc(c.level)}">${esc(LEVELS[c.level] || c.level)}${esc(series)}</span>
        <span class="badge badge--soft">${esc(s?.label || c.subject)}</span>
      </div>
      <h3><a href="cours.html?c=${encodeURIComponent(c.slug)}">${esc(c.title)}</a></h3>
      <p class="card__teacher">${esc(t?.name || "Professeur")}</p>
      <p class="card__meta">${c.lessons.length} vidéos · ${fmtDuration(totalMinutes(c))}</p>
    </div>
  </article>`;
}

// Round profile picture; the initials stay underneath as a fallback (no photo, or image failing to load).
// Only Supabase https URLs and the demo's small data: URLs are rendered.
function avatarHtml(name, color, url, extraClass = "") {
  const src = /^(https:\/\/|data:image\/(jpeg|png|webp);base64,)/.test(url || "") ? url : "";
  return `<span class="avatar ${extraClass}" style="--c:${esc(color || "var(--brand)")}" aria-hidden="true">${esc(initials(name))}${
    src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ""}</span>`;
}

// Teachers shown publicly: validated ones only. As soon as real (database) teachers exist,
// the example profiles of data/teachers.json are left out, so the two are never mixed.
function directoryTeachers(data) {
  const listed = data.teachers.filter(t => !t.pending);
  const real = listed.filter(t => !t.sample);
  return real.length ? real : listed;
}

const teacherUrl = t => `professeur.html?id=${encodeURIComponent(t.id)}`;
const teacherLevels = t => ["bac", "bepc"].filter(l => (t.levels || []).includes(l)).map(l => LEVELS[l]);
const yearsLabel = y => y ? `${y} an${y > 1 ? "s" : ""} d'expérience` : "";

function teacherCard(t, data, count) {
  const s = data.bySubject[t.subject], levels = teacherLevels(t);
  return `<article class="tcard tcard--teacher">
    ${t.sample ? `<span class="badge badge--sample">Profil d'exemple</span>` : ""}
    <div class="tcard__who">
      ${avatarHtml(t.name, s?.color, t.avatar, "avatar--md")}
      <div>
        <strong>${esc(t.name)}</strong>
        <p class="tcard__subject">${esc(s?.label || "")}</p>
        ${t.years ? `<p class="tcard__job">${esc(yearsLabel(t.years))}</p>` : ""}
      </div>
    </div>
    ${levels.length ? `<p class="tcard__levels">${levels.join(" • ")}</p>` : ""}
    ${t.bio ? `<p class="tcard__bio">${esc(t.bio)}</p>` : ""}
    <div class="tcard__actions">
      <a class="btn btn--secondary btn--sm" href="${teacherUrl(t)}">Voir le profil</a>
      <a class="btn btn--primary btn--sm" href="${teacherUrl(t)}#cours">Voir ses cours${count ? ` (${count})` : ""}</a>
    </div>
  </article>`;
}

function bookCard(b) {
  const exam = b.exam ? `<span class="badge badge--${esc(b.exam)}">${esc(LEVELS[b.exam])}</span>` : "";
  return `<article class="book">
    <img src="${esc(b.image)}" alt="Couverture du livre EDHC ${esc(b.title)} ${esc(b.grade)} — Édition Kaela" loading="lazy" width="300" height="470">
    <div class="book__body">
      <div class="card__badges"><span class="badge badge--soft">${esc(b.grade)}</span>${exam}</div>
      <h3>EDHC ${esc(b.title)}</h3>
      <p>${esc(b.tagline)}</p>
    </div>
  </article>`;
}

// ----- Layout -----
// Site logo « Réussir à 100 % » (img/logo-reussir-100*.webp) and contact details from the Édition Kaela flyer.
const LOGO = `<img class="logo__img" src="img/logo-reussir-100.webp" srcset="img/logo-reussir-100.webp 1x, img/logo-reussir-100@2x.webp 2x" alt="" width="64" height="64">`;
const LOGO_LIGHT = LOGO.replace('width="64" height="64"', 'width="88" height="88"');
const CONTACT = {
  phones: ["+225 07 07 81 50 28", "+225 01 41 73 77 85"],
  email: "editionkaela@gmail.com",
  address: "En face de l'église Saint-André, Yopougon — Abidjan"
};
const tel = n => `tel:${n.replace(/\s+/g, "")}`;

function renderHeader(subjects, user) {
  const actions = user
    ? `${user.isAdmin ? `<a href="admin.html" class="btn btn--ghost btn--sm">Administration</a>` : ""}
       <a href="espace.html" class="btn btn--ghost btn--sm">Mon espace</a>
       <button type="button" class="btn btn--secondary btn--sm" id="logout">Se déconnecter</button>`
    : `<a href="connexion.html" class="btn btn--ghost">Se connecter</a>
       <a href="inscription.html" class="btn btn--primary">S'inscrire</a>`;
  $("#site-header").outerHTML = `
  <header class="header" id="header">
    <div class="container header__inner">
      <a href="index.html" class="logo" aria-label="Collection Kaela, Réussir à 100 % — Préparation d'examen, accueil">${LOGO}
        <span class="logo__text">Préparation<small>d'examen</small></span>
      </a>
      <nav class="nav" id="nav" aria-label="Navigation principale">
        <ul class="nav__list">
          <li class="nav__item has-menu">
            <button class="nav__link" aria-expanded="false" aria-controls="mega">Cours</button>
            <div class="mega" id="mega" hidden>
              <div class="mega__cols">${subjects.map(s =>
                `<a href="catalogue.html?matiere=${s.id}"><span class="mega__icon" style="--c:${s.color}" aria-hidden="true">${esc(s.icon)}</span>${esc(s.label)}</a>`).join("")}
              </div>
              <div class="mega__promo">
                <a href="catalogue.html?niveau=bepc"><strong>Je prépare le BEPC</strong><span>Tous les cours de 3e →</span></a>
                <a href="catalogue.html?niveau=bac"><strong>Je prépare le BAC</strong><span>Tous les cours de Terminale →</span></a>
              </div>
            </div>
          </li>
          <li class="nav__item"><a class="nav__link" href="index.html#livres">Nos livres</a></li>
          <li class="nav__item"><a class="nav__link" href="professeurs.html">Professeurs</a></li>
          ${user ? "" : `<li class="nav__item"><a class="nav__link" href="inscription.html?role=prof">Devenir professeur</a></li>`}
        </ul>
        <div class="nav__actions">${actions}</div>
      </nav>
      <button class="burger" id="burger" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="nav"><span></span></button>
    </div>
  </header>`;

  const header = $("#header");
  addEventListener("scroll", () => header.classList.toggle("is-scrolled", scrollY > 8), { passive: true });
  const burger = $("#burger"), nav = $("#nav");
  burger.addEventListener("click", () => {
    const open = burger.getAttribute("aria-expanded") !== "true";
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
    nav.classList.toggle("is-open", open);
    document.body.style.overflow = open ? "hidden" : "";
  });
  const megaBtn = $(".has-menu > .nav__link"), mega = $("#mega");
  const setMega = open => { megaBtn.setAttribute("aria-expanded", String(open)); mega.hidden = !open; };
  megaBtn.addEventListener("click", () => setMega(mega.hidden));
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !mega.hidden) { setMega(false); megaBtn.focus(); } });
  document.addEventListener("click", e => { if (!e.target.closest(".has-menu")) setMega(false); });
  $("#logout")?.addEventListener("click", async () => { await api.signOut(); location.href = "index.html"; });
}

function renderFooter() {
  $("#site-footer").outerHTML = `
  <footer class="footer">
    <div class="container footer__grid">
      <div>
        <a href="index.html" class="logo logo--light" aria-label="Collection Kaela, Réussir à 100 %, accueil">${LOGO_LIGHT}</a>
        <p>Préparation d'Examen Collection Kaela : la plateforme ivoirienne qui accompagne les élèves vers la réussite au BEPC et au BAC.</p>
        <ul class="footer__contact">
          <li>📞 ${CONTACT.phones.map(n => `<a href="${tel(n)}">${n}</a>`).join(" · ")}</li>
          <li>✉️ <a href="mailto:${CONTACT.email}">${CONTACT.email}</a></li>
          <li>📍 ${CONTACT.address}</li>
        </ul>
      </div>
      <nav aria-label="Cours"><h3>Cours</h3><ul>
        <li><a href="catalogue.html?niveau=bepc">Cours BEPC</a></li>
        <li><a href="catalogue.html?niveau=bac">Cours BAC</a></li>
        <li><a href="catalogue.html">Toutes les matières</a></li></ul></nav>
      <nav aria-label="Professeurs"><h3>Professeurs</h3><ul>
        <li><a href="professeurs.html">Nos professeurs</a></li>
        <li><a href="inscription.html?role=prof">Devenir professeur</a></li></ul></nav>
      <nav aria-label="À propos"><h3>À propos</h3><ul>
        <li><a href="index.html#livres">Nos livres</a></li>
        <li><a href="index.html#mission">Notre mission</a></li>
        <li><a href="index.html#bientot">Nouveautés à venir</a></li></ul></nav>
      <nav aria-label="Aide"><h3>Aide</h3><ul>
        <li><a href="index.html#faq">Questions fréquentes</a></li>
        <li><a href="mailto:${CONTACT.email}">Contact</a></li></ul></nav>
    </div>
    <div class="container footer__bottom">
      <p>© ${new Date().getFullYear()} Édition Kaela · Préparation d'Examen Collection Kaela · Côte d'Ivoire</p>
      <ul><li><a href="#">Mentions légales</a></li><li><a href="#">CGU</a></li><li><a href="#">Confidentialité</a></li></ul>
    </div>
  </footer>`;
}

function observeReveal() {
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); }
  }), { threshold: .15 });
  $$(".reveal:not(.is-visible)").forEach(el => io.observe(el));
}

// Every page calls this first; it resolves with the loaded data.
async function boot() {
  let data;
  try { data = await loadAll(); }
  catch (err) {
    console.error(err);
    data = { subjects: await load("subjects"), teachers: [], courses: [], publicCourses: [], user: null, bySubject: {}, byTeacher: {}, offline: true };
    data.bySubject = index(data.subjects);
  }
  renderHeader(data.subjects, data.user);
  renderFooter();
  return data;
}
