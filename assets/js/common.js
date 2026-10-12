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

// ----- Demo storage (front-end only: replace with a real backend before launch) -----
const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
  remove(key) { try { localStorage.removeItem(key); } catch {} }
};
const getUser = () => store.get("ck-user", null);
const setUser = u => store.set("ck-user", u);
const logout = () => { store.remove("ck-user"); location.href = "index.html"; };
const getLocalCourses = () => store.get("ck-courses", []);
const getProgress = () => store.get("ck-progress", {});

// Loads every dataset and merges the courses a demo teacher published in this browser.
async function loadAll() {
  const [subjects, teachers, courses] = await Promise.all(["subjects", "teachers", "courses"].map(load));
  const user = getUser();
  if (user?.role === "prof") {
    teachers.push({ id: "me", name: `${user.firstName} ${user.lastName}`, subject: user.subject, levels: user.levels || [], years: user.years, bio: user.bio || "" });
  }
  courses.push(...getLocalCourses());
  return { subjects, teachers, courses, bySubject: index(subjects), byTeacher: index(teachers) };
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

function teacherCard(t, data, count) {
  const s = data.bySubject[t.subject];
  return `<article class="tcard tcard--teacher">
    <div class="tcard__who">
      <span class="avatar" style="--c:${esc(s?.color || "var(--brand)")}" aria-hidden="true">${esc(initials(t.name))}</span>
      <div><strong>${esc(t.name)}</strong><p class="tcard__job">${esc(s?.label || "")}${t.years ? ` · ${t.years} ans d'expérience` : ""}</p></div>
    </div>
    <p>${esc(t.bio)}</p>
    <div class="card__badges">${(t.levels || []).map(l => `<span class="badge badge--${esc(l)}">${esc(LEVELS[l])}</span>`).join("")}</div>
    <a class="link-arrow" href="catalogue.html?prof=${encodeURIComponent(t.id)}">Voir ses ${count} cours →</a>
  </article>`;
}

// ----- Layout -----
const LOGO = `<svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
  <rect width="36" height="36" rx="10" fill="var(--brand)"/>
  <path d="M8 11c3.5-1.6 7-1.6 10 .6v15c-3-2.2-6.5-2.2-10-.6z" fill="#fff"/>
  <path d="M28 11c-3.5-1.6-7-1.6-10 .6v15c3-2.2 6.5-2.2 10-.6z" fill="var(--accent)"/>
</svg>`;

function renderHeader(subjects) {
  const user = getUser();
  const actions = user
    ? `<a href="espace.html" class="btn btn--ghost">Mon espace</a>
       <button type="button" class="btn btn--secondary" id="logout">Se déconnecter</button>`
    : `<a href="connexion.html" class="btn btn--ghost">Se connecter</a>
       <a href="inscription.html" class="btn btn--primary">S'inscrire</a>`;
  $("#site-header").outerHTML = `
  <header class="header" id="header">
    <div class="container header__inner">
      <a href="index.html" class="logo" aria-label="Collection Kaela, accueil">${LOGO}
        <span class="logo__text">Collection Kaela<small>Préparation d'examen</small></span>
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
          <li class="nav__item"><a class="nav__link" href="professeurs.html">Professeurs</a></li>
          <li class="nav__item"><a class="nav__link" href="index.html#methode">Comment ça marche</a></li>
          <li class="nav__item"><a class="nav__link" href="inscription.html?role=prof">Devenir professeur</a></li>
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
  $("#logout")?.addEventListener("click", logout);
}

function renderFooter() {
  $("#site-footer").outerHTML = `
  <footer class="footer">
    <div class="container footer__grid">
      <div>
        <a href="index.html" class="logo logo--light">${LOGO}<span class="logo__text">Collection Kaela<small>Préparation d'examen</small></span></a>
        <p>La plateforme ivoirienne qui accompagne les élèves vers la réussite au BEPC et au BAC.</p>
      </div>
      <nav aria-label="Cours"><h3>Cours</h3><ul>
        <li><a href="catalogue.html?niveau=bepc">Cours BEPC</a></li>
        <li><a href="catalogue.html?niveau=bac">Cours BAC</a></li>
        <li><a href="catalogue.html">Toutes les matières</a></li></ul></nav>
      <nav aria-label="Professeurs"><h3>Professeurs</h3><ul>
        <li><a href="professeurs.html">Nos professeurs</a></li>
        <li><a href="inscription.html?role=prof">Devenir professeur</a></li></ul></nav>
      <nav aria-label="À propos"><h3>À propos</h3><ul>
        <li><a href="index.html#mission">Notre mission</a></li>
        <li><a href="index.html#bientot">Nouveautés à venir</a></li></ul></nav>
      <nav aria-label="Aide"><h3>Aide</h3><ul>
        <li><a href="index.html#faq">Questions fréquentes</a></li>
        <li><a href="#">Contact</a></li></ul></nav>
    </div>
    <div class="container footer__bottom">
      <p>© ${new Date().getFullYear()} Collection Kaela · Côte d'Ivoire</p>
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
  const data = await loadAll();
  renderHeader(data.subjects);
  renderFooter();
  return data;
}
