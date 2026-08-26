/**
 * 下一课歌词 / 音频预加载
 * @module services/PrefetchService
 */

import { CacheManager } from '../managers/CacheManager.js';

function disposeAudio(audio) {
  if (!audio) return;
  try {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  } catch {
    // ignore
  }
}

export class PrefetchService {
  /**
   * @param {{maxLrc?: number, maxAudio?: number}} [options]
   */
  constructor(options = {}) {
    this.lrcCache = new CacheManager(options.maxLrc ?? 3);
    this.audioCache = new CacheManager(options.maxAudio ?? 3, disposeAudio);
  }

  /**
   * @param {string} url
   * @param {AbortSignal} [signal]
   * @returns {Promise<string>}
   */
  async loadLrc(url, signal) {
    const cached = this.lrcCache.get(url);
    if (cached !== undefined) return cached;

    const response = await fetch(url, { signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const text = await response.text();
    this.lrcCache.set(url, text);
    return text;
  }

  /**
   * @param {{lrc?: string, audio?: string}|null} unit
   */
  prefetch(unit) {
    if (!unit) return;

    if (unit.lrc && !this.lrcCache.has(unit.lrc)) {
      fetch(unit.lrc)
        .then((response) => (response.ok ? response.text() : Promise.reject()))
        .then((text) => this.lrcCache.set(unit.lrc, text))
        .catch(() => {});
    }

    if (unit.audio && !this.audioCache.has(unit.audio)) {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = unit.audio;
      this.audioCache.set(unit.audio, audio);
    }
  }

  clear() {
    this.lrcCache.clear();
    this.audioCache.clear();
  }
}
