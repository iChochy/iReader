/**
 * 明暗主题
 * @module ui/theme
 */

import { CONFIG } from '../config.js';
import { getStorage, setStorage } from '../utils/storage.js';

const THEME_COLORS = {
  light: '#f7f3ee',
  dark: '#0f1317',
};

export class ThemeManager {
  constructor(options = {}) {
    this.toggleBtn = options.toggleBtn || document.getElementById('themeToggle');
    this.prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    this.animationDuration = options.animationDuration || CONFIG.UI.THEME_ANIMATION_DURATION;
    this.currentTheme = this.#detectTheme();
  }

  init() {
    this.applyTheme(this.currentTheme);
    this.toggleBtn?.addEventListener('click', () => this.toggle());
    this.prefersDark.addEventListener('change', (event) => {
      if (getStorage(CONFIG.STORAGE_KEYS.THEME)) return;
      this.applyTheme(event.matches ? 'dark' : 'light');
    });
  }

  applyTheme(theme) {
    const isDark = theme === 'dark';
    document.body.classList.toggle('dark-theme', isDark);
    this.currentTheme = theme;
    this.#updateMetaThemeColor(isDark);
  }

  toggle() {
    const next = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(next);
    setStorage(CONFIG.STORAGE_KEYS.THEME, next);
    this.#playToggleAnimation();
  }

  getTheme() {
    return this.currentTheme;
  }

  #detectTheme() {
    const saved = getStorage(CONFIG.STORAGE_KEYS.THEME);
    if (saved === 'light' || saved === 'dark') return saved;
    return this.prefersDark.matches ? 'dark' : 'light';
  }

  #playToggleAnimation() {
    if (!this.toggleBtn) return;
    this.toggleBtn.style.transform = 'rotate(360deg)';
    setTimeout(() => {
      this.toggleBtn.style.transform = '';
    }, this.animationDuration);
  }

  #updateMetaThemeColor(isDark) {
    const color = isDark ? THEME_COLORS.dark : THEME_COLORS.light;
    let meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.insertBefore(meta, document.head.firstChild);
    }
    meta.content = color;
  }
}
