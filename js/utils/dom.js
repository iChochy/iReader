/**
 * DOM 快捷操作
 * @module utils/dom
 */

export const qs = (selector, root = document) => root.querySelector(selector);

export const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export const addClass = (el, className) => el?.classList?.add(className);

export const removeClass = (el, className) => el?.classList?.remove(className);

export const toggleClass = (el, className, force) => el?.classList?.toggle(className, force);

export const setText = (el, text) => {
  if (el) el.textContent = text;
};

export const setHTML = (el, html) => {
  if (el) el.innerHTML = html;
};

export const on = (el, event, handler, options) => {
  el?.addEventListener(event, handler, options);
};

export const off = (el, event, handler, options) => {
  el?.removeEventListener(event, handler, options);
};

export const delegate = (el, event, selector, handler, options) => {
  on(el, event, (e) => {
    const target = e.target.closest(selector);
    if (target && el.contains(target)) handler.call(target, e);
  }, options);
};
