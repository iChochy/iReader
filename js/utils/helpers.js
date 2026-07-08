/**
 * 通用工具函数库
 * 提供常用的数据处理和计算方法
 * 
 * @module utils/helpers
 */

/**
 * 将数值限制在指定范围内
 * @param {number} value - 要限制的值
 * @param {number} min - 最小值
 * @param {number} max - 最大值
 * @returns {number} 限制后的值
 */
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * 延迟执行函数
 * @param {number} ms - 延迟时间（毫秒）
 * @returns {Promise<void>}
 */
export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 防抖函数（延迟执行，如果在延迟期间再次调用则重置计时器）
 * @param {Function} func - 要防抖的函数
 * @param {number} [wait=300] - 等待时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
export function debounce(func, wait = 300) {
  let timeoutId;
  return function debounced(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * 节流函数（限制执行频率）
 * @param {Function} func - 要节流的函数
 * @param {number} [wait=300] - 限制时间（毫秒）
 * @returns {Function} 节流后的函数
 */
export function throttle(func, wait = 300) {
  let lastCall = 0;
  return function throttled(...args) {
    const now = Date.now();
    if (now - lastCall >= wait) {
      lastCall = now;
      return func.apply(this, args);
    }
  };
}

/**
 * 将秒数格式化为 mm:ss 格式
 * @param {number} seconds - 秒数
 * @returns {string} 格式化后的时间字符串
 */
export function formatTime(seconds) {
  if (isNaN(seconds) || !Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 解析 mm:ss 或 mm:ss.xx 格式的时间字符串为秒数
 * @param {string} timeStr - 时间字符串
 * @returns {number} 秒数
 */
export function parseTimeString(timeStr) {
  if (!timeStr) return 0;
  const match = timeStr.match(/(\d+):(\d+)(?:\.(\d+))?/);
  if (!match) return 0;
  
  const mins = parseInt(match[1]);
  const secs = parseInt(match[2]);
  const millis = match[3] ? parseInt(match[3].padEnd(3, '0')) : 0;
  
  return mins * 60 + secs + millis / 1000;
}

/**
 * 深度克隆对象
 * @param {*} obj - 要克隆的对象
 * @returns {*} 克隆后的对象
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (obj instanceof Object) {
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  return obj;
}

/**
 * 浅度合并对象
 * @param {Object} target - 目标对象
 * @param {Object} source - 源对象
 * @returns {Object} 合并后的对象
 */
export function mergeObjects(target, source) {
  return { ...target, ...source };
}

/**
 * 检查值是否为有效的数字
 * @param {*} value - 要检查的值
 * @returns {boolean}
 */
export function isValidNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * 检查值是否为有效的字符串
 * @param {*} value - 要检查的值
 * @returns {boolean}
 */
export function isValidString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * 检查值是否为非空对象
 * @param {*} value - 要检查的值
 * @returns {boolean}
 */
export function isValidObject(value) {
  return value !== null && typeof value === 'object' && Object.keys(value).length > 0;
}

/**
 * 检查值是否为非空数组
 * @param {*} value - 要检查的值
 * @returns {boolean}
 */
export function isValidArray(value) {
  return Array.isArray(value) && value.length > 0;
}

/**
 * 使用指定分隔符连接路径
 * @param {...string} parts - 路径部分
 * @returns {string} 连接后的路径
 */
export function joinPath(...parts) {
  return parts
    .filter(part => part && part.trim())
    .map(part => part.toString().replace(/\/$/, ''))
    .join('/');
}

/**
 * 获取 URL 的查询参数
 * @param {string} [url=location.search] - URL 字符串
 * @returns {Object} 查询参数对象
 */
export function getQueryParams(url = location.search) {
  const params = new URLSearchParams(url);
  const result = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

/**
 * 设置 CSS 变量
 * @param {string} name - 变量名（不需要前缀 --）
 * @param {string} value - 变量值
 * @param {Element} [target=document.documentElement] - 目标元素
 */
export function setCSSVariable(name, value, target = document.documentElement) {
  const varName = name.startsWith('--') ? name : `--${name}`;
  target.style.setProperty(varName, value);
}

/**
 * 获取 CSS 变量
 * @param {string} name - 变量名（不需要前缀 --）
 * @param {Element} [target=document.documentElement] - 目标元素
 * @returns {string} 变量值
 */
export function getCSSVariable(name, target = document.documentElement) {
  const varName = name.startsWith('--') ? name : `--${name}`;
  return getComputedStyle(target).getPropertyValue(varName).trim();
}

/**
 * 检查浏览器是否支持某个特性
 * @param {string} feature - 特性名
 * @returns {boolean}
 */
export function supportFeature(feature) {
  const root = document.documentElement;
  const styles = window.getComputedStyle(root);
  
  switch (feature) {
    case 'css-variables':
      return CSS.supports('--test', '0');
    case 'backdrop-filter':
      return CSS.supports('backdrop-filter', 'blur(10px)');
    case 'flexbox':
      return CSS.supports('display', 'flex');
    case 'grid':
      return CSS.supports('display', 'grid');
    default:
      return false;
  }
}

/**
 * 异步加载脚本文件
 * @param {string} src - 脚本 URL
 * @returns {Promise<void>}
 */
export function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

/**
 * 异步加载样式文件
 * @param {string} href - 样式 URL
 * @returns {Promise<void>}
 */
export function loadStyle(href) {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load style: ${href}`));
    document.head.appendChild(link);
  });
}
