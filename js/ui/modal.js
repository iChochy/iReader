/**
 * 打赏支持弹窗模块
 * 管理应用的打赏提示弹窗
 * 
 * @module ui/modal
 */

import { CONFIG } from '../config.js';

/**
 * 打赏弹窗管理器
 */
export class SupportModal {
  /**
   * 构造函数
   * @param {Object} [options={}] - 配置选项
   */
  constructor(options = {}) {
    this.modal = options.modal || document.getElementById('supportModal');
    this.openBtn = options.openBtn || document.getElementById('supportBtn');
    this.closeBtn = options.closeBtn || document.getElementById('supportCloseBtn');
    this.isOpen = false;
    this.animationDuration = options.animationDuration || CONFIG.UI.MODAL_ANIMATION_DURATION;
  }

  /**
   * 初始化弹窗
   */
  init() {
    if (!this.modal || !this.openBtn || !this.closeBtn) {
      return;
    }

    this.bindEvents();
  }

  /**
   * 打开弹窗
   */
  open() {
    if (!this.modal || this.isOpen) return;

    this.modal.classList.add('open');
    this.modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    this.isOpen = true;
  }

  /**
   * 关闭弹窗
   */
  close() {
    if (!this.modal || !this.isOpen) return;

    this.modal.classList.remove('open');
    this.modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    this.isOpen = false;
  }

  /**
   * 切换弹窗
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * 绑定事件
   * @private
   */
  bindEvents() {
    // 打开按钮
    if (this.openBtn) {
      this.openBtn.addEventListener('click', () => this.open());
    }

    // 关闭按钮
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    // 点击遮罩关闭
    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.close();
        }
      });
    }

    // ESC 键关闭
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  /**
   * 设置弹窗内容
   * @param {string} html - HTML 内容
   */
  setContent(html) {
    const content = this.modal?.querySelector('.support-text');
    if (content) {
      content.innerHTML = html;
    }
  }

  /**
   * 获取弹窗是否打开
   * @returns {boolean}
   */
  isOpened() {
    return this.isOpen;
  }
}

/**
 * 通用模态对话框管理器
 */
export class Modal {
  /**
   * 构造函数
   * @param {Object} [options={}] - 配置选项
   */
  constructor(options = {}) {
    this.element = options.element || null;
    this.isOpen = false;
    this.animationDuration = options.animationDuration || CONFIG.UI.MODAL_ANIMATION_DURATION;
    this.config = {
      closeOnEscape: true,
      closeOnBackdropClick: true,
      ...options,
    };
  }

  /**
   * 设置模态框元素
   * @param {Element} element - 模态框元素
   */
  setElement(element) {
    this.element = element;
  }

  /**
   * 打开模态框
   */
  open() {
    if (!this.element || this.isOpen) return;

    this.element.classList.add('open');
    this.element.setAttribute('aria-hidden', 'false');
    if (this.config.disableBodyScroll) {
      document.body.style.overflow = 'hidden';
    }
    this.isOpen = true;

    // 触发自定义事件
    this.element.dispatchEvent(new CustomEvent('modal:open'));
  }

  /**
   * 关闭模态框
   */
  close() {
    if (!this.element || !this.isOpen) return;

    this.element.classList.remove('open');
    this.element.setAttribute('aria-hidden', 'true');
    if (this.config.disableBodyScroll) {
      document.body.style.overflow = '';
    }
    this.isOpen = false;

    // 触发自定义事件
    this.element.dispatchEvent(new CustomEvent('modal:close'));
  }

  /**
   * 切换模态框
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * 绑定关闭按钮
   * @param {Element|string} trigger - 关闭按钮或选择器
   */
  bindCloseButton(trigger) {
    if (typeof trigger === 'string') {
      trigger = document.querySelector(trigger);
    }

    if (trigger) {
      trigger.addEventListener('click', () => this.close());
    }
  }

  /**
   * 绑定打开按钮
   * @param {Element|string} trigger - 打开按钮或选择器
   */
  bindOpenButton(trigger) {
    if (typeof trigger === 'string') {
      trigger = document.querySelector(trigger);
    }

    if (trigger) {
      trigger.addEventListener('click', () => this.open());
    }
  }

  /**
   * 获取模态框是否打开
   * @returns {boolean}
   */
  isOpened() {
    return this.isOpen;
  }

  /**
   * 销毁模态框
   */
  destroy() {
    this.close();
    this.element = null;
  }
}

/**
 * 确认对话框
 */
export class ConfirmDialog extends Modal {
  /**
   * 构造函数
   * @param {Object} [options={}] - 配置选项
   */
  constructor(options = {}) {
    super(options);
    this.onConfirm = options.onConfirm || (() => {});
    this.onCancel = options.onCancel || (() => {});
    this.confirmBtn = options.confirmBtn || null;
    this.cancelBtn = options.cancelBtn || null;
  }

  /**
   * 显示确认对话框
   * @param {string} message - 提示信息
   * @returns {Promise<boolean>} 用户是否确认
   */
  confirm(message) {
    return new Promise((resolve) => {
      this.onConfirm = () => {
        resolve(true);
        this.close();
      };

      this.onCancel = () => {
        resolve(false);
        this.close();
      };

      const content = this.element?.querySelector('.modal-content');
      if (content) {
        content.textContent = message;
      }

      this.open();
    });
  }

  /**
   * 初始化确认对话框
   */
  init() {
    if (this.confirmBtn) {
      this.confirmBtn.addEventListener('click', () => this.onConfirm());
    }

    if (this.cancelBtn) {
      this.cancelBtn.addEventListener('click', () => this.onCancel());
    }
  }
}
