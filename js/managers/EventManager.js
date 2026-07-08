/**
 * 事件管理系统
 * 统一管理应用中的所有事件监听和解绑
 * 
 * @module managers/EventManager
 */

/**
 * 事件管理器
 * 用于集中管理事件监听，提供便利的事件清理功能
 */
export class EventManager {
  /**
   * 构造函数
   */
  constructor() {
    this.listeners = new Map(); // 存储所有监听器的映射
  }

  /**
   * 注册事件监听
   * @param {Element} target - 事件目标
   * @param {string} event - 事件名
   * @param {Function} handler - 事件处理函数
   * @param {Object} [options={}] - 事件选项
   */
  on(target, event, handler, options = {}) {
    if (!target) return;

    const key = this.getKey(target, event, handler);

    // 避免重复注册
    if (this.listeners.has(key)) {
      return;
    }

    target.addEventListener(event, handler, options);

    // 记录监听器
    this.listeners.set(key, { target, event, handler, options });
  }

  /**
   * 移除事件监听
   * @param {Element} target - 事件目标
   * @param {string} event - 事件名
   * @param {Function} handler - 事件处理函数
   */
  off(target, event, handler) {
    if (!target) return;

    const key = this.getKey(target, event, handler);

    if (this.listeners.has(key)) {
      const { target: t, event: e, handler: h, options } = this.listeners.get(key);
      t.removeEventListener(e, h, options);
      this.listeners.delete(key);
    }
  }

  /**
   * 一次性事件监听
   * @param {Element} target - 事件目标
   * @param {string} event - 事件名
   * @param {Function} handler - 事件处理函数
   * @param {Object} [options={}] - 事件选项
   */
  once(target, event, handler, options = {}) {
    if (!target) return;

    const wrapper = (e) => {
      handler.call(this, e);
      this.off(target, event, wrapper);
    };

    this.on(target, event, wrapper, { ...options, once: true });
  }

  /**
   * 事件委托
   * @param {Element} target - 委托目标
   * @param {string} event - 事件名
   * @param {string} selector - 选择器
   * @param {Function} handler - 事件处理函数
   */
  delegate(target, event, selector, handler) {
    if (!target) return;

    const delegateHandler = (e) => {
      const delegateTarget = e.target.closest(selector);
      if (delegateTarget) {
        handler.call(delegateTarget, e);
      }
    };

    this.on(target, event, delegateHandler);
  }

  /**
   * 移除指定目标的所有事件
   * @param {Element} target - 事件目标
   */
  offAll(target) {
    if (!target) return;

    const keysToDelete = [];

    for (const [key, { target: t }] of this.listeners) {
      if (t === target) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      const { target: t, event: e, handler: h, options } = this.listeners.get(key);
      t.removeEventListener(e, h, options);
      this.listeners.delete(key);
    }
  }

  /**
   * 清空所有事件监听
   */
  clear() {
    for (const { target, event, handler, options } of this.listeners.values()) {
      target.removeEventListener(event, handler, options);
    }
    this.listeners.clear();
  }

  /**
   * 获取监听器的唯一键
   * @private
   * @param {Element} target - 事件目标
   * @param {string} event - 事件名
   * @param {Function} handler - 事件处理函数
   * @returns {string}
   */
  getKey(target, event, handler) {
    return `${target.id || target.className || target.tagName}:${event}:${handler.name || 'anonymous'}`;
  }

  /**
   * 获取统计信息
   * @returns {Object}
   */
  getStats() {
    return {
      totalListeners: this.listeners.size,
      listenersByTarget: this.getListenersByTarget(),
    };
  }

  /**
   * 按目标分组统计监听器
   * @private
   * @returns {Map}
   */
  getListenersByTarget() {
    const stats = new Map();

    for (const { target, event } of this.listeners.values()) {
      const key = target.id || target.className || target.tagName;
      if (!stats.has(key)) {
        stats.set(key, []);
      }
      stats.get(key).push(event);
    }

    return stats;
  }
}

/**
 * 键盘事件处理器
 * 提供便利的键盘事件监听和快捷键绑定
 */
export class KeyboardEventHandler {
  /**
   * 构造函数
   * @param {EventManager} eventManager - 事件管理器实例
   */
  constructor(eventManager) {
    this.eventManager = eventManager;
    this.shortcuts = new Map();
  }

  /**
   * 绑定快捷键
   * @param {string} key - 按键名 (e.g., 'Enter', 'Space', 'Escape')
   * @param {Function} handler - 处理函数
   * @param {Object} [modifiers={}] - 修饰键 {ctrl, alt, shift}
   */
  bindShortcut(key, handler, modifiers = {}) {
    const shortcutKey = this.getShortcutKey(key, modifiers);

    if (!this.shortcuts.has(shortcutKey)) {
      this.shortcuts.set(shortcutKey, []);
    }

    this.shortcuts.get(shortcutKey).push(handler);

    // 注册全局键盘事件监听（仅一次）
    if (this.shortcuts.size === 1) {
      this.eventManager.on(document, 'keydown', (e) => {
        this.handleKeydown(e);
      });
    }
  }

  /**
   * 移除快捷键绑定
   * @param {string} key - 按键名
   * @param {Function} [handler] - 处理函数（如不指定则删除所有）
   * @param {Object} [modifiers={}] - 修饰键
   */
  unbindShortcut(key, handler, modifiers = {}) {
    const shortcutKey = this.getShortcutKey(key, modifiers);
    const handlers = this.shortcuts.get(shortcutKey);

    if (!handlers) return;

    if (handler) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    } else {
      handlers.length = 0;
    }

    if (handlers.length === 0) {
      this.shortcuts.delete(shortcutKey);
    }
  }

  /**
   * 处理键盘按下事件
   * @private
   * @param {KeyboardEvent} e - 键盘事件
   */
  handleKeydown(e) {
    const shortcutKey = this.getShortcutKey(e.key, {
      ctrl: e.ctrlKey || e.metaKey,
      alt: e.altKey,
      shift: e.shiftKey,
    });

    const handlers = this.shortcuts.get(shortcutKey);
    if (handlers && handlers.length > 0) {
      for (const handler of handlers) {
        handler(e);
      }
    }
  }

  /**
   * 生成快捷键的唯一标识
   * @private
   * @param {string} key - 按键名
   * @param {Object} modifiers - 修饰键
   * @returns {string}
   */
  getShortcutKey(key, modifiers = {}) {
    const parts = [];
    if (modifiers.ctrl) parts.push('Ctrl');
    if (modifiers.alt) parts.push('Alt');
    if (modifiers.shift) parts.push('Shift');
    parts.push(key);
    return parts.join('+');
  }

  /**
   * 清空所有快捷键
   */
  clear() {
    this.shortcuts.clear();
  }
}
