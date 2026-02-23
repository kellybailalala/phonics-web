const STAGE_ORDER = ["onboarding", "child", "lesson", "player", "reward", "dashboard"];
const STAGE_TITLE = {
  onboarding: "Parent onboarding",
  child: "Create child profile",
  lesson: "Today's guided lesson",
  player: "Child session",
  reward: "Reward",
  dashboard: "Parent dashboard"
};

const state = {
  parentId: null,
  token: null,
  child: null,
  lesson: null,
  sessionId: null,
  completedActivityIds: [],
  activityIndex: 0,
  activeStage: "onboarding",
  stageAnimating: false
};

const refs = {
  stagePages: Array.from(document.querySelectorAll(".stage-page")),
  stageIndicator: document.getElementById("stage-indicator"),
  signupForm: document.getElementById("signup-form"),
  signupIdentity: document.getElementById("signup-identity"),
  consentForm: document.getElementById("consent-form"),
  consentAccepted: document.getElementById("consent-accepted"),
  childForm: document.getElementById("child-form"),
  childName: document.getElementById("child-name"),
  childAge: document.getElementById("child-age"),
  childLanguage: document.getElementById("child-language"),
  childAvatar: document.getElementById("child-avatar"),
  lessonSummary: document.getElementById("lesson-summary"),
  fetchLessonBtn: document.getElementById("fetch-lesson-btn"),
  startSessionBtn: document.getElementById("start-session-btn"),
  openDashboardBtn: document.getElementById("open-dashboard-btn"),
  activityCounter: document.getElementById("activity-counter"),
  activityTitle: document.getElementById("activity-title"),
  activitySkill: document.getElementById("activity-skill"),
  activityAssets: document.getElementById("activity-assets"),
  playAudioBtn: document.getElementById("play-audio-btn"),
  doneActivityBtn: document.getElementById("done-activity-btn"),
  rewardLabel: document.getElementById("reward-label"),
  goDashboardBtn: document.getElementById("go-dashboard-btn"),
  backToLessonFromRewardBtn: document.getElementById("back-to-lesson-from-reward-btn"),
  dashboardGrid: document.getElementById("dashboard-grid"),
  refreshProgressBtn: document.getElementById("refresh-progress-btn"),
  backToLessonBtn: document.getElementById("back-to-lesson-btn"),
  deleteDataBtn: document.getElementById("delete-data-btn"),
  deletionStatus: document.getElementById("deletion-status"),
  retryPanel: document.getElementById("retry-panel"),
  retryBtn: document.getElementById("retry-btn"),
  errorMessage: document.getElementById("error-message"),
  status: document.getElementById("status")
};

let retryAction = null;

function saveSession() {
  localStorage.setItem(
    "tinysteps-session",
    JSON.stringify({
      parentId: state.parentId,
      token: state.token,
      child: state.child
    })
  );
}

function loadSession() {
  try {
    const raw = localStorage.getItem("tinysteps-session");
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw);
    state.parentId = parsed.parentId ?? null;
    state.token = parsed.token ?? null;
    state.child = parsed.child ?? null;
  } catch {
    localStorage.removeItem("tinysteps-session");
  }
}

function show(el, visible) {
  el.classList.toggle("hidden", !visible);
}

function setStatus(message) {
  refs.status.textContent = message;
}

function setRetry(message, fn) {
  refs.errorMessage.textContent = message;
  retryAction = fn;
  show(refs.retryPanel, true);
}

function clearRetry() {
  retryAction = null;
  show(refs.retryPanel, false);
}

function authHeaders() {
  return state.token ? { Authorization: `Bearer ${state.token}` } : {};
}

function getStageElement(stage) {
  return refs.stagePages.find((el) => el.dataset.stage === stage) || null;
}

function resetStageClasses(el) {
  el.classList.remove("is-active", "is-entering", "is-leaving", "forward", "backward");
}

function renderStageIndicator(stage) {
  const pageIndex = STAGE_ORDER.indexOf(stage);
  refs.stageIndicator.textContent = `Page ${pageIndex + 1} of ${STAGE_ORDER.length}: ${STAGE_TITLE[stage]}`;
}

function setStageInstant(stage) {
  for (const page of refs.stagePages) {
    resetStageClasses(page);
    if (page.dataset.stage === stage) {
      page.classList.add("is-active");
    }
  }

  state.activeStage = stage;
  renderStageIndicator(stage);
}

