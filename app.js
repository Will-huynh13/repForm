const STORAGE_KEY = "gains-tracker-v1";
const TOTAL_SESSIONS = 60;
const LIFT_KEYS = { SQ: "squat", BN: "bench", DL: "deadlift", OH: "overheadPress" };
const LIFT_NAMES = { squat: "Squat", bench: "Bench", deadlift: "Deadlift", overheadPress: "Overhead press" };
const WEEKLY_CALORIE_DEFICITS = [0.2, 0.24, 0.28, 0.32, 0.36, 0.4, 0.44, 0.36, 0.48, 0.52, 0.56, 0.6];
const EXERCISE_VIDEOS = {
  "Squat": "gcNh17Ckjgg",
  "Stiff Legged Deadlifts": "CN_7cz3P-1U",
  "ATG Front Squats": "QDMsrZ111GY",
  "Bulgarian Split Squats": "vgn7bSXkgkA",
  "Glute Ham Raise (or Leg Curl)": "c2pWqsHR7FU",
  "Pallof Press": "HXrLaqNIkTs",
  "Bench": "SCVCLChPQFY",
  "Seated Row": "xQNrFHEMhI4",
  "Low Incline Bench Press": "U_N0Pjohh9I",
  "One Arm DB Row": "dFzUjzfih7k",
  "Dips": "2z8JmcrW-As",
  "Incline DB Curl": "XVQBeug_9LU",
  "DB Skull Crusher": "1BDGIcMTSXc",
  "Low Intensity Steady State Cardio": "-gNjjynjx7g",
  "Deadlifts": "r4MzxtBKyNE",
  "Pause Squats": "zkdRBl385sE",
  "Glute Hip Thrusts": "pF17m_CXfL0",
  "Goblet Squat": "CkFzgR55gho",
  "Weighted Cable Crunch": "ToJeyhydUxU",
  "Overhead Press": "cGnhixvC8uA",
  "Weighted Pull Ups": "7FjX1RODKzQ",
  "Close Grip Bench Press": "UYJsFzqdgK4",
  "One Arm Cable Pulldown": "HBC5s98wXko",
  "Incline DB Press": "OC7Qs_SAO2E",
  "Hammer Curl": "BRVDS6HVR9Q",
  "Overhead Triceps Extension": "nRiJVZDpdL0",
  "High Bar Squats": "i7J5h7BJ07g",
  "Incline Bench Press": "SrqOu55lrYU",
  "Pull Ups": "eGo4IYlbE5g",
  "Pushups": "WDIpL0pjun0",
  "Lateral Raises": "XPPfnSEATJA",
  "High Intensity Interval Training": "6NtCDYHp8eQ"
};
const appMain = document.querySelector("#app-main");
const warning = document.querySelector("#storage-warning");
const toastElement = document.querySelector("#toast");
let program;
let persistenceAvailable = true;
let toastTimeout;

function todayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function blankState() {
  return {
    version: 1,
    startedOn: null,
    nextSession: 0,
    nextDate: null,
    unit: "lb",
    maxes: { squat: "", bench: "", deadlift: "", overheadPress: "" },
    nutritionProfile: { sex: "", weightLb: "", heightIn: "", age: "" },
    logs: {}
  };
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return blankState();
    const value = JSON.parse(saved);
    if (value?.version !== 1 || typeof value.logs !== "object" || !value.logs) {
      throw new Error("The saved workout data isn't in a format this version can read.");
    }
    return {
      ...blankState(),
      ...value,
      maxes: { ...blankState().maxes, ...(value.maxes || {}) },
      nutritionProfile: { ...blankState().nutritionProfile, ...(value.nutritionProfile || {}) },
      logs: value.logs
    };
  } catch (error) {
    persistenceAvailable = false;
    showWarning(`Saved data could not be loaded: ${error.message} Your current session can still run, but changes won't be saved. Export/import a backup if you have one.`);
    return blankState();
  }
}

let state = loadState();
let activePage = "home";
let selectedSessionIndex = null;

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    persistenceAvailable = true;
    warning.hidden = true;
  } catch (error) {
    persistenceAvailable = false;
    showWarning(`Your changes could not be saved on this device: ${error.message}. Free up browser storage or export a backup.`);
  }
}

function showWarning(message) {
  warning.textContent = message;
  warning.hidden = false;
}

