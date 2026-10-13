// Data layer: accounts, catalog, progress and publishing.
// Two interchangeable backends behind the same `api` object:
//   - "supabase" when assets/js/config.js holds a project URL and anon key;
//   - "demo" otherwise: everything lives in this browser's localStorage.
// Sample content from data/*.json is merged in when CK_CONFIG.showSampleContent is true.

const CFG = window.CK_CONFIG || {};
const SUPABASE_LIB = "assets/vendor/supabase-2.116.0.js";
const VIDEO_BUCKET = "videos";
const AVATAR_BUCKET = "avatars";

const loadScript = src => new Promise((resolve, reject) => {
  const s = document.createElement("script");
  s.src = src; s.onload = resolve; s.onerror = () => reject(new Error(`Impossible de charger ${src}`));
  document.head.append(s);
});

// Turns Supabase/network error messages into French sentences for the forms.
function frError(err) {
  const m = String(err?.message || err || "");
  const known = [
    [/invalid login credentials/i, "E-mail ou mot de passe incorrect."],
    [/email not confirmed/i, "Confirmez d'abord votre adresse e-mail : ouvrez le lien reçu par e-mail."],
    [/already registered|already been registered|user already exists/i, "Un compte existe déjà avec cet e-mail. Connectez-vous."],
    [/password should be at least|weak password/i, "Mot de passe trop faible : 8 caractères minimum."],
    [/rate limit|too many requests/i, "Trop de tentatives. Patientez quelques minutes puis réessayez."],
    [/payload too large|exceeded the maximum allowed size|413/i, "Fichier vidéo trop volumineux pour votre offre Supabase."],
    [/mime type|invalid_mime/i, "Format vidéo non accepté (MP4, WebM ou MOV)."],
    [/profiles_avatar_url_check/i, "Adresse de photo refusée : envoyez la photo depuis votre espace."],
    [/row-level security|permission denied/i, "Action non autorisée pour votre compte."],
    [/failed to fetch|networkerror|load failed|réseau/i, "Connexion impossible. Vérifiez votre connexion Internet."]
  ];
  return (known.find(([re]) => re.test(m)) || [null, m || "Une erreur est survenue."])[1];
}
const fail = err => { throw new Error(frError(err)); };

// ---------- Shared helpers ----------
const youtubeId = url => {
  if (!url) return "";
  const m = String(url).match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  return m ? m[1] : "";
};

async function sampleContent() {
  if (CFG.showSampleContent === false) return { teachers: [], courses: [] };
  const [teachers, courses] = await Promise.all([load("teachers"), load("courses")]);
  return { teachers: teachers.map(t => ({ ...t, sample: true })), courses: courses.map(c => ({ ...c, sample: true })) };
}

// Local progress (demo mode, and sample courses in Supabase mode): { slug: [lessonIndex] }
const localProgress = {
  all: () => store.get("ck-progress", {}),
  set(slug, i, done) {
    const all = this.all(), s = new Set(all[slug] || []);
    done ? s.add(i) : s.delete(i);
    store.set("ck-progress", { ...all, [slug]: [...s] });
  }
};

// ---------- Profile pictures ----------
const AVATAR_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const AVATAR_MAX_MB = 5;

function checkAvatarFile(file) {
  if (!file) throw new Error("Choisissez une photo.");
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!AVATAR_TYPES[file.type] || !["jpg", "jpeg", "png", "webp"].includes(ext)) {
    throw new Error("Format non accepté : choisissez une photo JPG, JPEG, PNG ou WebP.");
  }
  if (file.size > AVATAR_MAX_MB * 1024 * 1024) {
    throw new Error(`Photo trop lourde (${(file.size / 1048576).toFixed(1)} Mo) : ${AVATAR_MAX_MB} Mo maximum.`);
  }
}

// Center-crops the photo to a square and shrinks it to `size` px (JPEG), so the teachers
// page stays light on mobile data. Resolves to null if the browser cannot decode the image.
async function squareJpeg(file, size) {
  try {
    const img = await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), i = new Image();
      i.onload = () => { URL.revokeObjectURL(url); resolve(i); };
      i.onerror = () => { URL.revokeObjectURL(url); reject(new Error("decode")); };
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) return null;
    const out = Math.min(size, side), canvas = document.createElement("canvas");
    canvas.width = canvas.height = out;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";                       // transparent PNG/WebP → white background
    ctx.fillRect(0, 0, out, out);
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, out, out);
    return await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.86));
  } catch { return null; }
}

