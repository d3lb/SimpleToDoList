// View preferences, not task data: losing these is harmless, so they stay
// in localStorage rather than the saved list file.
const SHOW_COMPLETED_KEY = "simple-list:show-completed";

export function loadShowCompleted() {
  try {
    return localStorage.getItem(SHOW_COMPLETED_KEY) !== "false";
  } catch {
    return true;
  }
}

export function saveShowCompleted(value) {
  try {
    localStorage.setItem(SHOW_COMPLETED_KEY, String(value));
  } catch {
    // A missing preference just means the section starts expanded.
  }
}
