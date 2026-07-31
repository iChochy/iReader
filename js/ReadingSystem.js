/**
 * 英语点读阅读系统 - 核心模块
 * 管理课本加载、单元切换、歌词展示、音频播放等核心功能
 * 
 * @module ReadingSystem
 */

import { CONFIG, createInitialState, createDOMReferences } from './config.js';
import { qs, qsa, addClass, removeClass, toggleClass, setText, setHTML, on, delegate } from './utils/dom.js';
import { clamp, formatTime, throttle, debounce, mergeObjects } from './utils/helpers.js';
import { getStorage, setStorage, getPlayTime, savePlayTime, getCurrentUnitIndex, saveCurrentUnitIndex } from './utils/storage.js';
import { LRCParser } from './LRCParser.js';
import { CacheManager, ResourceLoader } from './managers/CacheManager.js';
import { EventManager } from './managers/EventManager.js';

/**
 * 核心阅读系统类
 * 管理课本、单元、歌词、音频播放、用户偏好等
 */
export class ReadingSystem {
  /**
   * 构造函数
   * @param {Object} [config={}] - 配置选项
   */
  constructor(config = {}) {
    // 初始化状态
    this.state = createInitialState();

    // 初始化 DOM 引用
    this.dom = createDOMReferences();

    // 合并配置
    this.config = mergeObjects(CONFIG, config);

    // 初始化管理器
    this.lrcCache = new CacheManager(this.config.PLAYER.MAX_LRC_CACHE);
    this.audioPreload = new CacheManager(this.config.PLAYER.MAX_AUDIO_CACHE);
    this.resourceLoader = new ResourceLoader();
    this.eventManager = new EventManager();

    // 歌词行 DOM 元素缓存
    this.lyricLineEls = [];

    // 事件绑定标记，防止重复绑定
    this.bindingFlags = {
      unitSelect: false,
      unitList: false,
      bookSelects: false,
      lyrics: false,
      playerControls: false,
      navigation: false,
      translationToggle: false,
    };

    // 启动初始化
    this.init();
  }

  // =========================================================================
  // 初始化流程
  // =========================================================================

  /**
   * 初始化系统
   * @returns {Promise<void>}
   */
  async init() {
    try {
      await this.loadBooks();
      await this.applyBookFromHash();
      this.bindAllEvents();
      this.loadLoopPlaybackPreference();
      this.updateLoopPlaybackUI();
      this.loadTranslationPreference();
      this.updateTranslationToggle();
      await this.loadUnitFromStorage();
    } catch (error) {
      console.error('Failed to initialize ReadingSystem:', error);
      this.renderEmptyState(this.config.ERROR_MESSAGES.LOAD_BOOKS);
    }
  }

  // =========================================================================
  // 课本管理
  // =========================================================================

  /**
   * 从 data.json 加载所有可用的课本数据
   * @returns {Promise<Array>} 课本数据列表
   */
  async loadBooks() {
    if (this.state.books.length) return this.state.books;

    try {
      const response = await fetch('data.json');
      const data = await response.json();
      this.state.books = Array.isArray(data.books) ? data.books : [];
      return this.state.books;
    } catch (error) {
      console.error(this.config.ERROR_MESSAGES.LOAD_BOOKS, error);
      this.state.books = [];
      return [];
    }
  }

  /**
   * 根据 key 查找课本
   * @param {string} bookKey - 课本标识 key
   * @returns {Object|null} 匹配的课本对象
   */
  resolveBookByKey(bookKey) {
    if (!this.state.books.length) return null;

    const exact = this.state.books.find((book) => book?.key === bookKey);
    if (exact?.bookPath) return exact;

    const fallback = this.state.books.find((book) => book?.key === this.config.DEFAULT_BOOK_KEY);
    if (fallback?.bookPath) return fallback;

    return this.state.books.find((book) => book?.bookPath) || null;
  }

  /**
   * 从 URL hash 应用课本
   * @returns {Promise<void>}
   */
  async applyBookFromHash() {
    const keyFromHash = location.hash.slice(1).trim();
    const storedBookKey = getStorage(this.config.STORAGE_KEYS.BOOK_SELECTION);
    const initialBookKey = keyFromHash || storedBookKey || this.config.DEFAULT_BOOK_KEY;
    await this.applyBookChange(initialBookKey);
  }

