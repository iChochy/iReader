/**
 * 轻量 toast 提示
 * @module ui/Toast
 */

const SHOW_CLASS = 'show';
const DEFAULT_DURATION = 2000;
const HIDE_DELAY = 300; // 与 CSS 隐藏过渡时长一致，用于过渡结束后清理

const TYPES = ['info', 'success', 'warning', 'error'];

export class Toast {
  /**
   * @param {Object} [options]
   * @param {number} [options.duration=2000] 单条提示显示时长（毫秒）
   */
  constructor(options = {}) {
    this.duration = options.duration ?? DEFAULT_DURATION;
    this.timer = null;
    this.hideTimer = null;
    this.el = null;
  }

  /**
   * 显示提示；连续调用会替换当前内容并重置计时
   * @param {string} message
   * @param {Object} [options]
   * @param {'info'|'success'|'warning'|'error'} [options.type='info'] 提示类型
   * @param {number} [options.duration] 本条提示显示时长，覆盖默认值
   */
  show(message, options = {}) {
    const el = this.#ensureEl();
    const type = TYPES.includes(options.type) ? options.type : 'info';
    const duration = options.duration ?? this.duration;

    el.textContent = message;
    el.dataset.type = type;
    el.setAttribute('aria-live', 'polite');
    el.classList.add(SHOW_CLASS);

    clearTimeout(this.timer);
    clearTimeout(this.hideTimer);
    this.timer = setTimeout(() => this.hide(), duration);
  }

  /**
   * 立即隐藏当前提示
   */
  hide() {
    clearTimeout(this.timer);
    const el = this.el;
    if (!el || !el.classList.contains(SHOW_CLASS)) return;
    el.classList.remove(SHOW_CLASS);
    el.setAttribute('aria-live', 'off');
    // 过渡结束后清空文本，避免 aria-live 区域残留旧内容
    this.hideTimer = setTimeout(() => {
      if (el.classList.contains(SHOW_CLASS)) return;
      el.textContent = '';
    }, HIDE_DELAY);
  }

  destroy() {
    clearTimeout(this.timer);
    clearTimeout(this.hideTimer);
    this.timer = null;
    this.hideTimer = null;
    this.el?.remove();
    this.el = null;
  }

  #ensureEl() {
    if (this.el) return this.el;
    this.el = document.createElement('div');
    this.el.className = 'toast';
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'off');
    this.el.addEventListener('click', () => this.hide());
    document.body.appendChild(this.el);
    return this.el;
  }
}
