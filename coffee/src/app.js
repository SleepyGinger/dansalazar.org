import {
  DEFAULT_DOSE,
  DEFAULT_RATIO,
  MAX_DOSE,
  MAX_RATIO,
  MIN_DOSE,
  MIN_RATIO,
  calculateRecipe,
  formatDose,
  parseDose,
  parseRatio,
} from "./recipe.js";
import { Stopwatch, formatElapsed } from "./timer.js";

const DOSE_STORAGE_KEY = "pour-over:coffee:v2";
const RATIO_STORAGE_KEY = "pour-over:ratio:v2";
const PLAY_ICON = "m9 7 8 5-8 5V7Z";
const PAUSE_ICON = "M8 7h3v10H8V7Zm5 0h3v10h-3V7Z";

const doseInput = document.querySelector("#coffee-dose");
const decreaseButton = document.querySelector("#decrease-dose");
const increaseButton = document.querySelector("#increase-dose");
const errorMessage = document.querySelector("#dose-error");
const ratioInput = document.querySelector("#water-ratio");
const ratioErrorMessage = document.querySelector("#ratio-error");
const decreaseRatioButton = document.querySelector("#decrease-ratio");
const increaseRatioButton = document.querySelector("#increase-ratio");
const totalWater = document.querySelector("#total-water");
const targetValues = [...document.querySelectorAll("[data-target]")];
const additionValues = [...document.querySelectorAll("[data-addition]")];
const recipeAnnouncement = document.querySelector("#recipe-announcement");

const timerDisplay = document.querySelector("#timer-display");
const timerState = document.querySelector("#timer-state");
const timerDot = document.querySelector("#timer-dot");
const timerToggle = document.querySelector("#timer-toggle");
const timerReset = document.querySelector("#timer-reset");
const timerButtonLabel = document.querySelector("#timer-button-label");
const timerButtonIcon = document.querySelector("#timer-button-icon");
const timerAnnouncement = document.querySelector("#timer-announcement");

const stopwatch = new Stopwatch();
let animationFrame = null;
let wakeLock = null;
let recipeAnnouncementTimer = null;

function safeStorageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // The calculator still works when storage is blocked or unavailable.
  }
}

function getInitialDose() {
  const url = new URL(window.location.href);
  const urlDose = url.searchParams.get("coffee");
  if (parseDose(urlDose).valid) {
    return parseDose(urlDose).dose;
  }

  const savedDose = safeStorageGet(DOSE_STORAGE_KEY);
  if (parseDose(savedDose).valid) {
    return parseDose(savedDose).dose;
  }

  return DEFAULT_DOSE;
}

function getInitialRatio() {
  const url = new URL(window.location.href);
  const urlRatio = url.searchParams.get("ratio");
  if (parseRatio(urlRatio).valid) {
    return parseRatio(urlRatio).ratio;
  }

  const savedRatio = safeStorageGet(RATIO_STORAGE_KEY);
  if (parseRatio(savedRatio).valid) {
    return parseRatio(savedRatio).ratio;
  }

  return DEFAULT_RATIO;
}

function saveRecipe(dose, ratio) {
  const formattedDose = formatDose(dose);
  const formattedRatio = formatDose(ratio);
  safeStorageSet(DOSE_STORAGE_KEY, formattedDose);
  safeStorageSet(RATIO_STORAGE_KEY, formattedRatio);

  const url = new URL(window.location.href);
  url.searchParams.set("coffee", formattedDose);
  url.searchParams.set("ratio", formattedRatio);
  window.history.replaceState({}, "", url);
}

function inputsAreValid() {
  return parseDose(doseInput.value).valid && parseRatio(ratioInput.value).valid;
}

function updateTimerAvailability() {
  timerToggle.disabled =
    !inputsAreValid() && !stopwatch.isRunning && stopwatch.elapsedMs === 0;
}

function setRecipeUnavailable() {
  totalWater.textContent = "—";
  [...targetValues, ...additionValues].forEach((element) => {
    element.textContent = "—";
  });
  updateTimerAvailability();
}

function announceRecipe(recipe) {
  window.clearTimeout(recipeAnnouncementTimer);
  recipeAnnouncementTimer = window.setTimeout(() => {
    recipeAnnouncement.textContent = `${formatDose(recipe.dose)} grams of coffee at a 1 to ${formatDose(recipe.ratio)} ratio. Pour until ${recipe.targets[0]}, then ${recipe.targets[1]}, then ${recipe.targets[2]} grams.`;
  }, 350);
}

