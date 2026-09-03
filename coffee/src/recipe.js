export const DEFAULT_RATIO = 17;
// Kept as an alias for callers that used the original fixed-ratio API.
export const RATIO = DEFAULT_RATIO;
export const MIN_RATIO = 1;
export const MAX_RATIO = 30;
export const RATIO_STEP = 0.1;
export const MIN_DOSE = 1;
export const MAX_DOSE = 100;
export const DEFAULT_DOSE = 17;

const STEP_PRECISION = 10;

export function parseDose(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return { valid: false, reason: "empty", message: "Enter a coffee dose." };
  }

  const dose = Number(value);

  if (!Number.isFinite(dose)) {
    return { valid: false, reason: "not-a-number", message: "Enter a number between 1 and 100." };
  }

  if (dose < MIN_DOSE) {
    return { valid: false, reason: "too-small", message: "Coffee dose must be at least 1 g." };
  }

  if (dose > MAX_DOSE) {
    return { valid: false, reason: "too-large", message: "Coffee dose must be 100 g or less." };
  }

  const doseTenths = Math.round(dose * STEP_PRECISION);
  if (Math.abs(dose - doseTenths / STEP_PRECISION) > Number.EPSILON * 100) {
    return { valid: false, reason: "step", message: "Measure the dose to the nearest 0.1 g." };
  }

  return { valid: true, dose: doseTenths / STEP_PRECISION, doseTenths };
}

export function parseRatio(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return { valid: false, reason: "empty", message: "Enter a ratio." };
  }

  const ratio = Number(value);

  if (!Number.isFinite(ratio)) {
    return { valid: false, reason: "not-a-number", message: "Enter a number between 1 and 30." };
  }

  if (ratio < MIN_RATIO) {
    return { valid: false, reason: "too-small", message: "Ratio must be at least 1." };
  }

  if (ratio > MAX_RATIO) {
    return { valid: false, reason: "too-large", message: "Ratio must be 30 or less." };
  }

  const ratioTenths = Math.round(ratio * STEP_PRECISION);
  if (Math.abs(ratio - ratioTenths / STEP_PRECISION) > Number.EPSILON * 100) {
    return { valid: false, reason: "step", message: "Set the ratio to the nearest 0.1." };
  }

  return { valid: true, ratio: ratioTenths / STEP_PRECISION, ratioTenths };
}

export function calculateRecipe(value, ratioValue = DEFAULT_RATIO) {
  const parsedDose = parseDose(value);
  if (!parsedDose.valid) {
    throw new RangeError(parsedDose.message);
  }

  const parsedRatio = parseRatio(ratioValue);
  if (!parsedRatio.valid) {
    throw new RangeError(parsedRatio.message);
  }

  const { dose, doseTenths } = parsedDose;
  const { ratio, ratioTenths } = parsedRatio;
  const recipeHundredths = doseTenths * ratioTenths;

  // These integer formulas keep exact half-gram rounding predictable and avoid
  // binary floating-point surprises at display boundaries.
  const targets = [
    Math.round(recipeHundredths / 500),
    Math.round((recipeHundredths * 3) / 500),
    Math.round(recipeHundredths / 100),
  ];

  const additions = [targets[0], targets[1] - targets[0], targets[2] - targets[1]];

  return {
    dose,
    ratio,
    totalWater: targets[2],
    targets,
    additions,
  };
}

export function formatDose(dose) {
  return Number(dose).toFixed(1).replace(/\.0$/, "");
}
