// save.js — campaign progress in localStorage, guarded for browsers that
// refuse it (private mode, file://). Nothing here is required to play.
const KEY = 'solmara-heat-save-v1';

export function saveExists() {
  try { return !!window.localStorage.getItem(KEY); } catch (e) { return false; }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d.missionIndex !== 'number') return null;
    return d;
  } catch (e) { return null; }
}

export function writeSave(data) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export function clearSave() {
  try { window.localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