function renderRecipe({ announce = true } = {}) {
  const parsedDose = parseDose(doseInput.value);
  const parsedRatio = parseRatio(ratioInput.value);

  if (!parsedDose.valid) {
    doseInput.setAttribute("aria-invalid", "true");
    errorMessage.textContent = parsedDose.message;
    decreaseButton.disabled = true;
    increaseButton.disabled = true;
  } else {
    doseInput.removeAttribute("aria-invalid");
    errorMessage.textContent = "";
    decreaseButton.disabled = parsedDose.dose <= MIN_DOSE;
    increaseButton.disabled = parsedDose.dose >= MAX_DOSE;
  }

  if (!parsedRatio.valid) {
    ratioInput.setAttribute("aria-invalid", "true");
    ratioErrorMessage.textContent = parsedRatio.message;
    decreaseRatioButton.disabled = true;
    increaseRatioButton.disabled = true;
  } else {
    ratioInput.removeAttribute("aria-invalid");
    ratioErrorMessage.textContent = "";
    decreaseRatioButton.disabled = parsedRatio.ratio <= MIN_RATIO;
    increaseRatioButton.disabled = parsedRatio.ratio >= MAX_RATIO;
  }

  if (!parsedDose.valid || !parsedRatio.valid) {
    setRecipeUnavailable();
    return;
  }

  const recipe = calculateRecipe(parsedDose.dose, parsedRatio.ratio);
  updateTimerAvailability();

  totalWater.textContent = recipe.totalWater;
  recipe.targets.forEach((target, index) => {
    targetValues[index].textContent = target;
    additionValues[index].textContent = recipe.additions[index];
  });

  saveRecipe(recipe.dose, recipe.ratio);
  if (announce) {
    announceRecipe(recipe);
  }
}

function changeDose(delta) {
  const parsed = parseDose(doseInput.value);
  const current = parsed.valid ? parsed.dose : DEFAULT_DOSE;
  const next = Math.min(MAX_DOSE, Math.max(MIN_DOSE, current + delta));
  doseInput.value = formatDose(next);
  renderRecipe();
}

function changeRatio(delta) {
  const parsed = parseRatio(ratioInput.value);
  const current = parsed.valid ? parsed.ratio : DEFAULT_RATIO;
  const next = Math.min(MAX_RATIO, Math.max(MIN_RATIO, current + delta));
  ratioInput.value = formatDose(next);
  renderRecipe();
}

function renderTimer() {
  if (animationFrame !== null) {
    window.cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }

  timerDisplay.textContent = formatElapsed(stopwatch.elapsedMs);
  timerReset.disabled = !stopwatch.isRunning && stopwatch.elapsedMs === 0;
  updateTimerAvailability();

  if (stopwatch.isRunning) {
    animationFrame = window.requestAnimationFrame(renderTimer);
  }
}

function setTimerMode(mode) {
  if (mode === "running") {
    timerButtonLabel.textContent = "Pause";
    timerButtonIcon.setAttribute("d", PAUSE_ICON);
    timerState.textContent = wakeLock ? "Running · Awake" : "Running";
    timerDot.classList.add("is-running");
    return;
  }

  timerButtonIcon.setAttribute("d", PLAY_ICON);
  timerDot.classList.remove("is-running");

  if (mode === "paused") {
    timerButtonLabel.textContent = "Resume";
    timerState.textContent = "Paused";
  } else {
    timerButtonLabel.textContent = "Start";
    timerState.textContent = "Ready";
  }
}

async function requestWakeLock() {
  if (!("wakeLock" in navigator) || document.visibilityState !== "visible") {
    return;
  }

  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => {
      wakeLock = null;
      if (stopwatch.isRunning) {
        timerState.textContent = "Running";
      }
    });

    if (stopwatch.isRunning) {
      timerState.textContent = "Running · Awake";
    }
  } catch {
    wakeLock = null;
  }
}

async function releaseWakeLock() {
  if (!wakeLock) {
    return;
  }

  const currentLock = wakeLock;
  wakeLock = null;
  try {
    await currentLock.release();
  } catch {
    // It may already have been released by the browser.
  }
}

async function toggleTimer() {
  if (stopwatch.isRunning) {
    stopwatch.pause();
    window.cancelAnimationFrame(animationFrame);
    await releaseWakeLock();
    setTimerMode("paused");
    timerAnnouncement.textContent = `Timer paused at ${formatElapsed(stopwatch.elapsedMs)}.`;
    renderTimer();
    return;
  }

  if (stopwatch.elapsedMs === 0 && !inputsAreValid()) {
    return;
  }

  const isFreshStart = stopwatch.elapsedMs === 0;
  stopwatch.start();
  setTimerMode("running");
  timerAnnouncement.textContent = isFreshStart ? "Brew timer started." : "Brew timer resumed.";
  renderTimer();
  await requestWakeLock();
}

async function resetTimer() {
  stopwatch.reset();
  window.cancelAnimationFrame(animationFrame);
  await releaseWakeLock();
  setTimerMode("ready");
  timerAnnouncement.textContent = "Brew timer reset.";
  renderTimer();
}

doseInput.value = formatDose(getInitialDose());
ratioInput.value = formatDose(getInitialRatio());
renderRecipe({ announce: false });
renderTimer();

doseInput.addEventListener("input", () => renderRecipe());
ratioInput.addEventListener("input", () => renderRecipe());
decreaseButton.addEventListener("click", () => changeDose(-1));
increaseButton.addEventListener("click", () => changeDose(1));
decreaseRatioButton.addEventListener("click", () => changeRatio(-1));
increaseRatioButton.addEventListener("click", () => changeRatio(1));
timerToggle.addEventListener("click", toggleTimer);
timerReset.addEventListener("click", resetTimer);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && stopwatch.isRunning) {
    renderTimer();
    requestWakeLock();
  }
});

if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // Offline support is an enhancement; the live page remains fully usable.
    });
  });
}