// ======================================================================
// Demo backend
// ======================================================================
const demo = {
  mode: "demo",
  async init() {},
  async user() {
    const u = store.get("ck-user", null);
    return u && { status: "approved", isAdmin: false, id: "me", ...u };
  },
  async signUp(profile) {
    const user = { ...profile, id: "me" };
    store.set("ck-account", user);
    store.set("ck-user", user);
    return { needsConfirmation: false };
  },
  async signIn(email) {
    const account = store.get("ck-account", null);
    if (!account || account.email !== email) throw new Error("Aucun compte trouvé avec cet e-mail sur cet appareil. Créez un compte pour commencer.");
    store.set("ck-user", account);
  },
  async signOut() { store.remove("ck-user"); },
  async resetPassword() { throw new Error("La réinitialisation du mot de passe sera disponible quand la base de données sera connectée."); },
  async updatePassword() { throw new Error("Indisponible en mode démonstration."); },
  async catalog() {
    const [subjects, sample] = await Promise.all([load("subjects"), sampleContent()]);
    const teachers = [...sample.teachers], courses = [...sample.courses, ...store.get("ck-courses", [])];
    const user = await this.user();
    if (user?.role === "prof") {
      teachers.push({ id: "me", self: true, name: `${user.firstName} ${user.lastName}`, subject: user.subject, levels: user.levels || [], years: user.years, bio: user.bio || "", avatar: user.avatarUrl || "" });
    }
    return { subjects, teachers, courses };
  },
  async progress() { return localProgress.all(); },
  async setDone(course, i, done) { localProgress.set(course.slug, i, done); },
  async publishCourse(user, course, lessons) {
    const c = { ...course, slug: `prof-${Date.now().toString(36)}`, subject: user.subject, teacher: "me", featured: false,
      lessons: lessons.map(l => ({ t: l.t, d: l.d, v: l.v })) };
    store.set("ck-courses", [...store.get("ck-courses", []), c]);
    return c.slug;
  },
  async setPublished(course, published) {
    store.set("ck-courses", store.get("ck-courses", []).map(c => c.slug === course.slug ? { ...c, published } : c));
  },
  async deleteCourse(course) {
    store.set("ck-courses", store.get("ck-courses", []).filter(c => c.slug !== course.slug));
  },
  async adminTeachers() { throw new Error("L'administration est disponible quand la base de données est connectée."); },
  async adminSetTeacher() {}, async adminSetCourse() {},
  // Demo: the (small) picture is kept as a data URL in this browser only.
  async uploadAvatar(user, file) {
    checkAvatarFile(file);
    const blob = await squareJpeg(file, 256);
    if (!blob) throw new Error("Impossible de lire cette photo. Essayez une autre image.");
    const url = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result); r.onerror = () => reject(new Error("Lecture de la photo impossible."));
      r.readAsDataURL(blob);
    });
    for (const key of ["ck-user", "ck-account"]) {
      const u = store.get(key, null);
      if (u) store.set(key, { ...u, avatarUrl: url });
    }
    user.avatarUrl = url;
    return url;
  }
};

// ======================================================================
// Supabase backend
// ======================================================================
let sb = null, userCache = null;

const fromProfile = (p, email) => p && ({
  id: p.id, email, role: p.role, firstName: p.first_name, lastName: p.last_name, phone: p.phone || "", school: p.school || "",
  level: p.level, series: p.series || "", subject: p.subject, levels: p.levels || [], years: p.years, bio: p.bio || "",
  status: p.role === "prof" ? p.teacher_status : "approved", isAdmin: !!p.is_admin, avatarUrl: p.avatar_url || ""
});

const videoUrl = path => sb.storage.from(VIDEO_BUCKET).getPublicUrl(path).data.publicUrl;
const fromCourse = c => ({
  slug: c.id, id: c.id, title: c.title, summary: c.summary, subject: c.subject, level: c.level, series: c.series || [],
  teacher: c.teacher_id, published: c.published, featured: c.featured, createdAt: c.created_at,
  lessons: (c.lessons || []).sort((a, b) => a.position - b.position)
    .map(l => ({ id: l.id, t: l.title, d: l.duration_min || 0, v: l.video_url || (l.video_path ? videoUrl(l.video_path) : ""), path: l.video_path }))
});