  /**
   * 应用课本切换
   * @param {string} bookKey - 目标课本 key
   * @returns {Promise<void>}
   */
  async applyBookChange(bookKey) {
    await this.loadBooks();

    const resolved = this.resolveBookByKey(bookKey);
    if (!resolved?.bookPath) {
      this.state.bookPath = '';
      this.state.bookKey = '';
      this.renderEmptyState(this.config.ERROR_MESSAGES.NO_DATA);
      return;
    }

    this.state.bookKey = resolved.key || bookKey;
    this.state.bookPath = resolved.bookPath.trim();
    setStorage(this.config.STORAGE_KEYS.BOOK_SELECTION, this.state.bookKey);

    this.updateBookSelects();
    await this.loadBookConfig();
    this.renderUnitList();
    this.renderUnitSelect();
    this.resetUnitListScroll();
  }

  /**
   * 加载课本配置（book.json）
   * @returns {Promise<void>}
   */
  async loadBookConfig() {
    if (!this.state.bookPath) {
      this.renderEmptyState(this.config.ERROR_MESSAGES.NO_DATA);
      return;
    }

    try {
      const response = await fetch(`${this.state.bookPath}/book.json`);
      const data = await response.json();

      this.state.units = data.units.map((unit, index) => ({
        ...unit,
        id: index + 1,
        title: unit.title,
        audio: `${this.state.bookPath}/${unit.filename}.mp3`,
        lrc: `${this.state.bookPath}/${unit.filename}.lrc`,
      }));

      if (this.dom.bookCover && data.bookCover) {
        this.dom.bookCover.src = `${this.state.bookPath}/${data.bookCover}`;
      }

      // 清除缓存
      this.lrcCache.clear();
      this.audioPreload.clear();
    } catch (error) {
      console.error(this.config.ERROR_MESSAGES.LOAD_CONFIG, error);
      this.renderEmptyState(
        `${this.config.ERROR_MESSAGES.LOAD_CONFIG}: ${this.state.bookPath}/book.json`
      );
    }
  }

  /**
   * 更新所有课本选择器
   */
  updateBookSelects() {
    if (!this.dom.bookSelects.length || !this.state.books.length) return;

    const options = this.state.books
      .filter((book) => book?.key && book?.title && book?.bookPath)
      .map((book) => `<option value="${book.key}">${book.title}</option>`)
      .join('');

    this.dom.bookSelects.forEach((select) => {
      setHTML(select, options);
      if (this.state.bookKey) {
        select.value = this.state.bookKey;
      }
    });
  }

  /**
   * 渲染空状态提示
   * @param {string} message - 提示信息
   */
  renderEmptyState(message) {
    if (this.dom.lyricsDisplay) {
      setHTML(this.dom.lyricsDisplay, `<p class="placeholder">${message}</p>`);
    }
    if (this.dom.unitList) {
      setHTML(this.dom.unitList, '');
    }
    this.resetUnitListScroll();
  }