function goToStage(stage, options = {}) {
  const { instant = false } = options;
  if (!STAGE_ORDER.includes(stage)) {
    return;
  }

  if (state.stageAnimating) {
    return;
  }

  if (instant || state.activeStage === stage) {
    setStageInstant(stage);
    return;
  }

  const from = state.activeStage;
  const fromEl = getStageElement(from);
  const toEl = getStageElement(stage);
  if (!fromEl || !toEl) {
    setStageInstant(stage);
    return;
  }

  state.stageAnimating = true;

  resetStageClasses(fromEl);
  resetStageClasses(toEl);

  const direction = STAGE_ORDER.indexOf(stage) > STAGE_ORDER.indexOf(from) ? "forward" : "backward";

  fromEl.classList.add("is-leaving", direction);
  toEl.classList.add("is-entering", direction);

  state.activeStage = stage;
  renderStageIndicator(stage);

  window.setTimeout(() => {
    resetStageClasses(fromEl);
    resetStageClasses(toEl);
    toEl.classList.add("is-active");
    state.stageAnimating = false;
  }, 470);
}

async function api(path, options = {}, retryFn) {
  clearRetry();
  setStatus("Loading...");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
        ...(options.headers || {})
      },
      signal: controller.signal
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `Request failed (${response.status})`);
    }

    setStatus("Ready");
    return payload;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    setStatus("Action failed");
    setRetry(`${message}. Retry when network is stable.`, retryFn);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function getActivityTitle(type) {
  const map = {
    listen_tap: "Listen and Tap",
    match_picture: "Picture Match",
    letter_sound: "Letter Sound",
    repeat_audio: "Repeat After Audio",
    trace_tap: "Trace and Tap"
  };
  return map[type] || "Activity";
}

function renderDashboard(progress) {
  const milestones = progress.milestoneBySkill || {};
  refs.dashboardGrid.innerHTML = "";

  const cards = [
    ["Sessions completed", progress.sessionsCompleted],
    ["Units completed", progress.unitsCompleted],
    ["Listening", milestones.listening || "not_started"],
    ["Phonics", milestones.phonics || "not_started"],
    ["Vocabulary", milestones.vocabulary || "not_started"],
    ["Last active", progress.lastActiveAt ? new Date(progress.lastActiveAt).toLocaleString() : "Not yet"]
  ];

  for (const [label, value] of cards) {
    const card = document.createElement("div");
    card.className = "metric";
    card.innerHTML = `<strong>${label}</strong><span>${value}</span>`;
    refs.dashboardGrid.appendChild(card);
  }
}

async function refreshProgress() {
  if (!state.child) {
    return;
  }

  const progress = await api(`/api/v1/children/${state.child.id}/progress`, { method: "GET" }, refreshProgress);
  renderDashboard(progress);
}

function renderActivity() {
  const current = state.lesson?.activities?.[state.activityIndex];
  if (!current) {
    completeSession().catch(() => {});
    return;
  }

  refs.activityCounter.textContent = `Activity ${state.activityIndex + 1} of ${state.lesson.activities.length}`;
  refs.activityTitle.textContent = getActivityTitle(current.type);
  refs.activitySkill.textContent = `Skill focus: ${current.targetSkill}`;
  refs.activityAssets.textContent = `Assets: ${current.assetIds.join(", ")}`;
}

async function fetchLesson() {
  if (!state.child) {
    return;
  }

  const lesson = await api(`/api/v1/children/${state.child.id}/lesson/today`, { method: "GET" }, fetchLesson);
  state.lesson = lesson;
  refs.lessonSummary.textContent = `Unit ${lesson.unitId} with ${lesson.activities.length} playful activities, about ${lesson.estimatedMinutes} minutes.`;
  refs.startSessionBtn.disabled = false;
}

async function startSession() {
  if (!state.child) {
    return;
  }

  const start = await api(
    `/api/v1/children/${state.child.id}/session/start`,
    { method: "POST", body: JSON.stringify({}) },
    startSession
  );

  state.sessionId = start.sessionId;
  state.lesson = {
    ...state.lesson,
    lessonId: start.lessonId,
    activities: start.activities
  };
  state.activityIndex = 0;
  state.completedActivityIds = [];

  goToStage("player");
  renderActivity();
}

async function completeSession() {
  if (!state.child || !state.sessionId) {
    return;
  }

  const result = await api(
    `/api/v1/children/${state.child.id}/session/complete`,
    {
      method: "POST",
      body: JSON.stringify({
        sessionId: state.sessionId,
        completedActivityIds: state.completedActivityIds
      })
    },
    completeSession
  );

  refs.rewardLabel.textContent = `${result.reward.label} (${result.reward.type})`;
  goToStage("reward");
  setStatus("Session completed. Great job!");
  await refreshProgress();
}

