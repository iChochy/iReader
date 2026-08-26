/**
 * HTMLAudioElement 封装：播放、进度条、倍速、时长恢复
 * @module player/AudioController
 */

import { addClass, on, removeClass, setText, toggleClass } from '../utils/dom.js';
import { clamp, formatTime, throttle } from '../utils/helpers.js';

export class AudioController {
  /**
   * @param {Object} options
   * @param {HTMLAudioElement} options.audio
   * @param {HTMLElement} [options.playBtn]
   * @param {HTMLElement} [options.progressBar]
   * @param {HTMLElement} [options.currentTimeEl]
   * @param {HTMLElement} [options.durationEl]
   * @param {(currentTime: number, duration: number) => void} [options.onTick]
   * @param {(currentTime: number) => void} [options.onPersist]
   * @param {() => void} [options.onEnded]
   * @param {() => void} [options.onLoaded] 音频加载完成（元数据就绪）后触发
   */
  constructor(options) {
    this.audio = options.audio;
    this.playBtn = options.playBtn;
    this.progressBar = options.progressBar;
    this.currentTimeEl = options.currentTimeEl;
    this.durationEl = options.durationEl;
    this.onTick = options.onTick;
    this.onPersist = options.onPersist;
    this.onEnded = options.onEnded;
    this.onLoaded = options.onLoaded;

    this.dragging = false;
    this.pendingTime = 0;
    this.abort = new AbortController();

    this.#bind();
  }

  get currentTime() {
    return this.audio?.currentTime ?? 0;
  }

  get duration() {
    return this.audio?.duration ?? 0;
  }

  get paused() {
    return this.audio?.paused ?? true;
  }

  /**
   * @param {string} url
   * @param {{loop?: boolean, playbackRate?: number, startTime?: number}} [options]
   */
  setSrc(url, options = {}) {
    if (!this.audio) return;

    this.audio.pause();
    this.audio.src = url;
    this.audio.loop = Boolean(options.loop);
    this.audio.playbackRate = options.playbackRate ?? 1;
    this.pendingTime = Number.isFinite(options.startTime) ? options.startTime : 0;
    this.setDisabled(true);
    this.setProgress(0);
    this.audio.load();
  }

  setLoop(enabled) {
    if (this.audio) this.audio.loop = Boolean(enabled);
  }

  setRate(rate) {
    if (this.audio && Number.isFinite(rate)) {
      this.audio.playbackRate = rate;
    }
  }

  async play() {
    if (!this.audio) return;
    try {
      await this.audio.play();
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.warn('Audio play failed:', error);
      }
    }
  }

  pause() {
    this.audio?.pause();
  }

  toggle() {
    if (this.paused) {
      this.play();
    } else {
      this.pause();
    }
  }

  seek(time) {
    if (!this.audio || !Number.isFinite(time)) return;
    const duration = this.duration;
    const max = Number.isFinite(duration) && duration > 0 ? duration : time;
    this.audio.currentTime = clamp(time, 0, max);
    this.updateProgress(true);
  }

  reset() {
    if (!this.audio) return;
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.pendingTime = 0;
    this.setProgress(0);
    this.setDisabled(true);
    this.updatePlayButton();
    setText(this.currentTimeEl, '0:00');
    setText(this.durationEl, '0:00');
  }

  setDisabled(disabled) {
    if (!this.playBtn) return;
    this.playBtn.disabled = disabled;
    this.playBtn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  }

  updatePlayButton() {
    if (!this.playBtn) return;
    const playing = !this.paused;
    toggleClass(this.playBtn, 'playing', playing);
    this.playBtn.setAttribute('aria-label', playing ? '暂停' : '播放');
  }

  updateProgress(force = false) {
    if (!this.audio || (this.dragging && !force)) return;
    const duration = this.duration;
    const current = this.currentTime;
    const percent = duration > 0 ? (current / duration) * 100 : 0;
    this.setProgress(percent);
    setText(this.currentTimeEl, formatTime(current));
  }

  setProgress(percent) {
    this.progressBar?.style.setProperty('--progress', `${percent}%`);
  }

  destroy() {
    this.abort.abort();
    this.reset();
  }

  #bind() {
    const signal = this.abort.signal;

    if (this.playBtn) {
      on(this.playBtn, 'click', () => this.toggle(), { signal });
    }

    if (this.progressBar) {
      const seekByClientX = (clientX) => {
        if (!this.audio || !this.duration) return;
        const rect = this.progressBar.getBoundingClientRect();
        const percent = clamp((clientX - rect.left) / rect.width, 0, 1);
        this.seek(percent * this.duration);
      };

      on(this.progressBar, 'click', (event) => seekByClientX(event.clientX), { signal });

      on(this.progressBar, 'pointerdown', (event) => {
        this.dragging = true;
        addClass(this.progressBar, 'dragging');
        this.progressBar.setPointerCapture(event.pointerId);
        seekByClientX(event.clientX);
      }, { signal, passive: true });

      on(this.progressBar, 'pointermove', (event) => {
        if (!this.dragging) return;
        seekByClientX(event.clientX);
      }, { signal, passive: true });

      const endDrag = (event) => {
        if (!this.dragging) return;
        this.dragging = false;
        removeClass(this.progressBar, 'dragging');
        if (event?.pointerId != null) {
          try {
            this.progressBar.releasePointerCapture(event.pointerId);
          } catch {
            // already released
          }
        }
        this.onPersist?.(this.currentTime);
      };

      on(this.progressBar, 'pointerup', endDrag, { signal, passive: true });
      on(this.progressBar, 'pointercancel', endDrag, { signal, passive: true });
    }

    if (!this.audio) return;

    const tick = throttle(() => {
      this.updateProgress();
      this.onTick?.(this.currentTime, this.duration);
    }, 1000 / 30);

    on(this.audio, 'timeupdate', tick, { signal });
    on(this.audio, 'loadedmetadata', () => {
      this.#applyPendingTime();
      this.setDisabled(false);
      this.onLoaded?.();
    }, { signal });
    on(this.audio, 'canplay', () => this.setDisabled(false), { signal });
    on(this.audio, 'loadstart', () => this.setDisabled(true), { signal });
    on(this.audio, 'play', () => this.updatePlayButton(), { signal });
    on(this.audio, 'pause', () => {
      this.updatePlayButton();
      this.onPersist?.(this.currentTime);
    }, { signal });
    on(this.audio, 'ended', () => {
      this.updatePlayButton();
      this.onEnded?.();
    }, { signal });
    on(this.audio, 'error', () => this.setDisabled(true), { signal });
  }

  #applyPendingTime() {
    setText(this.durationEl, formatTime(this.duration));

    if (this.pendingTime > 0 && this.duration > 0) {
      const target = Math.min(this.pendingTime, Math.max(0, this.duration - 0.05));
      if (Number.isFinite(target)) {
        this.audio.currentTime = target;
      }
      this.pendingTime = 0;
    }

    this.updateProgress();
  }
}
