/**
 * 主题切换模块
 * 管理应用的深色/浅色主题切换
 * 
 * @module ui/theme
 */

import { CONFIG } from '../config.js';
import { getStorage, setStorage } from '../utils/storage.js';

/**
 * 主题管理器
 */
export class ThemeManager {
  /**
   * 构造函数
   * @param {Object} [options={}] - 配置选项
   */
  constructor(options = {}) {
    this.toggleBtn = options.toggleBtn || document.getElementById('themeToggle');
    this.prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    this.animationDuration = options.animationDuration || CONFIG.UI.THEME_ANIMATION_DURATION;
    this.currentTheme = this.detectTheme();
  }

  /**
   * 初始化主题
   */
  init() {
    this.applyTheme(this.currentTheme);
    this.bindToggleButton();
    this.listenSystemThemeChange();
  }

  /**
   * 检测当前应该应用的主题
   * 优先级: 已保存的主题 > 系统偏好 > 默认浅色
   * @private
   * @returns {string} 'light' | 'dark'
   */
  detectTheme() {
    const saved = getStorage(CONFIG.STORAGE_KEYS.THEME);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    return this.prefersDark.matches ? 'dark' : 'light';
  }

  /**
   * 应用主题
   * @param {string} theme - 主题名 ('light' | 'dark')
   */
  applyTheme(theme) {
    const isDark = theme === 'dark';
    document.body.classList.toggle('dark-theme', isDark);
    this.currentTheme = theme;

    // 同时更新 meta theme-color
    this.updateMetaThemeColor(isDark);
  }

  /**
   * 切换主题
   */
  toggle() {
    const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(newTheme);
    setStorage(CONFIG.STORAGE_KEYS.THEME, newTheme);
    this.playToggleAnimation();
  }

  /**
   * 播放切换动画
   * @private
   */
  playToggleAnimation() {
    if (!this.toggleBtn) return;

    this.toggleBtn.style.transform = 'rotate(360deg)';
    setTimeout(() => {
      this.toggleBtn.style.transform = '';
    }, this.animationDuration);
  }

  /**
   * 获取当前主题
   * @returns {string}
   */
  getTheme() {
    return this.currentTheme;
  }

  /**
   * 设置为深色主题
   */
  setDark() {
    this.applyTheme('dark');
    setStorage(CONFIG.STORAGE_KEYS.THEME, 'dark');
  }

  /**
   * 设置为浅色主题
   */
  setLight() {
    this.applyTheme('light');
    setStorage(CONFIG.STORAGE_KEYS.THEME, 'light');
  }

  /**
   * 绑定主题切换按钮
   * @private
   */
  bindToggleButton() {
    if (!this.toggleBtn) return;

    this.toggleBtn.addEventListener('click', () => {
      this.toggle();
    });
  }

  /**
   * 监听系统主题变化
   * 仅在用户未手动设置主题时生效
   * @private
   */
  listenSystemThemeChange() {
    this.prefersDark.addEventListener('change', (e) => {
      const saved = getStorage(CONFIG.STORAGE_KEYS.THEME);
      if (!saved) {
        this.applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  /**
   * 更新 meta theme-color 标签
   * @private
   * @param {boolean} isDark - 是否为深色主题
   */
  updateMetaThemeColor(isDark) {
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.name = 'theme-color';
      document.head.appendChild(metaTheme);
    }

    // 这些颜色值应该与 CSS 中的 --paper-1 保持一致
    const color = isDark ? '#0f1317' : '#f7f3ee';
    metaTheme.content = color;
  }

  /**
   * 注册自定义主题
   * @param {string} themeName - 主题名
   * @param {Object} colors - 颜色配置
   */
  registerTheme(themeName, colors) {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(colors)) {
      root.style.setProperty(`--${key}`, value);
    }
  }
}