// Direct upload to Storage with XMLHttpRequest so teachers see a progress bar on slow connections.
async function uploadVideo(path, file, onProgress) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error("Session expirée : reconnectez-vous.");
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${CFG.supabaseUrl.replace(/\/$/, "")}/storage/v1/object/${VIDEO_BUCKET}/${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    xhr.setRequestHeader("apikey", CFG.supabaseAnonKey);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    xhr.upload.onprogress = e => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status < 300) return resolve();
      let msg = `${xhr.status}`;
      try { const j = JSON.parse(xhr.responseText); msg = `${j.message || j.error || msg} ${j.statusCode || xhr.status}`; } catch {}
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error("réseau"));
    xhr.send(file);
  });
}

const supa = {
  mode: "supabase",
  async init() {
    if (sb) return;
    if (!window.supabase) await loadScript(SUPABASE_LIB);
    sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
  },
  async user() {
    if (userCache) return userCache;
    userCache = (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return null;
      const { data, error } = await sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      if (error) console.error(error);
      return fromProfile(data, session.user.email);
    })();
    return userCache;
  },
  async signUp(p, password) {
    const { data, error } = await sb.auth.signUp({
      email: p.email, password,
      options: {
        emailRedirectTo: new URL("espace.html?bienvenue=1", location.href).href,
        data: { role: p.role, first_name: p.firstName, last_name: p.lastName, phone: p.phone, school: p.school,
                level: p.level, series: p.series, subject: p.subject, levels: p.levels, years: p.years, bio: p.bio }
      }
    });
    if (error) fail(error);
    // With e-mail confirmation on, Supabase returns no session (and an empty identities list if the e-mail is taken).
    if (data.user && Array.isArray(data.user.identities) && !data.user.identities.length) fail("already registered");
    userCache = null;
    return { needsConfirmation: !data.session };
  },
  async signIn(email, password) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) fail(error);
    userCache = null;
  },
  async signOut() { await sb.auth.signOut(); userCache = null; },
  async resetPassword(email) {
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: new URL("motdepasse.html?reset=1", location.href).href });
    if (error) fail(error);
  },
  async updatePassword(password) {
    const { error } = await sb.auth.updateUser({ password });
    if (error) fail(error);
  },
  async catalog() {
    const [subjectsRes, teachersRes, coursesRes, sample, user] = await Promise.all([
      sb.from("subjects").select("*").order("position"),
      sb.from("public_teachers").select("*"),
      sb.from("courses").select("id,teacher_id,subject,level,series,title,summary,published,featured,created_at,lessons(id,position,title,duration_min,video_url,video_path)")
        .order("created_at", { ascending: false }),
      sampleContent(), this.user()
    ]);
    for (const r of [subjectsRes, teachersRes, coursesRes]) if (r.error) console.error(r.error);
    const subjects = subjectsRes.data?.length ? subjectsRes.data : await load("subjects");
    const teachers = (teachersRes.data || []).map(t => ({ id: t.id, name: `${t.first_name} ${t.last_name}`, subject: t.subject, levels: t.levels || [], years: t.years, bio: t.bio || "", avatar: t.avatar_url || "" }));
    if (user?.role === "prof" && !teachers.some(t => t.id === user.id)) {
      teachers.push({ id: user.id, name: `${user.firstName} ${user.lastName}`, subject: user.subject, levels: user.levels, years: user.years, bio: user.bio, avatar: user.avatarUrl, pending: user.status !== "approved" });
    }
    teachers.forEach(t => { if (t.id === user?.id) t.self = true; });
    return { subjects, teachers: [...teachers, ...sample.teachers], courses: [...(coursesRes.data || []).map(fromCourse), ...sample.courses] };
  },
  async progress(courses) {
    const result = localProgress.all();               // sample courses keep local progress
    const user = await this.user();
    if (!user) return result;
    const { data, error } = await sb.from("progress").select("lesson_id");
    if (error) { console.error(error); return result; }
    const where = {};
    courses.forEach(c => c.lessons.forEach((l, i) => { if (l.id) where[l.id] = [c.slug, i]; }));
    for (const { lesson_id } of data) {
      const hit = where[lesson_id];
      if (hit) (result[hit[0]] ||= []).push(hit[1]);
    }
    return result;
  },
  async setDone(course, i, done) {
    const lesson = course.lessons[i];
    if (!lesson.id) return localProgress.set(course.slug, i, done);
    if (!(await this.user())) throw new Error("Connectez-vous pour enregistrer votre progression.");
    const { error } = done
      ? await sb.from("progress").upsert({ lesson_id: lesson.id }, { onConflict: "student_id,lesson_id", ignoreDuplicates: true })
      : await sb.from("progress").delete().eq("lesson_id", lesson.id);
    if (error) fail(error);
  },
  // lessons: [{ t, d, v, file }] — a file is uploaded to Storage, otherwise `v` (link) is stored.
  async publishCourse(user, course, lessons, onProgress) {
    const { data: created, error } = await sb.from("courses")
      .insert({ subject: user.subject, level: course.level, series: course.series, title: course.title, summary: course.summary, published: course.published })
      .select("id").single();
    if (error) fail(error);
    const uploaded = [];
    try {
      const totalBytes = lessons.reduce((n, l) => n + (l.file?.size || 0), 0) || 1;
      let doneBytes = 0;
      const rows = [];
      for (const [position, l] of lessons.entries()) {
        let video_path = null;
        if (l.file) {
          const ext = (l.file.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
          video_path = `${user.id}/${created.id}/${crypto.randomUUID()}.${ext}`;
          await uploadVideo(video_path, l.file, p => onProgress?.((doneBytes + p * l.file.size) / totalBytes, position));
          uploaded.push(video_path);
          doneBytes += l.file.size;
        }
        rows.push({ course_id: created.id, position, title: l.t, duration_min: l.d || null, video_url: video_path ? null : (l.v || null), video_path });
      }
      const { error: lessonsError } = await sb.from("lessons").insert(rows);
      if (lessonsError) throw lessonsError;
    } catch (err) {
      // Roll back so a half-published course never shows up.
      if (uploaded.length) await sb.storage.from(VIDEO_BUCKET).remove(uploaded);
      await sb.from("courses").delete().eq("id", created.id);
      fail(err);
    }
    return created.id;
  },
  async setPublished(course, published) {
    const { error } = await sb.from("courses").update({ published }).eq("id", course.id);
    if (error) fail(error);
  },
  async deleteCourse(course) {
    const paths = course.lessons.map(l => l.path).filter(Boolean);
    if (paths.length) {
      const { error } = await sb.storage.from(VIDEO_BUCKET).remove(paths);
      if (error) console.error(error);
    }
    const { error } = await sb.from("courses").delete().eq("id", course.id);
    if (error) fail(error);
  },
  async adminTeachers() {
    const { data, error } = await sb.rpc("admin_list_teachers");
    if (error) fail(error);
    return data;
  },
  async adminSetTeacher(id, status) {
    const { error } = await sb.rpc("admin_set_teacher_status", { teacher: id, status });
    if (error) fail(error);
  },
  async adminSetCourse(id, published, featured) {
    const { error } = await sb.rpc("admin_set_course", { course: id, is_published: published, is_featured: featured });
    if (error) fail(error);
  },
  // Uploads the picture to avatars/<uid>/profile-<time>.jpg (a new name each time, so browsers
  // never show a cached old photo), saves its public URL in profiles.avatar_url, then removes
  // the previous file.
  async uploadAvatar(user, file) {
    checkAvatarFile(file);
    const blob = await squareJpeg(file, 512);
    const ext = blob ? "jpg" : AVATAR_TYPES[file.type];
    const path = `${user.id}/profile-${Date.now()}.${ext}`;
    const bucket = sb.storage.from(AVATAR_BUCKET);
    const { error } = await bucket.upload(path, blob || file, { contentType: blob ? "image/jpeg" : file.type, cacheControl: "31536000", upsert: false });
    if (error) fail(error);
    const url = bucket.getPublicUrl(path).data.publicUrl;
    const { error: saveError } = await sb.from("profiles").update({ avatar_url: url }).eq("id", user.id);
    if (saveError) {
      await bucket.remove([path]);
      fail(saveError);
    }
    const marker = `/object/public/${AVATAR_BUCKET}/`;
    const previous = (user.avatarUrl || "").includes(marker) ? user.avatarUrl.split(marker)[1].split("?")[0] : "";
    if (previous && previous !== path && previous.startsWith(`${user.id}/`)) {
      bucket.remove([previous]).then(({ error: e }) => e && console.warn("Ancienne photo non supprimée", e));
    }
    user.avatarUrl = url;
    return url;
  }
};

const api = CFG.supabaseUrl && CFG.supabaseAnonKey ? supa : demo;