function playSpeechPrompt(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-SG";
  utterance.rate = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function playCurrentPrompt() {
  const current = state.lesson?.activities?.[state.activityIndex];
  if (!current) {
    return;
  }

  if (current.promptAudioUrl.startsWith("speech:")) {
    playSpeechPrompt(current.promptAudioUrl.replace("speech:", ""));
    return;
  }

  const audio = new Audio(current.promptAudioUrl);
  audio.play().catch(() => {
    setStatus("Audio unavailable. Tap again to retry.");
  });
}

refs.signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const identity = refs.signupIdentity.value.trim();
  if (!identity) {
    return;
  }

  const payload = identity.includes("@") ? { email: identity } : { phone: identity };

  try {
    const auth = await api(
      "/api/v1/parent/signup",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      () => refs.signupForm.requestSubmit()
    );

    state.parentId = auth.parentId;
    state.token = auth.token;
    saveSession();
    show(refs.consentForm, true);
    setStatus("Account created. Please submit consent.");
  } catch {
    // handled in api helper
  }
});

refs.consentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!refs.consentAccepted.checked) {
    setStatus("Please accept consent to continue.");
    return;
  }

  try {
    await api(
      "/api/v1/consent",
      {
        method: "POST",
        body: JSON.stringify({ accepted: true, market: "Singapore" })
      },
      () => refs.consentForm.requestSubmit()
    );

    goToStage("child");
    setStatus("Consent saved. Create your child profile.");
  } catch {
    // handled in api helper
  }
});

refs.childForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    displayName: refs.childName.value.trim(),
    ageMonths: Number(refs.childAge.value),
    homeLanguage: refs.childLanguage.value.trim(),
    avatarId: refs.childAvatar.value
  };

  try {
    const child = await api(
      "/api/v1/children",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      () => refs.childForm.requestSubmit()
    );

    state.child = child;
    saveSession();
    goToStage("lesson");
    setStatus(`Child profile ready. Placement track: ${child.placementTrack}.`);
    await refreshProgress();
  } catch {
    // handled in api helper
  }
});

refs.fetchLessonBtn.addEventListener("click", () => {
  fetchLesson().catch(() => {});
});

refs.startSessionBtn.addEventListener("click", () => {
  startSession().catch(() => {});
});

refs.openDashboardBtn.addEventListener("click", async () => {
  if (!state.child) {
    return;
  }

  try {
    await refreshProgress();
    goToStage("dashboard");
  } catch {
    // handled in api helper
  }
});

refs.playAudioBtn.addEventListener("click", playCurrentPrompt);

refs.doneActivityBtn.addEventListener("click", () => {
  const current = state.lesson?.activities?.[state.activityIndex];
  if (!current) {
    return;
  }

  if (!state.completedActivityIds.includes(current.id)) {
    state.completedActivityIds.push(current.id);
  }

  state.activityIndex += 1;
  if (state.activityIndex >= state.lesson.activities.length) {
    completeSession().catch(() => {});
    return;
  }

  renderActivity();
});

refs.goDashboardBtn.addEventListener("click", async () => {
  try {
    await refreshProgress();
    goToStage("dashboard");
  } catch {
    // handled in api helper
  }
});

refs.backToLessonFromRewardBtn.addEventListener("click", () => {
  goToStage("lesson");
});

refs.refreshProgressBtn.addEventListener("click", () => {
  refreshProgress().catch(() => {});
});

refs.backToLessonBtn.addEventListener("click", () => {
  goToStage("lesson");
});

refs.deleteDataBtn.addEventListener("click", async () => {
  if (!state.child) {
    return;
  }

  try {
    const deletion = await api(
      `/api/v1/children/${state.child.id}/data-deletion-request`,
      { method: "POST", body: JSON.stringify({}) },
      () => refs.deleteDataBtn.click()
    );

    refs.deletionStatus.textContent = `Deletion request queued: ${deletion.id} (${deletion.status}).`;
  } catch {
    // handled in api helper
  }
});

refs.retryBtn.addEventListener("click", () => {
  if (typeof retryAction === "function") {
    retryAction();
  }
});

function initialize() {
  loadSession();
  show(refs.consentForm, false);
  show(refs.retryPanel, false);

  if (state.child && state.token) {
    setStageInstant("lesson");
    refreshProgress().catch(() => {});
    setStatus("Welcome back. Continue today's lesson.");
    return;
  }

  if (state.token) {
    show(refs.consentForm, true);
    setStageInstant("onboarding");
    setStatus("Continue with consent, then create your child profile.");
    return;
  }

  setStageInstant("onboarding");
  setStatus("Ready");
}

initialize();
