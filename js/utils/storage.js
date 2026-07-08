/**
 * localStorage 管理工具库
 * 提供安全的本地存储操作，支持类型转换和错误处理
 * 
 * @module utils/storage
 */

/**
 * 安全地从 localStorage 读取数据
 * @param {string} key - 存储键
 * @param {*} [defaultValue] - 默认值
 * @returns {*} 存储的值或默认值
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

/**
 * 从 localStorage 读取 JSON 数据
 * @param {string} key - 存储键
 * @param {*} [defaultValue] - 默认值
 * @returns {*} 解析后的值或默认值
 */
export function getStorageJSON(key, defaultValue = null) {
  try {
    const item = getStorage(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Failed to parse JSON from storage (${key}):`, error);
    return defaultValue;
  }
}

/**
 * 安全地向 localStorage 写入数据
 * @param {string} key - 存储键
 * @param {string} value - 存储值
 * @returns {boolean} 是否成功
 */
export function setStorage(key, value) {
  try {
    localStorage.setItem(key, String(value));
    return true;
  } catch (error) {
    console.error(`Failed to write to storage (${key}):`, error);
    return false;
  }
}

/**
 * 安全地向 localStorage 写入 JSON 数据
 * @param {string} key - 存储键
 * @param {*} value - 要存储的值
 * @returns {boolean} 是否成功
 */
export function setStorageJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Failed to write JSON to storage (${key}):`, error);
    return false;
  }
}

/**
 * 从 localStorage 删除数据
 * @param {string} key - 存储键
 * @returns {boolean} 是否成功
 */
export function removeStorage(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Failed to remove from storage (${key}):`, error);
    return false;
  }
}

/**
 * 清空所有 localStorage 数据
 * @returns {boolean} 是否成功
 */
export function clearStorage() {
  try {
    localStorage.clear();
    return true;
  } catch (error) {
    console.error('Failed to clear storage:', error);
    return false;
  }
}

/**
 * 检查 localStorage 是否可用
 * @returns {boolean}
 */
export function isStorageAvailable() {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 获取与特定课本和单元相关的播放进度
 * @param {string} bookPath - 课本路径
 * @param {number} unitIndex - 单元索引
 * @returns {number} 播放时间（秒）
 */
export function getPlayTime(bookPath, unitIndex) {
  const value = getStorage(`${bookPath}/${unitIndex}/playTime`);
  if (value) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * 保存与特定课本和单元相关的播放进度
 * @param {string} bookPath - 课本路径
 * @param {number} unitIndex - 单元索引
 * @param {number} time - 播放时间（秒）
 */
export function savePlayTime(bookPath, unitIndex, time) {
  setStorage(`${bookPath}/${unitIndex}/playTime`, time);
}

/**
 * 获取与特定课本相关的当前单元索引
 * @param {string} bookPath - 课本路径
 * @returns {number} 单元索引
 */
export function getCurrentUnitIndex(bookPath) {
  const value = getStorage(`${bookPath}/currentUnitIndex`);
  if (value) {
    const parsed = parseInt(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }
  return 0;
}

/**
 * 保存与特定课本相关的当前单元索引
 * @param {string} bookPath - 课本路径
 * @param {number} index - 单元索引
 */
export function saveCurrentUnitIndex(bookPath, index) {
  setStorage(`${bookPath}/currentUnitIndex`, index);
}
