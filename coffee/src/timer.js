export class Stopwatch {
  constructor(now = () => Date.now()) {
    this.now = now;
    this.startedAt = null;
    this.accumulatedMs = 0;
  }

  get isRunning() {
    return this.startedAt !== null;
  }

  get elapsedMs() {
    if (!this.isRunning) {
      return this.accumulatedMs;
    }

    return this.accumulatedMs + Math.max(0, this.now() - this.startedAt);
  }

  start() {
    if (this.isRunning) {
      return false;
    }

    this.startedAt = this.now();
    return true;
  }

  pause() {
    if (!this.isRunning) {
      return false;
    }

    this.accumulatedMs = this.elapsedMs;
    this.startedAt = null;
    return true;
  }

  reset() {
    this.startedAt = null;
    this.accumulatedMs = 0;
  }
}

export function formatElapsed(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