function showToast(message) {
  toastElement.textContent = message;
  toastElement.classList.add("is-visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toastElement.classList.remove("is-visible"), 2600);
}

function formatDate(dateString, options = { weekday: "long", month: "long", day: "numeric" }) {
  if (!dateString) return "";
  const date = new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

function addDays(dateString, amount) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function nextTrainingDate(dateString) {
  let result = addDays(dateString, 1);
  while ([0, 6].includes(new Date(`${result}T12:00:00`).getDay())) result = addDays(result, 1);
  return result;
}

function sessionForIndex(index) {
  if (index < 0 || index >= TOTAL_SESSIONS) return null;
  const weekIndex = Math.floor(index / 5);
  const dayIndex = index % 5;
  return {
    week: weekIndex + 1,
    day: dayIndex + 1,
    session: program.weeks[weekIndex].sessions[dayIndex],
    key: `w${weekIndex + 1}-d${dayIndex + 1}`,
    index
  };
}

function sessionIndex(week, day) {
  return (week - 1) * 5 + day - 1;
}

function isStarted() {
  return Boolean(state.startedOn);
}

function activeSession() {
  return sessionForIndex(state.nextSession);
}

function isSessionDue() {
  return isStarted() && state.nextSession < TOTAL_SESSIONS && (state.nextDate || state.startedOn) <= todayString();
}

function stepsTargetForWeek(week) {
  return [7000, 8000, 9000, 10000][Math.min(week - 1, 3)] || 7000;
}

function nutritionTargets(week, day, restDay = false) {
  const { sex, weightLb, heightIn, age } = state.nutritionProfile;
  const weight = Number(weightLb);
  const height = Number(heightIn);
  const years = Number(age);
  if (!["Male", "Female"].includes(sex) || !Number.isFinite(weight) || weight <= 0 ||
      !Number.isFinite(height) || height <= 0 || !Number.isInteger(years) || years <= 0) return null;

  const bmr = Math.round(10 * (weight / 2.204) + 6.25 * (2.54 * height) - 4.92 * years + (sex === "Male" ? 5 : -161));
  const deficit = WEEKLY_CALORIE_DEFICITS[Math.max(0, Math.min(week - 1, WEEKLY_CALORIE_DEFICITS.length - 1))];
  const calories = Math.round((bmr * 1.6) - (bmr * deficit));
  const protein = Math.round(weight);
  const fatRatio = restDay ? 0.5 : (day === 1 || day === 3
    ? (week >= 7 ? 0.33 : 0.35)
    : (week >= 11 ? 0.36 : (week >= 8 ? 0.4 : 0.45)));
  const fat = Math.round(weight * fatRatio);
  const carbs = Math.round((calories - (protein * 4 + fat * 9)) / 4);
  return { protein, carbs, fat };
}

function sessionLog(key) {
  return state.logs[key] || { sets: {}, note: "" };
}

function completedCount() {
  return Object.values(state.logs).filter((log) => log.completedAt).length;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function suggestedLoad(exercise) {
  const maxKey = LIFT_KEYS[exercise.lift];
  const max = maxKey ? Number(state.maxes[maxKey]) : NaN;
  if (!exercise.percent || !Number.isFinite(max) || max <= 0) return "";
  const increment = state.unit === "kg" ? 2.5 : 5;
  return String(Math.round((max * exercise.percent / increment) + Number.EPSILON) * increment);
}

function formatIntensity(exercise) {
  if (exercise.percent) return `${Math.round(exercise.percent * 100)}% 1RM`;
  if (exercise.intensity.startsWith("@")) return `RPE ${exercise.intensity.replace(/^@\s*/, "").replace(/\s*-\s*/g, "–")}`;
  if (exercise.intensity === "-") return "";
  return exercise.intensity;
}

function formatPrescription(exercise) {
  const unit = exercise.sets === 1 ? "set" : "sets";
  const prescription = `${exercise.sets} ${unit} × ${exercise.reps}`;
  const intensity = formatIntensity(exercise);
  return intensity ? `${prescription} · ${intensity}` : prescription;
}

function getWorkoutProgress(ref) {
  const log = sessionLog(ref.key);
  let done = 0;
  let total = 0;
  ref.session.exercises.forEach((exercise, exerciseIndex) => {
    for (let setIndex = 0; setIndex < exercise.sets; setIndex += 1) {
      total += 1;
      if (log.sets?.[exerciseIndex]?.[setIndex]?.done) done += 1;
    }
  });
  return { done, total };
}

function renderTabs() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    const active = button.dataset.nav === activePage;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
}

function render() {
  renderTabs();
  if (!program) {
    appMain.innerHTML = '<div class="empty-state"><h2>Workout plan unavailable</h2><p>The program data could not be loaded. Refresh the page to try again.</p></div>';
    return;
  }
  if (!isStarted()) {
    renderOnboarding();
    return;
  }
  if (activePage === "workout") renderWorkoutPage();
  else if (activePage === "progress") renderProgressPage();
  else if (activePage === "settings") renderSettingsPage();
  else renderHomePage();
}

function renderOnboarding() {
  appMain.innerHTML = `
    <section class="onboarding">
      <img class="onboarding-mark" src="repform-logo.png" alt="RepForm logo">
      <p class="eyebrow">12 weeks. Your pace.</p>
      <h1>Put in the work.<br>Track the wins.</h1>
      <p>Your 12-week strength plan, right in your pocket. Log sets as you go, keep your progress private, and pick up right where you left off.</p>
      <ul class="onboarding-points">
        <li><span class="checkmark">✓</span><span>All 60 workouts from your training plan</span></li>
        <li><span class="checkmark">✓</span><span>Your workout logs stay on this device</span></li>
        <li><span class="checkmark">✓</span><span>Works offline after the first visit</span></li>
      </ul>
      <button class="button" type="button" data-action="start">Start my 12 weeks <span class="button-arrow">→</span></button>
      <p class="privacy-note">No account. No cloud. Your data stays yours.</p>
    </section>`;
}

function renderHomePage() {
  const done = completedCount();
  const current = activeSession();
  const due = isSessionDue();
  const percent = Math.round((done / TOTAL_SESSIONS) * 100);
  const today = formatDate(todayString());

  if (!current) {
    appMain.innerHTML = `
      <section class="hero-intro">
        <p class="eyebrow">${escapeHtml(today)}</p>
        <h1>Program complete.</h1>
        <p class="muted">Twelve weeks of work. That's something to be proud of.</p>
      </section>
      <div class="program-card">
        <div class="program-card-top"><span class="program-tag">12 week program</span><span class="date-tag">Finished ${escapeHtml(formatDate(state.logs["w12-d5"]?.completedAt?.slice(0, 10), { month: "short", day: "numeric" }))}</span></div>
        <h2>60 workouts done.</h2><p class="program-subtitle">You've completed the full training plan.</p>
        <div class="card-divider"></div><div class="program-stats"><div><span class="stat-value">100%</span><span class="stat-label">Program complete</span></div><div><span class="stat-value">12 weeks</span><span class="stat-label">Of showing up</span></div></div>
        <div class="progress-track"><div class="progress-fill" style="width:100%"></div></div>
      </div>
      <div class="hero-cta"><button class="button secondary" type="button" data-nav="progress">See your progress</button></div>`;
    return;
  }

  const dateLabel = due ? today : formatDate(state.nextDate, { weekday: "short", month: "short", day: "numeric" });
  const completedToday = Object.entries(state.logs)
    .filter(([, log]) => log.completedAt?.slice(0, 10) === todayString())
    .map(([key]) => {
      const match = key.match(/^w(\d+)-d(\d+)$/);
      return match ? { week: Number(match[1]), day: Number(match[2]), completedAt: state.logs[key].completedAt } : null;
    })
    .filter(Boolean)
    .sort((first, second) => first.completedAt.localeCompare(second.completedAt))
    .at(-1);
  const todayWorkout = due ? current : completedToday;
  const rest = !due;
  const macroWeek = todayWorkout?.week || current.week;
  const macroDay = todayWorkout?.day || null;
  const macroTargets = nutritionTargets(macroWeek, macroDay, !todayWorkout);
  const macroCard = `
    <section class="macro-card" aria-labelledby="macro-title">
      <div class="macro-card-top"><div><p class="eyebrow">Daily nutrition</p><h2 id="macro-title">Macro reminder</h2></div><span class="macro-day-label">${todayWorkout ? `Week ${macroWeek} · Day ${macroDay}` : "Recovery day"}</span></div>
      ${macroTargets
        ? `<div class="macro-values"><div><span>Protein</span><strong>${macroTargets.protein}<small>g</small></strong></div><div><span>Carbs</span><strong>${macroTargets.carbs}<small>g</small></strong></div><div><span>Fat</span><strong>${macroTargets.fat}<small>g</small></strong></div></div>`
        : `<p class="macro-setup-hint">Add your sex, weight, height, and age in Settings to see targets from the program.</p>`}
    </section>`;
  appMain.innerHTML = `
    <section class="hero-intro">
      <p class="eyebrow">${escapeHtml(today)}</p>
      <h1>${rest ? "Take your time." : "Ready when you are."}</h1>
      <p class="muted">${rest ? "Recovery is part of the program." : "One session at a time. Keep the streak alive."}</p>
    </section>
    <section class="program-card" aria-label="Next workout">
      <div class="program-card-top">
        <span class="program-tag">Week ${current.week} · Workout ${current.day}</span>
        <span class="date-tag">${rest ? `UP NEXT · ${escapeHtml(dateLabel)}` : "TODAY"}</span>
      </div>
      <h2>${escapeHtml(current.session.title)}</h2>
      <p class="program-subtitle">${escapeHtml(current.session.category)} · ${current.session.exercises.length} movements</p>
      <div class="card-divider"></div>
      <div class="program-stats">
        <div><span class="stat-value">${done}<span class="muted"> / 60</span></span><span class="stat-label">Workouts complete</span></div>
        <div><span class="stat-value">${percent}%</span><span class="stat-label">Program progress</span></div>
        <div><span class="stat-value">${12 - Math.floor(done / 5)}<span class="muted"> left</span></span><span class="stat-label">Weeks to go</span></div>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
    </section>
    ${macroCard}
    ${rest ? `
      <div class="rest-card">
        <div class="rest-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3v2m0 14v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M3 12h2m14 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/><circle cx="12" cy="12" r="4"/></svg></div>
        <div><h3>Recovery day</h3><p>Your next workout is queued up. Rest, hydrate, and come back ready.</p><span class="rest-date">Next up · ${escapeHtml(dateLabel)}</span></div>
      </div>
      <div class="hero-cta"><button class="button secondary" type="button" data-action="view-next">Preview next workout <span class="button-arrow">→</span></button></div>
    ` : `
      <div class="hero-cta"><button class="button" type="button" data-action="open-active">Start today's workout <span class="button-arrow">→</span></button></div>
    `}
    <div class="section-heading"><h2>Program week</h2><span class="muted small">Week ${current.week} of 12</span></div>
    <div class="day-strip">${renderHomeDays(current.week, current.day, due)}</div>`;
}

function renderHomeDays(week, currentDay, due) {
  return Array.from({ length: 5 }, (_, index) => {
    const day = index + 1;
    const ref = sessionForIndex(sessionIndex(week, day));
    const isDone = Boolean(state.logs[ref.key]?.completedAt);
    const isCurrent = ref.index === state.nextSession;
    return `<button type="button" class="day-pill${isCurrent && due ? " is-selected" : ""}" data-action="select-workout" data-week="${week}" data-day="${day}" aria-label="Week ${week}, workout ${day}, ${escapeHtml(ref.session.title)}">
      <span>DAY ${day}</span><span>${isDone ? "DONE" : escapeHtml(ref.session.category.split(" ")[0].toUpperCase())}</span></button>`;
  }).join("");
}

function renderWorkoutPage() {
  const active = activeSession();
  if (state.nextSession >= TOTAL_SESSIONS) {
    renderHomePage();
    return;
  }
  if (selectedSessionIndex === null || selectedSessionIndex >= TOTAL_SESSIONS) selectedSessionIndex = active.index;
  const ref = sessionForIndex(selectedSessionIndex);
  const log = sessionLog(ref.key);
  const completed = Boolean(log.completedAt);
  const activeWorkout = ref.index === state.nextSession;
  const due = activeWorkout && isSessionDue();
  const canEdit = activeWorkout && due && !completed;
  const progress = getWorkoutProgress(ref);
  const status = completed ? `Completed ${formatDate(log.completedAt.slice(0, 10), { month: "short", day: "numeric" })}` : (canEdit ? "Your workout for today" : (activeWorkout ? `Scheduled for ${formatDate(state.nextDate)}` : "Workout preview"));
  const targetMacros = nutritionTargets(ref.week, ref.day);
  const dailyTargets = `
    <section class="training-targets" aria-label="Daily targets">
      <div class="training-targets-top"><div><p class="eyebrow">Daily targets</p><h2>Week ${ref.week} · Workout ${ref.day}</h2></div><span class="steps-target">${stepsTargetForWeek(ref.week).toLocaleString()} steps</span></div>
      ${targetMacros
        ? `<div class="macro-values"><div><span>Protein</span><strong>${targetMacros.protein}<small>g</small></strong></div><div><span>Carbs</span><strong>${targetMacros.carbs}<small>g</small></strong></div><div><span>Fat</span><strong>${targetMacros.fat}<small>g</small></strong></div></div>`
        : `<p class="macro-setup-hint">Add your sex, weight, height, and age in Settings to see macro targets.</p>`}
    </section>`;

  appMain.innerHTML = `
    <div class="section-heading" style="margin-top:13px"><h2>Training plan</h2><span class="muted small">12 weeks · 5 days</span></div>
    <div class="week-strip" aria-label="Choose program week">${program.weeks.map((week) => `<button class="week-pill${week.week === ref.week ? " is-selected" : ""}" type="button" data-action="select-week" data-week="${week.week}">Week ${week.week}</button>`).join("")}</div>
    <div class="day-strip" aria-label="Choose workout day">${Array.from({ length: 5 }, (_, index) => {
      const day = index + 1;
      const item = sessionForIndex(sessionIndex(ref.week, day));
      const done = Boolean(state.logs[item.key]?.completedAt);
      return `<button class="day-pill${day === ref.day ? " is-selected" : ""}" type="button" data-action="select-workout" data-week="${ref.week}" data-day="${day}"><span>DAY ${day}</span><span>${done ? "✓ DONE" : escapeHtml(item.session.category.split(" ")[0].toUpperCase())}</span></button>`;
    }).join("")}</div>
    <header class="workout-header">
      <p class="eyebrow">Week ${ref.week} · Workout ${ref.day}</p>
      <h1>${escapeHtml(ref.session.title)}</h1>
      <p class="muted">${escapeHtml(status)} · ${ref.session.exercises.length} movements</p>
      ${dailyTargets}
      ${canEdit ? `<div class="workout-completion"><div class="completion-row"><span>Set progress</span><strong id="set-progress">${progress.done} / ${progress.total} sets</strong></div><div class="progress-track"><div id="set-progress-bar" class="progress-fill" style="width:${progress.total ? progress.done / progress.total * 100 : 0}%"></div></div></div>` : ""}
    </header>
    ${activeWorkout && !due && !completed ? `<div class="locked-banner">This workout opens ${escapeHtml(formatDate(state.nextDate))}. Preview the plan now; your next session is ready when the day arrives.</div>` : ""}
    ${completed ? `<div class="locked-banner">Workout saved on this device. Your next session is queued for ${escapeHtml(formatDate(state.nextDate))}.</div>` : ""}
    <div class="exercise-list">${ref.session.exercises.map((exercise, exerciseIndex) => renderExercise(ref, exercise, exerciseIndex, canEdit)).join("")}</div>
    ${canEdit ? `
      <label class="workout-note-field"><span>Workout notes</span><textarea data-role="workout-note" data-session-key="${ref.key}" placeholder="How did the session feel?">${escapeHtml(log.note || "")}</textarea></label>
      <div class="finish-wrap"><button class="button" type="button" data-action="finish">Finish workout <span class="button-arrow">✓</span></button></div>
    ` : ""}
    ${!canEdit && !completed ? `<div class="finish-wrap"><button class="button ghost" type="button" data-nav="home">Back to today</button></div>` : ""}
    ${completed ? `<div class="finish-wrap"><button class="button secondary" type="button" data-nav="progress">View progress</button></div>` : ""}`;
}

function renderExercise(ref, exercise, exerciseIndex, canEdit) {
  const log = sessionLog(ref.key);
  const exerciseLog = log.sets?.[exerciseIndex] || {};
  let completedSets = 0;
  for (let index = 0; index < exercise.sets; index += 1) if (exerciseLog[index]?.done) completedSets += 1;
  const target = suggestedLoad(exercise);
  const targetText = exercise.percent
    ? (target ? `${target} ${state.unit}` : `${Math.round(exercise.percent * 100)}%`)
    : (exercise.intensity.startsWith("@") ? formatIntensity(exercise) : "");
  const repsLabel = exercise.type === "cardio" ? "Duration" : "Reps";
  const groupMarkup = exercise.group ? `<div class="group-label">${escapeHtml(exercise.group)}</div>` : "";
  const noteMarkup = exercise.notes ? `<p class="exercise-note">${escapeHtml(exercise.notes)}</p>` : "";
  const videoId = EXERCISE_VIDEOS[exercise.name];
  const videoMarkup = videoId ? `<details class="exercise-video" data-video-id="${videoId}" data-exercise-name="${escapeHtml(exercise.name)}">
    <summary>How to perform</summary>
    <div class="exercise-video-player"></div>
  </details>` : "";
  const setRows = Array.from({ length: exercise.sets }, (_, setIndex) => {
    const set = exerciseLog[setIndex] || {};
    if (exercise.type === "cardio") {
      return `<div class="set-row">
      <span class="set-number">${String(setIndex + 1).padStart(2, "0")}</span>
      <input class="set-input" type="text" inputmode="decimal" autocomplete="off" aria-label="${escapeHtml(exercise.name)} set ${setIndex + 1} duration" placeholder="${escapeHtml(exercise.reps)}" value="${escapeHtml(set.reps || "")}" data-role="set-value" data-session-key="${ref.key}" data-exercise="${exerciseIndex}" data-set="${setIndex}" data-field="reps" ${canEdit ? "" : "disabled"}>
      <input class="set-check" type="checkbox" aria-label="Mark ${escapeHtml(exercise.name)} set ${setIndex + 1} complete" ${set.done ? "checked" : ""} ${canEdit ? "" : "disabled"} data-role="set-done" data-session-key="${ref.key}" data-exercise="${exerciseIndex}" data-set="${setIndex}">
    </div>`;
    }
    return `<div class="set-row">
      <span class="set-number">${String(setIndex + 1).padStart(2, "0")}</span>
      <input class="set-input" type="text" inputmode="decimal" autocomplete="off" aria-label="${escapeHtml(exercise.name)} set ${setIndex + 1} ${state.unit}" placeholder="${escapeHtml(target || "—")}" value="${escapeHtml(set.weight || "")}" data-role="set-value" data-session-key="${ref.key}" data-exercise="${exerciseIndex}" data-set="${setIndex}" data-field="weight" ${canEdit ? "" : "disabled"}>
      <input class="set-input" type="text" inputmode="decimal" autocomplete="off" aria-label="${escapeHtml(exercise.name)} set ${setIndex + 1} ${repsLabel.toLowerCase()}" placeholder="${escapeHtml(exercise.reps)}" value="${escapeHtml(set.reps || "")}" data-role="set-value" data-session-key="${ref.key}" data-exercise="${exerciseIndex}" data-set="${setIndex}" data-field="reps" ${canEdit ? "" : "disabled"}>
      <input class="set-check" type="checkbox" aria-label="Mark ${escapeHtml(exercise.name)} set ${setIndex + 1} complete" ${set.done ? "checked" : ""} ${canEdit ? "" : "disabled"} data-role="set-done" data-session-key="${ref.key}" data-exercise="${exerciseIndex}" data-set="${setIndex}">
    </div>`;
  }).join("");
  return `<article class="exercise-card${completedSets === exercise.sets ? " is-done" : ""}">
    <div class="exercise-top">
      <span class="exercise-number">${String(exerciseIndex + 1).padStart(2, "0")}</span>
      <div class="exercise-title-wrap">
        <h3 class="exercise-title">${escapeHtml(exercise.name)}</h3>
        <div class="exercise-prescription">${escapeHtml(formatPrescription(exercise))}</div>
      </div>
      ${targetText ? `<span class="exercise-target">${escapeHtml(targetText)}</span>` : ""}
    </div>
    ${groupMarkup}${noteMarkup}
    ${videoMarkup}
    <div class="set-table${exercise.type === "cardio" ? " is-cardio" : ""}">
      <div class="set-table-head"><span>SET</span>${exercise.type === "cardio" ? "" : `<span>${escapeHtml(state.unit.toUpperCase())}</span>`}<span>${escapeHtml(repsLabel)}</span><span class="sr-only">Done</span></div>
      ${setRows}
    </div>
  </article>`;
}

function renderProgressPage() {
  const done = completedCount();
  const last = Object.values(state.logs).filter((log) => log.completedAt).map((log) => log.completedAt).sort().at(-1);
  const weekBars = program.weeks.map((week) => {
    const completed = week.sessions.filter((session) => state.logs[`w${week.week}-d${session.day}`]?.completedAt).length;
    const current = state.nextSession < TOTAL_SESSIONS && Math.floor(state.nextSession / 5) + 1 === week.week;
    return `<div class="week-progress">
      <div class="week-progress-top"><span>Week ${week.week}${current ? " · IN PROGRESS" : ""}</span><span>${completed} / 5 sessions</span></div>
      <div class="week-dots">${week.sessions.map((session) => {
        const complete = Boolean(state.logs[`w${week.week}-d${session.day}`]?.completedAt);
        const isCurrent = current && sessionIndex(week.week, session.day) === state.nextSession;
        return `<span class="week-dot${complete ? " is-done" : ""}${isCurrent ? " is-current" : ""}" aria-label="Day ${session.day}${complete ? " complete" : ""}"></span>`;
      }).join("")}</div>
    </div>`;
  }).join("");
  appMain.innerHTML = `
    <section class="hero-intro"><p class="eyebrow">Your work adds up</p><h1>Progress.</h1><p class="muted">Every session counts. Keep showing up.</p></section>
    <div class="metric-grid">
      <div class="metric-card"><span>Workouts done</span><strong>${done}<span class="muted"> / 60</span></strong><span>${Math.round(done / TOTAL_SESSIONS * 100)}% of the plan</span></div>
      <div class="metric-card"><span>Current week</span><strong>${state.nextSession >= TOTAL_SESSIONS ? "12" : Math.min(12, Math.floor(state.nextSession / 5) + 1)}<span class="muted"> / 12</span></strong><span>${state.nextSession >= TOTAL_SESSIONS ? "Program complete" : "Keep building"}</span></div>
      <div class="metric-card"><span>Sets checked off</span><strong>${Object.values(state.logs).reduce((sum, log) => sum + Object.values(log.sets || {}).reduce((exerciseTotal, sets) => exerciseTotal + Object.values(sets).filter((set) => set.done).length, 0), 0)}</strong><span>Logged across all sessions</span></div>
      <div class="metric-card"><span>Last workout</span><strong style="font-size:20px">${last ? escapeHtml(formatDate(last.slice(0, 10), { month: "short", day: "numeric" })) : "—"}</strong><span>${last ? "Nice work showing up" : "Your first one is waiting"}</span></div>
    </div>
    <div class="section-heading"><h2>12-week overview</h2><span class="muted small">60 sessions</span></div>
    <div class="week-progress-list">${weekBars}</div>
    <p class="backup-hint">Progress is stored only in this browser on this device. Export a backup in Settings if you want to keep a copy or move to another device.</p>`;
}

function renderSettingsPage() {
  const profileWeight = state.nutritionProfile.weightLb
    ? Number(state.nutritionProfile.weightLb) / (state.unit === "kg" ? 2.204 : 1)
    : "";
  const profileHeight = state.nutritionProfile.heightIn
    ? Number(state.nutritionProfile.heightIn) * (state.unit === "kg" ? 2.54 : 1)
    : "";
  appMain.innerHTML = `
    <section class="hero-intro"><p class="eyebrow">Your app, your settings</p><h1>Settings.</h1><p class="muted">Tune your training and protect your data.</p></section>
    <section class="settings-section">
      <h2>Nutrition profile</h2>
      <div class="settings-card">
        <label class="setting-row">
          <span class="setting-copy"><strong>Calculator sex</strong><span>Used by the workbook's BMR formula</span></span>
          <select class="setting-input profile-select" data-role="nutrition-profile" data-field="sex" aria-label="Calculator sex">
            <option value=""${state.nutritionProfile.sex ? "" : " selected"}>Select</option>
            <option value="Male"${state.nutritionProfile.sex === "Male" ? " selected" : ""}>Male</option>
            <option value="Female"${state.nutritionProfile.sex === "Female" ? " selected" : ""}>Female</option>
          </select>
        </label>
        <label class="setting-row">
          <span class="setting-copy"><strong>Body weight (${state.unit})</strong><span>Used to calculate daily macro targets</span></span>
          <input class="setting-input" type="number" inputmode="decimal" min="0" step="any" placeholder="Required" value="${escapeHtml(profileWeight)}" data-role="nutrition-profile" data-field="weightLb" aria-label="Body weight (${state.unit})">
        </label>
        <label class="setting-row">
          <span class="setting-copy"><strong>Height (${state.unit === "kg" ? "cm" : "in"})</strong><span>Used to calculate your BMR</span></span>
          <input class="setting-input" type="number" inputmode="decimal" min="0" step="any" placeholder="Required" value="${escapeHtml(profileHeight)}" data-role="nutrition-profile" data-field="heightIn" aria-label="Height (${state.unit === "kg" ? "cm" : "in"})">
        </label>
        <label class="setting-row">
          <span class="setting-copy"><strong>Age</strong><span>Used to calculate your BMR</span></span>
          <input class="setting-input" type="number" inputmode="numeric" min="1" step="1" placeholder="Required" value="${escapeHtml(state.nutritionProfile.age)}" data-role="nutrition-profile" data-field="age" aria-label="Age">
        </label>
      </div>
      <p class="backup-hint">Targets follow the workbook's weekly calorie schedule and are calculated from this profile. Profile data is stored locally on this device.</p>
    </section>
    <section class="settings-section">
      <h2>Training maxes</h2>
      <div class="settings-card">
        ${Object.entries(LIFT_NAMES).map(([key, label]) => `<label class="setting-row">
          <span class="setting-copy"><strong>${label}</strong><span>Used to calculate the plan's suggested working weight</span></span>
          <input class="setting-input" type="number" inputmode="decimal" min="0" step="${state.unit === "kg" ? "2.5" : "5"}" placeholder="Optional" value="${escapeHtml(state.maxes[key])}" data-role="max" data-key="${key}" aria-label="${label} max (${state.unit})">
        </label>`).join("")}
        <div class="setting-row"><span class="setting-copy"><strong>Weight unit</strong><span>Changing units doesn't convert existing entries</span></span>
          <div class="unit-toggle" role="group" aria-label="Weight unit">
            <button type="button" class="unit-option${state.unit === "lb" ? " is-active" : ""}" data-action="unit" data-unit="lb" aria-pressed="${state.unit === "lb"}">LB</button>
            <button type="button" class="unit-option${state.unit === "kg" ? " is-active" : ""}" data-action="unit" data-unit="kg" aria-pressed="${state.unit === "kg"}">KG</button>
          </div>
        </div>
      </div>
    </section>
    <section class="settings-section">
      <h2>Backup & restore</h2>
      <div class="backup-actions">
        <button type="button" class="button secondary" data-action="export">Export backup file</button>
        <button type="button" class="button secondary" data-action="import">Import backup file</button>
        <input id="backup-file" class="file-input" type="file" accept="application/json,.json">
      </div>
      <p class="backup-hint">Your workouts live in this browser's local storage. If you clear Safari website data, logs may be lost. There is no automatic sync between devices—export a backup to move your data.</p>
    </section>
    <section class="settings-section">
      <h2>Program</h2>
      <div class="settings-card">
        <div class="setting-row"><span class="setting-copy"><strong>Started</strong><span>Your 12-week training plan began</span></span><span class="muted small">${escapeHtml(formatDate(state.startedOn, { month: "short", day: "numeric", year: "numeric" }))}</span></div>
        <div class="setting-row"><span class="setting-copy"><strong>Data storage</strong><span>Saved locally on this device. No account required.</span></span><span class="program-tag">${persistenceAvailable ? "LOCAL" : "UNSAVED"}</span></div>
      </div>
    </section>
    <section class="settings-section">
      <button type="button" class="danger-button" data-action="reset">Reset program & clear local data</button>
    </section>`;
}

function ensureSetLog(log, exercise, set) {
  if (!log.sets[exercise]) log.sets[exercise] = {};
  if (!log.sets[exercise][set]) log.sets[exercise][set] = { done: false, weight: "", reps: "" };
  return log.sets[exercise][set];
}

function updateWorkoutProgress(ref) {
  const result = getWorkoutProgress(ref);
  const count = document.querySelector("#set-progress");
  const bar = document.querySelector("#set-progress-bar");
  if (count) count.textContent = `${result.done} / ${result.total} sets`;
  if (bar) bar.style.width = `${result.total ? result.done / result.total * 100 : 0}%`;
}

function startProgram() {
  state.startedOn = todayString();
  state.nextDate = state.startedOn;
  state.nextSession = 0;
  activePage = "home";
  saveState();
  render();
}

function completeWorkout() {
  const ref = activeSession();
  if (!ref || !isSessionDue()) return;
  const progress = getWorkoutProgress(ref);
  const overlay = document.createElement("div");
  overlay.className = "finish-overlay";
  overlay.innerHTML = `
    <section class="finish-dialog" role="dialog" aria-modal="true" aria-labelledby="finish-title">
      <p class="eyebrow">Week ${ref.week} · Workout ${ref.day}</p>
      <h2 id="finish-title">Finish this workout?</h2>
      <p>${progress.done} of ${progress.total} sets checked off. Saving this session moves you to the next workout for the next training day.</p>
      <div class="finish-dialog-actions">
        <button type="button" class="button" data-finish-confirm>Save workout</button>
        <button type="button" class="button secondary" data-finish-cancel>Keep logging</button>
      </div>
    </section>`;
  document.body.append(overlay);
  overlay.querySelector("[data-finish-cancel]").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) overlay.remove();
  });
  overlay.querySelector("[data-finish-confirm]").addEventListener("click", () => {
    const log = sessionLog(ref.key);
    log.completedAt = new Date().toISOString();
    state.logs[ref.key] = log;
    state.nextSession += 1;
    state.nextDate = state.nextSession < TOTAL_SESSIONS ? nextTrainingDate(todayString()) : null;
    selectedSessionIndex = null;
    activePage = "home";
    saveState();
    overlay.remove();
    render();
    showToast("Workout saved. Nice work.");
  });
}

