/**
 * localStorage 读写
 * @module utils/storage
 */

export function getStorage(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item !== null ? item : defaultValue;
  } catch (error) {
    console.error(`Failed to read from storage (${key}):`, error);
    return defaultValue;
  }
}

export function setStorage(key, value) {
  try {
    localStorage.setItem(key, String(value));
    return true;
  } catch (error) {
    console.error(`Failed to write to storage (${key}):`, error);
    return false;
  }
}

export function getPlayTime(bookKey, unitIndex) {
  const value = getStorage(`${bookKey}/${unitIndex}/playTime`);
  if (!value) return 0;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function savePlayTime(bookKey, unitIndex, time) {
  if (!bookKey || unitIndex < 0 || !Number.isFinite(time)) return;
  setStorage(`${bookKey}/${unitIndex}/playTime`, time);
}

export function getCurrentUnitIndex(bookKey) {
  const value = getStorage(`${bookKey}/currentUnitIndex`);
  if (!value) return 0;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function saveCurrentUnitIndex(bookKey, index) {
  if (!bookKey) return;
  setStorage(`${bookKey}/currentUnitIndex`, index);
}
