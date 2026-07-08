/**
 * DOM 操作工具函数库
 * 提供常用的 DOM 选择和操作方法的快捷方式
 * 
 * @module utils/dom
 */

/**
 * querySelector 的简写
 * @param {string} selector - CSS 选择器
 * @param {Element} [root=document] - 根元素
 * @returns {Element|null} 匹配的元素
 */
export const qs = (selector, root = document) => root.querySelector(selector);

/**
 * querySelectorAll 的简写，返回数组
 * @param {string} selector - CSS 选择器
 * @param {Element} [root=document] - 根元素
 * @returns {Element[]} 匹配的元素数组
 */
export const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

/**
 * 获取元素的属性值
 * @param {Element} el - 目标元素
 * @param {string} attr - 属性名
 * @returns {string|null} 属性值
 */
export const getAttr = (el, attr) => el?.getAttribute(attr) ?? null;

/**
 * 设置元素的属性值
 * @param {Element} el - 目标元素
 * @param {string} attr - 属性名
 * @param {string} value - 属性值
 */
export const setAttr = (el, attr, value) => el?.setAttribute(attr, value);

/**
 * 判断元素是否有指定类名
 * @param {Element} el - 目标元素
 * @param {string} className - 类名
 * @returns {boolean}
 */
export const hasClass = (el, className) => el?.classList?.contains(className) ?? false;

/**
 * 添加类名
 * @param {Element} el - 目标元素
 * @param {string} className - 类名
 */
export const addClass = (el, className) => el?.classList?.add(className);

/**
 * 移除类名
 * @param {Element} el - 目标元素
 * @param {string} className - 类名
 */
export const removeClass = (el, className) => el?.classList?.remove(className);

/**
 * 切换类名
 * @param {Element} el - 目标元素
 * @param {string} className - 类名
 * @param {boolean} [force] - 强制添加或移除
 */
export const toggleClass = (el, className, force) => el?.classList?.toggle(className, force);

/**
 * 设置元素的文本内容
 * @param {Element} el - 目标元素
 * @param {string} text - 文本内容
 */
export const setText = (el, text) => {
  if (el) el.textContent = text;
};

/**
 * 设置元素的 HTML 内容
 * @param {Element} el - 目标元素
 * @param {string} html - HTML 字符串
 */
export const setHTML = (el, html) => {
  if (el) el.innerHTML = html;
};

/**
 * 获取元素相对于视口的位置和大小
 * @param {Element} el - 目标元素
 * @returns {DOMRect} 位置和大小信息
 */
export const getRect = (el) => el?.getBoundingClientRect() ?? null;

/**
 * 判断元素是否在视口内
 * @param {Element} el - 目标元素
 * @returns {boolean}
 */
export const isInViewport = (el) => {
  const rect = getRect(el);
  return !!(rect && rect.top < window.innerHeight && rect.bottom > 0);
};

/**
 * 滚动元素到可视区域
 * @param {Element} el - 目标元素
 * @param {Object} [options] - scrollIntoView 选项
 */
export const scrollIntoView = (el, options = {}) => {
  const defaults = { behavior: 'smooth', block: 'center' };
  el?.scrollIntoView({ ...defaults, ...options });
};

/**
 * 监听元素事件
 * @param {Element} el - 目标元素
 * @param {string} event - 事件名
 * @param {Function} handler - 事件处理函数
 * @param {Object} [options] - 事件选项
 */
export const on = (el, event, handler, options) => {
  el?.addEventListener(event, handler, options);
};

/**
 * 移除元素事件监听
 * @param {Element} el - 目标元素
 * @param {string} event - 事件名
 * @param {Function} handler - 事件处理函数
 * @param {Object} [options] - 事件选项
 */
export const off = (el, event, handler, options) => {
  el?.removeEventListener(event, handler, options);
};

/**
 * 事件委托监听
 * @param {Element} el - 目标元素
 * @param {string} event - 事件名
 * @param {string} selector - 委托选择器
 * @param {Function} handler - 事件处理函数
 */
export const delegate = (el, event, selector, handler) => {
  on(el, event, (e) => {
    const target = e.target.closest(selector);
    if (target) handler.call(target, e);
  });
};