  /**
   * 重置单元列表滚动位置
   */
  resetUnitListScroll() {
    const scrollContainer = this.dom.unitList?.closest('.unit-list');
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
    }
  }

  // =========================================================================
  // 单元管理
  // =========================================================================

  /**
   * 渲染单元列表（左侧边栏）
   */
  renderUnitList() {
    if (!this.dom.unitList) return;

    const html = this.state.units
      .map(
        (unit, index) =>
          `<div class="unit-item" data-unit-index="${index}" tabindex="0" role="button" aria-label="打开 ${unit.title}">
            <h3>${unit.title}</h3>
          </div>`
      )
      .join('');

    setHTML(this.dom.unitList, html);
  }

  /**
   * 渲染单元下拉选择器
   */
  renderUnitSelect() {
    if (!this.dom.unitSelect) return;

    const options = this.state.units
      .map((unit, index) => `<option value="${index}">${unit.title}</option>`)
      .join('');

    setHTML(this.dom.unitSelect, options);
  }

  /**
   * 从 localStorage 恢复上次学习的单元
   * @returns {Promise<void>}
   */
  async loadUnitFromStorage() {
    if (!this.state.units.length) return;

    const unitIndex = getCurrentUnitIndex(this.state.bookPath);
    const safeIndex = clamp(unitIndex, 0, this.state.units.length - 1);
    await this.loadUnitByIndex(safeIndex, { shouldScrollUnitIntoView: true });
  }

  /**
   * 根据索引加载指定单元
   * @param {number} unitIndex - 单元索引
   * @param {Object} [options={}] - 选项
   * @returns {Promise<void>}
   */
  async loadUnitByIndex(unitIndex, options = {}) {
    const { shouldScrollUnitIntoView = false } = options;

    this.state.currentUnitIndex = unitIndex;
    saveCurrentUnitIndex(this.state.bookPath, unitIndex);

    const unit = this.state.units[unitIndex];
    if (!unit) return;

    this.resetPlayer();
    this.updateActiveUnit(unitIndex, { shouldScrollUnitIntoView });
    this.updateNavigationButtons();

    // 加载歌词
    try {
      let lrcText = this.lrcCache.get(unit.lrc);
      if (!lrcText) {
        const response = await fetch(unit.lrc);
        lrcText = await response.text();
        this.lrcCache.set(unit.lrc, lrcText);
      }

      this.state.currentLyrics = LRCParser.parse(
        lrcText,
        this.config.PLAYER.TIME_OFFSET
      );
      this.renderLyrics();
    } catch (error) {
      console.error(this.config.ERROR_MESSAGES.LOAD_LYRIC, error);
      if (this.dom.lyricsDisplay) {
        setHTML(this.dom.lyricsDisplay, `<p class="placeholder">${this.config.ERROR_MESSAGES.LOAD_FAILED}</p>`);
      }
    }

    // 设置音频源
    if (this.dom.audioPlayer) {
      this.setPlayButtonDisabled(true);
      this.dom.audioPlayer.src = unit.audio;
      this.dom.audioPlayer.loop = this.state.loopMode === 'list';
      this.dom.audioPlayer.load();
    }

    // 恢复播放进度和速度
    this.loadPlayTime();
    this.loadSavedSpeed();

    // 预加载下一个单元
    this.prefetchUnit(unitIndex + 1);
  }

  /**
   * 重置播放器
   */
  resetPlayer() {
    this.state.currentLyricIndex = -1;
    this.state.sentenceLoopIndex = -1;

    if (this.dom.audioPlayer) {
      this.dom.audioPlayer.pause();
      this.dom.audioPlayer.currentTime = 0;
    }

    this.setPlayButtonDisabled(true);
    if (this.dom.progressBar) {
      this.dom.progressBar.style.setProperty('--progress', '0%');
    }
    if (this.dom.currentTime) setText(this.dom.currentTime, '0:00');
    if (this.dom.duration) setText(this.dom.duration, '0:00');

    this.updatePlayButton();
    this.state.currentLyricIndex = -1;
  }

  /**
   * 更新活跃单元
   * @param {number} unitIndex - 单元索引
   * @param {Object} [options={}] - 选项
   */
  updateActiveUnit(unitIndex, options = {}) {
    const { shouldScrollUnitIntoView = false } = options;

    if (this.dom.unitList) {
      qsa('.unit-item', this.dom.unitList).forEach((item, index) => {
        toggleClass(item, 'active', index === unitIndex);
      });

      const activeItem = qs(`.unit-item[data-unit-index="${unitIndex}"]`, this.dom.unitList);
      if (activeItem && shouldScrollUnitIntoView) {
        activeItem.scrollIntoView({ block: 'center', inline: 'nearest' });
      }
    }

    if (this.dom.unitSelect) {
      this.dom.unitSelect.value = unitIndex;
    }
  }

  // =========================================================================
  // 歌词管理
  // =========================================================================

  /**
   * 渲染歌词列表
   */
  renderLyrics() {
    if (!this.dom.lyricsDisplay) return;

    if (this.dom.lyricsContainer) {
      this.dom.lyricsContainer.scrollTop = 0;
    }

    if (!this.state.currentLyrics.length) {
      setHTML(this.dom.lyricsDisplay, '<p class="placeholder">没有歌词数据</p>');
      return;
    }

    const html = this.state.currentLyrics
      .map(
        (lyric, index) =>
          `<div class="lyric-line" data-index="${index}" data-time="${lyric.time}" tabindex="0" role="button" aria-label="播放第 ${index + 1} 句">
            <div class="lyric-text">${lyric.english}</div>
            ${lyric.chinese ? `<div class="lyric-translation">${lyric.chinese}</div>` : ''}
          </div>`
      )
      .join('');

    setHTML(this.dom.lyricsDisplay, html);
    this.lyricLineEls = qsa('.lyric-line', this.dom.lyricsDisplay);
    this.state.currentLyricIndex = -1;
  }

  /**
   * 处理歌词行激活
   * @param {HTMLElement} line - 歌词行元素
   */
  handleLyricActivate(line) {
    // 确保元素拥有必需的数据属性
    if (!line || !line.dataset || line.dataset.index === undefined || line.dataset.time === undefined) {
      console.warn('Invalid lyric element: missing required data attributes', { element: line });
      return;
    }
    
    const index = parseInt(line.dataset.index, 10);
    const time = parseFloat(line.dataset.time);
    
    // 验证解析结果
    if (!Number.isFinite(index) || !Number.isFinite(time)) {
      console.warn('Invalid lyric data:', { index, time, element: line, dataIndex: line.dataset.index, dataTime: line.dataset.time });
      return;
    }
    
    this.playLyricAtIndex(index, time);
    this.persistPlayTime(time);

    // 单句循环 / 点句点读模式：锁定到点击的句子
    if (this.state.loopMode === 'sentence' || this.state.loopMode === 'click') {
      this.state.sentenceLoopIndex = index;
    }
  }

  /**
   * 从指定时间播放
   * @param {number} index - 歌词索引
   * @param {number} time - 播放时间
   */
  playLyricAtIndex(index, time) {
    if (!this.dom.audioPlayer) return;
    
    // 验证时间值是否为有效的有限数值
    if (!Number.isFinite(time)) {
      console.warn('Invalid time value for playback:', time);
      return;
    }
    
    this.dom.audioPlayer.currentTime = time;
    this.dom.audioPlayer.play();
  }

  /**
   * 保存播放进度
   * @param {number} time - 播放时间
   */
  persistPlayTime(time) {
    savePlayTime(this.state.bookPath, this.state.currentUnitIndex, time);
  }


  // =========================================================================
  // 单句循环和点句点读
  // =========================================================================

  /**
   * 处理单句循环和点句点读模式
   */
  handleSentence() {
    if (
      this.state.loopMode == 'list' ||
      !this.dom.audioPlayer ||
      this.state.sentenceLoopIndex === -1
    ) {
      return;
    }

    const duration = this.dom.audioPlayer.duration;
    const currentLyrics = this.state.currentLyrics;
    const sentenceLoopIndex = this.state.sentenceLoopIndex;

    const boundaries = LRCParser.getSentenceBoundaries(currentLyrics, sentenceLoopIndex, duration);
    if (!boundaries) return;

    const currentTime = this.dom.audioPlayer.currentTime;
    if (currentTime >= boundaries.endTime) {
      if (Number.isFinite(boundaries.startTime)) {
        if (this.state.loopMode === 'click') {
          // 点句点读：播完一句即停
          this.dom.audioPlayer.pause();
          this.dom.audioPlayer.currentTime = boundaries.startTime;
        } else if (this.state.loopMode === 'sentence') {
          // 单句循环：跳回句首继续
          this.dom.audioPlayer.currentTime = boundaries.startTime;
        }
      }
    }
  }

  /**
   * 更新歌词高亮
   */
  updateLyricHighlight() {
    if (!this.lyricLineEls.length || !this.dom.audioPlayer) {
      return;
    }
    const currentTime = this.dom.audioPlayer.currentTime;
    let newIndex = -1;

    for (let i = this.state.currentLyrics.length - 1; i >= 0; i--) {
      if (currentTime >= this.state.currentLyrics[i].time) {
        newIndex = i;
        break;
      }
    }

    if (newIndex === this.state.currentLyricIndex) return;

    // 移除旧高亮
    if (this.state.currentLyricIndex >= 0) {
      const currentLine = this.lyricLineEls[this.state.currentLyricIndex]
      if (currentLine) {
        removeClass(currentLine, 'active');
        removeClass(currentLine, 'pulse');
      }
    }

    // 应用新高亮
    if (newIndex >= 0) {
      const activeLine = this.lyricLineEls[newIndex];
      if (activeLine) {
        addClass(activeLine, 'active');
        addClass(activeLine, 'pulse');
        if (this.shouldScrollLyricIntoView(activeLine)) {
          activeLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
    this.state.currentLyricIndex = newIndex;
  }

  /**
   * 判断歌词是否需要滚动到可视区域
   * @param {HTMLElement} activeLine - 活跃的歌词行
   * @returns {boolean}
   */
  shouldScrollLyricIntoView(activeLine) {
    if (!this.dom.lyricsContainer) return true;

    const containerRect = this.dom.lyricsContainer.getBoundingClientRect();
    const lineRect = activeLine.getBoundingClientRect();
    const topThreshold = containerRect.top + containerRect.height * this.config.UI.LYRIC_SCROLL_THRESHOLD;
    const bottomThreshold = containerRect.bottom - containerRect.height * this.config.UI.LYRIC_SCROLL_THRESHOLD;

    return lineRect.top < topThreshold || lineRect.bottom > bottomThreshold;
  }

  // =========================================================================
  // 音频播放控制
  // =========================================================================

  /**
   * 更新进度条
   */
  updateProgress() {
    if (!this.dom.progressBar || !this.dom.audioPlayer) return;

    if (this.dom.audioPlayer.duration && !this.state.isProgressDragging) {
      const percent = (this.dom.audioPlayer.currentTime / this.dom.audioPlayer.duration) * 100;
      this.dom.progressBar.style.setProperty('--progress', `${percent}%`);
      if (this.dom.currentTime) {
        setText(this.dom.currentTime, formatTime(this.dom.audioPlayer.currentTime));
      }
    }
  }

  /**
   * 更新音频时长
   */
  updateDuration() {
    if (!this.dom.audioPlayer) return;

    if (this.dom.duration) {
      setText(this.dom.duration, formatTime(this.dom.audioPlayer.duration));
    }

    if (
      Number.isFinite(this.state.savedPlayTime) &&
      this.state.savedPlayTime > 0 &&
      this.dom.audioPlayer.duration
    ) {
      const targetTime = Math.min(
        this.state.savedPlayTime,
        this.dom.audioPlayer.duration - 0.1
      );
      
      if (Number.isFinite(targetTime)) {
        this.dom.audioPlayer.currentTime = targetTime;
      }
      
      this.state.savedPlayTime = 0;
      this.updateProgress();
    }
  }

  /**
   * 更新播放按钮状态
   */
  updatePlayButton() {
    if (!this.dom.playPauseBtn || !this.dom.audioPlayer) return;

    toggleClass(
      this.dom.playPauseBtn,
      'playing',
      !this.dom.audioPlayer.paused
    );
  }

  /**
   * 设置播放按钮禁用状态
   * @param {boolean} disabled - 是否禁用
   */
  setPlayButtonDisabled(disabled) {
    if (!this.dom.playPauseBtn) return;

    this.dom.playPauseBtn.disabled = disabled;
    this.dom.playPauseBtn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  }

  /**
   * 切换播放速度
   */
  cyclePlaybackSpeed() {
    const currentIndex = this.state.availableSpeeds.indexOf(this.state.playbackRate);
    const nextIndex = (currentIndex + 1) % this.state.availableSpeeds.length;
    this.state.playbackRate = this.state.availableSpeeds[nextIndex];

    if (this.dom.audioPlayer) {
      this.dom.audioPlayer.playbackRate = this.state.playbackRate;
    }

    this.updateSpeedButton();
    setStorage(this.config.STORAGE_KEYS.PLAYBACK_RATE, this.state.playbackRate);
  }

  /**
   * 更新倍速按钮显示
   */
  updateSpeedButton() {
    if (!this.dom.speedText || !this.dom.speedBtn) return;

    setText(this.dom.speedText, `${this.state.playbackRate}x`);
    toggleClass(this.dom.speedBtn, 'active', this.state.playbackRate !== 1.0);
  }

  /**
   * 加载播放进度
   */
  loadPlayTime() {
    const time = getPlayTime(this.state.bookPath, this.state.currentUnitIndex);
    if (time > 0) {
      this.state.savedPlayTime = time;
    }
  }

  /**
   * 加载保存的播放速度
   */
  loadSavedSpeed() {
    const savedSpeed = getStorage(this.config.STORAGE_KEYS.PLAYBACK_RATE);
    if (savedSpeed) {
      const parsed = parseFloat(savedSpeed);
      if (Number.isFinite(parsed)) {
        this.state.playbackRate = parsed;
        if (this.dom.audioPlayer) {
          this.dom.audioPlayer.playbackRate = this.state.playbackRate;
        }
        this.updateSpeedButton();
      }
    }
  }

  // =========================================================================
  // 导航控制
  // =========================================================================

  /**
   * 更新导航按钮状态
   */
  updateNavigationButtons() {
    if (this.dom.prevUnitBtn) {
      this.dom.prevUnitBtn.disabled = this.state.currentUnitIndex <= 0;
    }

    if (this.dom.nextUnitBtn) {
      this.dom.nextUnitBtn.disabled =
        this.state.currentUnitIndex >= this.state.units.length - 1;
    }
  }

  /**
   * 加载上一个单元
   */
  loadPreviousUnit() {
    if (this.state.currentUnitIndex > 0) {
      this.loadUnitByIndex(this.state.currentUnitIndex - 1);
    }
  }

  /**
   * 加载下一个单元
   */
  loadNextUnit() {
    if (this.state.currentUnitIndex < this.state.units.length - 1) {
      this.loadUnitByIndex(this.state.currentUnitIndex + 1);
    }
  }

  /**
   * 切换循环播放模式
   */
  toggleLoopPlayback() {
    const modes = this.config.LOOP_MODES;
    const currentIndex = modes.indexOf(this.state.loopMode);
    const prevMode = this.state.loopMode;
    const nextMode = modes[(currentIndex + 1) % modes.length];

    this.state.loopMode = nextMode;

    // 进入单句循环或点句点读模式：锁定当前歌词索引
    if ((nextMode === 'sentence' || nextMode === 'click') && this.state.currentLyricIndex >= 0) {
      this.state.sentenceLoopIndex = this.state.currentLyricIndex;
    }
    // 切换到列表循环：清除单句锁定
    if (nextMode === 'list') {
      this.state.sentenceLoopIndex = -1;
    }

    setStorage(this.config.STORAGE_KEYS.LOOP_MODE, this.state.loopMode);
    this.syncLoopPlayback();
    this.updateLoopPlaybackUI();
  }

  /**
   * 加载循环播放偏好
   */
  loadLoopPlaybackPreference() {
    const stored = getStorage(this.config.STORAGE_KEYS.LOOP_MODE);
    if (stored && this.config.LOOP_MODES.includes(stored)) {
      this.state.loopMode = stored;
    } else {
      // 兼容旧版本
      const oldVal = getStorage('loopPlaybackEnabled');
      this.state.loopMode = oldVal === 'true' ? 'list' : 'off';
    }
    this.syncLoopPlayback();
  }

  /**
   * 同步循环播放状态
   */
  syncLoopPlayback() {
    if (!this.dom.audioPlayer) return;
    this.dom.audioPlayer.loop = this.state.loopMode === 'list';
  }

  /**
   * 更新循环播放 UI
   */
  updateLoopPlaybackUI() {
    if (!this.dom.loopToggleBtn) return;

    const mode = this.state.loopMode;
    const isClick = mode === 'click';
    const isList = mode === 'list';
    const isSentence = mode === 'sentence';
    const isActive = isList || isSentence || isClick;

    this.dom.loopToggleBtn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    toggleClass(this.dom.loopToggleBtn, 'active', isList);
    toggleClass(this.dom.loopToggleBtn, 'sentence', isSentence);
    toggleClass(this.dom.loopToggleBtn, 'click', isClick);

    let title = '点句点读';
    let label = '点句点读';

    if (isClick) {
      title = '关闭点句点读';
      label = '关闭点句点读';
    } else if (isList) {
      title = '关闭循环播放';
      label = '关闭循环播放';
    } else if (isSentence) {
      title = '关闭单句循环';
      label = '关闭单句循环';
    }

    this.dom.loopToggleBtn.title = title;
    this.dom.loopToggleBtn.setAttribute('aria-label', label);
  }

  // =========================================================================
  // 翻译显示控制
  // =========================================================================

  /**
   * 切换翻译显示模式
   */
  toggleTranslationMode() {
    const currentIndex = this.config.TRANSLATION_MODES.indexOf(this.state.translationMode);
    const nextIndex =
      currentIndex === -1 ? 0 : (currentIndex + 1) % this.config.TRANSLATION_MODES.length;
    this.state.translationMode = this.config.TRANSLATION_MODES[nextIndex];
    setStorage(this.config.STORAGE_KEYS.TRANSLATION_MODE, this.state.translationMode);
    this.updateTranslationToggle();
  }

  /**
   * 加载翻译显示偏好
   */
  loadTranslationPreference() {
    const storedMode = getStorage(this.config.STORAGE_KEYS.TRANSLATION_MODE);
    if (this.config.TRANSLATION_MODES.includes(storedMode)) {
      this.state.translationMode = storedMode;
    }
  }

  /**
   * 更新翻译切换 UI
   */
  updateTranslationToggle() {
    if (!this.dom.toggleTranslationBtn) return;

    const mode = this.state.translationMode;
    toggleClass(document.body, 'english-translation', mode === 'english');
    toggleClass(document.body, 'blur-translation', mode === 'blur');
    toggleClass(document.body, 'chinese-translation', mode === 'chinese');

    let text = '双';
    let pressed = 'true';
    let label = '显示双语';

    if (mode === 'blur') {
      text = '糊';
      pressed = 'mixed';
      label = '模糊翻译';
    } else if (mode === 'english') {
      text = '英';
      pressed = 'false';
      label = '仅显示英文';
    } else if (mode === 'chinese') {
      text = '中';
      pressed = 'true';
      label = '仅显示中文';
    }

    setText(this.dom.toggleTranslationBtn, text);
    this.dom.toggleTranslationBtn.setAttribute('aria-pressed', pressed);
    this.dom.toggleTranslationBtn.setAttribute('aria-label', label);
  }

  // =========================================================================
  // 资源预加载
  // =========================================================================

  /**
   * 预加载单元资源
   * @param {number} unitIndex - 单元索引
   */
  prefetchUnit(unitIndex) {
    const unit = this.state.units[unitIndex];
    if (!unit) return;

    // 预加载 LRC
    if (unit.lrc && !this.lrcCache.has(unit.lrc)) {
      fetch(unit.lrc)
        .then((response) => response.text())
        .then((text) => this.lrcCache.set(unit.lrc, text))
        .catch(() => {});
    }

    // 预加载音频
    if (unit.audio && !this.audioPreload.has(unit.audio)) {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = unit.audio;
      this.audioPreload.set(unit.audio, audio);
    }
  }

  // =========================================================================
  // 事件绑定
  // =========================================================================

  /**
   * 绑定所有事件
   */
  bindAllEvents() {
    this.bindBookSelects();
    this.bindUnitList();
    this.bindUnitSelect();
    this.bindLyrics();
    this.bindPlayerControls();
    this.bindNavigation();
    this.bindTranslationToggle();
    this.bindWindowEvents();
  }

  /**
   * 绑定课本选择事件
   */
  bindBookSelects() {
    if (this.bindingFlags.bookSelects || !this.dom.bookSelects.length) return;
    this.bindingFlags.bookSelects = true;

    this.dom.bookSelects.forEach((select) => {
      on(select, 'change', (event) => {
        if (!event.target.value) return;
        if (location.hash.slice(1) === event.target.value) return;
        location.hash = event.target.value;
      });
    });
  }

  /**
   * 绑定单元列表事件
   */
  bindUnitList() {
    if (this.bindingFlags.unitList || !this.dom.unitList) return;
    this.bindingFlags.unitList = true;

    delegate(this.dom.unitList, 'click', '.unit-item', (event) => {
      // event.currentTarget 指向绑定事件的父容器，使用 event.target.closest 获取实际的单元项
      const unitItem = event.target.closest('.unit-item');
      if (!unitItem) return;
      const unitIndex = parseInt(unitItem.dataset.unitIndex);
      this.loadUnitByIndex(unitIndex);
    });

    delegate(this.dom.unitList, 'keydown', '.unit-item', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      // event.currentTarget 指向绑定事件的父容器，使用 event.target.closest 获取实际的单元项
      const unitItem = event.target.closest('.unit-item');
      if (!unitItem) return;
      const unitIndex = parseInt(unitItem.dataset.unitIndex);
      this.loadUnitByIndex(unitIndex);
    });
  }

  /**
   * 绑定单元选择器事件
   */
  bindUnitSelect() {
    if (this.bindingFlags.unitSelect || !this.dom.unitSelect) return;
    this.bindingFlags.unitSelect = true;

    on(this.dom.unitSelect, 'change', (event) => {
      const unitIndex = parseInt(event.target.value);
      if (unitIndex >= 0) {
        this.loadUnitByIndex(unitIndex);
      }
    });
  }

  /**
   * 绑定歌词事件
   */
  bindLyrics() {
    if (this.bindingFlags.lyrics || !this.dom.lyricsDisplay) return;
    this.bindingFlags.lyrics = true;

    delegate(this.dom.lyricsDisplay, 'click', '.lyric-line', (event) => {
      // 使用 event.target.closest 获取实际的歌词行元素
      // event.currentTarget 指向绑定事件的父容器，而非被点击的 .lyric-line
      const lyricLine = event.target.closest('.lyric-line');
      if (lyricLine) {
        this.handleLyricActivate(lyricLine);
      }
    });

    delegate(this.dom.lyricsDisplay, 'keydown', '.lyric-line', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();

      // 使用 event.target.closest 获取实际的歌词行元素
      const lyricLine = event.target.closest('.lyric-line');
      if (lyricLine) {
        this.handleLyricActivate(lyricLine);
      }
    });
  }

  /**
   * 绑定播放器控制事件
   */
  bindPlayerControls() {
    if (
      this.bindingFlags.playerControls ||
      !this.dom.playPauseBtn ||
      !this.dom.speedBtn ||
      !this.dom.progressBar ||
      !this.dom.audioPlayer ||
      !this.dom.loopToggleBtn
    ) {
      return;
    }
    this.bindingFlags.playerControls = true;

    // 播放/暂停
    on(this.dom.playPauseBtn, 'click', () => {
      if (this.dom.audioPlayer.paused) {
        this.dom.audioPlayer.play();
      } else {
        this.dom.audioPlayer.pause();
      }
    });

    // 倍速
    on(this.dom.speedBtn, 'click', () => {
      this.cyclePlaybackSpeed();
    });

    // 循环
    on(this.dom.loopToggleBtn, 'click', () => {
      this.toggleLoopPlayback();
    });

    // 进度条
    const seekByClientX = (clientX) => {
      if (!this.dom.audioPlayer.duration) return;
      const rect = this.dom.progressBar.getBoundingClientRect();
      const percent = clamp((clientX - rect.left) / rect.width, 0, 1);
      this.dom.audioPlayer.currentTime = percent * this.dom.audioPlayer.duration;
    };

    on(this.dom.progressBar, 'click', (event) => {
      seekByClientX(event.clientX);
    });

    on(
      this.dom.progressBar,
      'pointerdown',
      (event) => {
        this.state.isProgressDragging = true;
        addClass(this.dom.progressBar, 'dragging');
        this.dom.progressBar.setPointerCapture(event.pointerId);
        seekByClientX(event.clientX);
      },
      { passive: true }
    );

    on(
      this.dom.progressBar,
      'pointermove',
      (event) => {
        if (!this.state.isProgressDragging) return;
        seekByClientX(event.clientX);
      },
      { passive: true }
    );

    const endDrag = () => {
      this.state.isProgressDragging = false;
      removeClass(this.dom.progressBar, 'dragging');
    };

    on(
      this.dom.progressBar,
      'pointerup',
      (event) => {
        endDrag();
        this.dom.progressBar.releasePointerCapture(event.pointerId);
      },
      { passive: true }
    );

    on(this.dom.progressBar, 'pointercancel', endDrag);
    on(this.dom.progressBar, 'pointerleave', endDrag);

    // Audio 事件
    const updateLyric = throttle(() => {
      this.handleSentence();
      this.updateLyricHighlight();
      this.updateProgress();
    }, 1000/30);

    on(this.dom.audioPlayer, 'timeupdate', updateLyric);
    on(this.dom.audioPlayer, 'loadedmetadata', () => this.updateDuration());
    on(this.dom.audioPlayer, 'canplay', () => this.setPlayButtonDisabled(false));
    on(this.dom.audioPlayer, 'loadstart', () => this.setPlayButtonDisabled(true));
    on(this.dom.audioPlayer, 'ended', () => this.updatePlayButton());
    on(this.dom.audioPlayer, 'play', () => this.updatePlayButton());
    on(this.dom.audioPlayer, 'pause', () => this.updatePlayButton());
    on(this.dom.audioPlayer, 'error', () => this.setPlayButtonDisabled(true));
  }

  /**
   * 绑定导航事件
   */
  bindNavigation() {
    if (this.bindingFlags.navigation) return;
    this.bindingFlags.navigation = true;

    if (this.dom.prevUnitBtn) {
      on(this.dom.prevUnitBtn, 'click', () => this.loadPreviousUnit());
    }

    if (this.dom.nextUnitBtn) {
      on(this.dom.nextUnitBtn, 'click', () => this.loadNextUnit());
    }
  }

  /**
   * 绑定翻译切换事件
   */
  bindTranslationToggle() {
    if (this.bindingFlags.translationToggle || !this.dom.toggleTranslationBtn) {
      return;
    }
    this.bindingFlags.translationToggle = true;

    on(this.dom.toggleTranslationBtn, 'click', () => {
      this.toggleTranslationMode();
    });
  }

  /**
   * 绑定窗口事件
   */
  bindWindowEvents() {
    on(window, 'hashchange', () => {
      const newKey = location.hash.slice(1).trim() || this.config.DEFAULT_BOOK_KEY;
      if (newKey === this.state.bookKey) return;
      this.applyBookChange(newKey).then(() => this.loadUnitFromStorage());
    });
  }

  // =========================================================================
  // 清理和销毁
  // =========================================================================

  /**
   * 销毁系统，清理资源
   */
  destroy() {
    this.eventManager.clear();
    this.lrcCache.clear();
    this.audioPreload.clear();
    this.resourceLoader.cancel();
    this.lyricLineEls = [];
    this.dom = null;
    this.state = null;
  }
}