function exportBackup() {
  const backup = { app: "RepForm Workout Tracker", version: 1, exportedAt: new Date().toISOString(), data: state };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `repform-backup-${todayString()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Backup exported.");
}

function importBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onerror = () => showToast("The backup file could not be read.");
  reader.onload = () => {
    try {
      const backup = JSON.parse(String(reader.result));
      const imported = backup?.data;
      if (backup?.version !== 1 || imported?.version !== 1 || typeof imported.logs !== "object" || !imported.logs) {
        throw new Error("This file isn't a RepForm backup.");
      }
      if (!window.confirm("Import this backup and replace the workout data currently saved on this device?")) return;
      state = {
        ...blankState(),
        ...imported,
        maxes: { ...blankState().maxes, ...(imported.maxes || {}) },
        nutritionProfile: { ...blankState().nutritionProfile, ...(imported.nutritionProfile || {}) },
        logs: imported.logs
      };
      saveState();
      selectedSessionIndex = null;
      activePage = "home";
      render();
      showToast("Backup restored.");
    } catch (error) {
      showToast(error.message || "This backup couldn't be imported.");
    }
  };
  reader.readAsText(file);
}

function handleClick(event) {
  const navButton = event.target.closest("[data-nav]");
  if (navButton) {
    activePage = navButton.dataset.nav;
    if (activePage === "workout" && selectedSessionIndex === null && activeSession()) selectedSessionIndex = activeSession().index;
    render();
    return;
  }
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "start") startProgram();
  else if (action === "open-active") {
    selectedSessionIndex = activeSession()?.index ?? null;
    activePage = "workout";
    render();
  } else if (action === "view-next") {
    selectedSessionIndex = activeSession()?.index ?? null;
    activePage = "workout";
    render();
  } else if (action === "select-workout") {
    selectedSessionIndex = sessionIndex(Number(button.dataset.week), Number(button.dataset.day));
    activePage = "workout";
    render();
  } else if (action === "select-week") {
    const week = Number(button.dataset.week);
    const desiredDay = selectedSessionIndex === null ? 1 : (sessionForIndex(selectedSessionIndex)?.day || 1);
    selectedSessionIndex = sessionIndex(week, desiredDay);
    render();
  } else if (action === "finish") completeWorkout();
  else if (action === "unit") {
    state.unit = button.dataset.unit;
    saveState();
    render();
  } else if (action === "export") exportBackup();
  else if (action === "import") document.querySelector("#backup-file")?.click();
  else if (action === "reset") {
    if (!window.confirm("This permanently clears this program, workout logs, maxes, and notes from this device. Export a backup first if you want to keep them. Continue?")) return;
    state = blankState();
    selectedSessionIndex = null;
    activePage = "home";
    saveState();
    render();
    showToast("Local program data cleared.");
  }
}

function handleChange(event) {
  const target = event.target;
  if (target.matches('[data-role="max"]')) {
    const value = target.value.trim();
    if (value && (!Number.isFinite(Number(value)) || Number(value) <= 0)) {
      showToast("Enter a number greater than zero.");
      target.value = state.maxes[target.dataset.key];
      return;
    }
    state.maxes[target.dataset.key] = value;
    saveState();
    if (activePage === "workout") render();
    return;
  }
  if (target.matches('[data-role="nutrition-profile"]')) {
    const field = target.dataset.field;
    const value = target.value.trim();
    if (field === "sex") {
      state.nutritionProfile.sex = value;
    } else if (value) {
      const number = Number(value);
      if (target.validity.badInput || !Number.isFinite(number) || number <= 0 || (field === "age" && !Number.isInteger(number))) {
        showToast(field === "age" ? "Enter a whole-number age greater than zero." : "Enter a number greater than zero.");
        render();
        return;
      }
      if (field === "weightLb") state.nutritionProfile.weightLb = String(number * (state.unit === "kg" ? 2.204 : 1));
      else if (field === "heightIn") state.nutritionProfile.heightIn = String(number / (state.unit === "kg" ? 2.54 : 1));
      else if (field === "age") state.nutritionProfile.age = String(number);
    } else if (target.validity.badInput) {
      showToast("Enter a valid number.");
      render();
      return;
    } else {
      state.nutritionProfile[field] = "";
    }
    saveState();
    render();
    return;
  }
  if (target.matches('[data-role="set-done"]')) {
    const log = sessionLog(target.dataset.sessionKey);
    const set = ensureSetLog(log, Number(target.dataset.exercise), Number(target.dataset.set));
    set.done = target.checked;
    state.logs[target.dataset.sessionKey] = log;
    saveState();
    const ref = sessionForIndex(selectedSessionIndex);
    if (ref) {
      updateWorkoutProgress(ref);
      const exerciseCard = target.closest(".exercise-card");
      const exercise = ref.session.exercises[Number(target.dataset.exercise)];
      const exerciseSets = log.sets[Number(target.dataset.exercise)] || {};
      const doneCount = Object.values(exerciseSets).filter((item) => item.done).length;
      exerciseCard?.classList.toggle("is-done", doneCount >= exercise.sets);
    }
    return;
  }
  if (target.matches('[data-role="set-value"]')) {
    const log = sessionLog(target.dataset.sessionKey);
    const set = ensureSetLog(log, Number(target.dataset.exercise), Number(target.dataset.set));
    set[target.dataset.field] = target.value.trim();
    state.logs[target.dataset.sessionKey] = log;
    saveState();
    return;
  }
  if (target.matches('[data-role="workout-note"]')) {
    const log = sessionLog(target.dataset.sessionKey);
    log.note = target.value;
    state.logs[target.dataset.sessionKey] = log;
    saveState();
    return;
  }
  if (target.matches("#backup-file")) {
    importBackup(target.files?.[0]);
    target.value = "";
  }
}

function handleExerciseVideoToggle(event) {
  const details = event.target;
  if (!(details instanceof HTMLDetailsElement) || !details.matches(".exercise-video")) return;
  const player = details.querySelector(".exercise-video-player");
  if (!(player instanceof HTMLElement)) return;
  if (!details.open) {
    player.replaceChildren();
    return;
  }
  if (player.querySelector("iframe")) return;

  const iframe = document.createElement("iframe");
  iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(details.dataset.videoId)}?playsinline=1&rel=0`;
  iframe.title = `${details.dataset.exerciseName} demonstration`;
  iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.allowFullscreen = true;
  player.append(iframe);
}

document.addEventListener("click", handleClick);
document.addEventListener("change", handleChange);
document.addEventListener("toggle", handleExerciseVideoToggle, true);

async function boot() {
  try {
    const response = await fetch("workouts.json");
    if (!response.ok) throw new Error(`Workout data request failed (${response.status}).`);
    program = await response.json();
    if (program.weeks?.length !== 12 || program.weeks.some((week) => week.sessions?.length !== 5)) {
      throw new Error("The workout plan data is incomplete.");
    }
    render();
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("./service-worker.js").catch((error) => {
        showWarning(`Offline caching could not be enabled: ${error.message}. The app will still work while online.`);
      });
    }
  } catch (error) {
    console.error(error);
    appMain.innerHTML = `<div class="empty-state"><span class="empty-icon">!</span><h2>Couldn't load the workout plan</h2><p>${escapeHtml(error.message)} Please refresh while connected to the internet.</p></div>`;
  }
}

boot();
