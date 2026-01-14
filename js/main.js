// Author: Qim
// Blog: https://ichochy.com
// Email: Qim.it@icloud.com
// FileName: iReader:main.js
// Update: 2025/12/5 19:41
// Copyright (c) 2025.

const DEFAULT_BOOK_KEY = 'YL4B';
const DEFAULT_BOOK_PATH = 'https://yl.mleo.site/4B';

// LRC 解析器
class LRCParser {
  static parse(lrcText) {
    const lines = lrcText.split('\n');
    const lyrics = [];

    for (const line of lines) {
      const match = line.match(/\[(\d{2}):(\d{2})\.(\d{3})\](.+)/);
      if (match) {
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        const milliseconds = parseInt(match[3]);
        const time = minutes * 60 + seconds + milliseconds / 1000 - 0.5;

        // 分割英文和中文（使用 | 分隔符）
        const text = match[4].trim();
        const parts = text.split('|').map((p) => p.trim());

        lyrics.push({
          time,
          english: parts[0] || '',
          chinese: parts[1] || '',
          fullText: text
        });
      }
    }

    return lyrics.sort((a, b) => a.time - b.time);
  }
}

// 点读系统主类
class ReadingSystem {
  constructor() {
    this.units = [];
    this.bookPath = '';
    this.currentLyrics = [];
    this.currentLyricIndex = -1;
    this.playMode = 'single'; // 'single' 或 'continuous'
    this.singlePlayEndTime = null; // 单句播放的结束时间
    this.playbackRate = 1.0; // 播放速度
    this.availableSpeeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]; // 可选速度
    this.currentUnitIndex = -1; // 当前课件索引

    this.audioPlayer = document.getElementById('audioPlayer');
    this.lyricsDisplay = document.getElementById('lyricsDisplay');
    this.currentUnitTitle = document.getElementById('currentUnit');
    this.bookNameEl = document.getElementById('bookName');
    this.unitListContainer = document.getElementById('unitListContainer');
    this.playModeBtn = document.getElementById('playModeBtn');

    this.init();
  }


  async init() {
    await this.loadData();
    await this.loadUnitInfo();
    this.setupEventListeners();
    this.renderUnitList();
    await this.loadUnit();
  }

  async loadData() {
    if (!this.getBookPathByBookPath()) {
      await this.getBookPathByBookKey();
    }
  }

  getBookPathByBookPath() {
    const url = new URL(location.href);
    const bookPath = url.searchParams.get('bookPath');
    if (bookPath) {
      this.bookPath = bookPath.trim();
      return true;
    }
    return false;
  }

  async getBookPathByBookKey() {
    let bookKey = location.hash.slice(1).trim();
    if (!bookKey) {
      bookKey = DEFAULT_BOOK_KEY;
    }
    const response = await fetch('data.json');
    const data = await response.json();
    const found = data.books.find(b => b.key === bookKey);
    if (found && found.bookPath) {
      this.bookPath = found.bookPath.trim();
    } else {
      this.bookPath = DEFAULT_BOOK_PATH;
    }
  }


  async loadUnitInfo() {
    try {
      const response = await fetch(`${this.bookPath}/book.json`);
      const data = await response.json();

      // 处理units，添加完整路径和索引作为id
      this.units = data.units.map((unit, index) => ({
        ...unit,
        id: index + 1,
        title: unit.title,
        audio: `${this.bookPath}/${unit.filename}.mp3`,
        lrc: `${this.bookPath}/${unit.filename}.lrc`
      }));

      // 更新课本名称显示
      if (this.bookNameEl) {
        this.bookNameEl.textContent = `${data.bookName} ${data.bookLevel}`;
      }

      // 更新封面图片
      const bookCover = document.getElementById('bookCover');
      if (bookCover && data.bookCover) {
        bookCover.src = `${this.bookPath}/${data.bookCover}`;
      }
    } catch (error) {
      console.error('加载课件配置失败:', error);
      this.lyricsDisplay.innerHTML = `<p class="placeholder">课件配置加载失败，请检查 ${this.bookPath}/book.json 文件</p>`;
    }
  }

  renderUnitList() {
    // 桌面端列表
    this.unitListContainer.innerHTML = this.units
      .map(
        (unit, index) => `
      <div class="unit-item" data-unit-index="${index}">
        <h3>${unit.title}</h3>
        <p>点击开始学习</p>
      </div>
    `
      )
      .join('');

    // 为每个unit添加点击事件
    this.unitListContainer.querySelectorAll('.unit-item').forEach((item) => {
      item.addEventListener('click', () => {
        const unitIndex = parseInt(item.dataset.unitIndex);
        this.loadUnitByIndex(unitIndex);
      });
    });

    // 移动端下拉选择器
    const unitSelect = document.getElementById('unitSelect');
    if (unitSelect) {
      // 填充选项
      const options = this.units.map(
        (unit, index) => `<option value="${index}">${unit.title}</option>`
      ).join('');
      unitSelect.innerHTML = `<option value="">请选择一个Unit</option>${options}`;

      // 添加变更事件
      unitSelect.addEventListener('change', (e) => {
        const unitIndex = parseInt(e.target.value);
        if (unitIndex >= 0) {
          this.loadUnitByIndex(unitIndex);
        }
      });
    }
  }

  async loadUnit() {
    if (this.units.length > 0) {
      let unitIndexValue = localStorage.getItem(`${this.bookPath}/currentUnitIndex`);
      if (unitIndexValue) {
        let unitIndex = parseInt(unitIndexValue);
        await this.loadUnitByIndex(unitIndex);
      } else {
        await this.loadUnitByIndex(0);
      }
    }
  }

  async loadUnitByIndex(unitIndex) {
    this.currentUnitIndex = unitIndex; // 保存当前课件索引
    localStorage.setItem(`${this.bookPath}/currentUnitIndex`, unitIndex);

    const unit = this.units[unitIndex];
    if (!unit) return;
    this.currentUnitTitle.textContent = unit.title;
    // 重置播放器状态

    this.resetPlayer();
    // 更新桌面端UI
    this.updateActiveUnit(unitIndex);

    // 更新导航按钮状态
    this.updateNavigationButtons();

    // 加载歌词
    try {
      const response = await fetch(unit.lrc);
      const lrcText = await response.text();
      this.currentLyrics = LRCParser.parse(lrcText);
      this.renderLyrics();
    } catch (error) {
      console.error('加载歌词失败:', error);
      this.lyricsDisplay.innerHTML = '<p class="placeholder">歌词加载失败</p>';
    }

    // 加载音频
    this.audioPlayer.src = unit.audio;
    this.audioPlayer.load();

    // 加载保存的播放速度
    this.loadSavedSpeed();
  }

  resetPlayer() {
    // 暂停播放
    this.audioPlayer.pause();

    // 重置播放时间
    this.audioPlayer.currentTime = 0;

    // 重置进度条
    const progressFill = document.getElementById('progressFill');
    const progressHandle = document.getElementById('progressHandle');
    const currentTimeEl = document.getElementById('currentTime');
    const durationEl = document.getElementById('duration');

    if (progressFill) progressFill.style.width = '0%';
    if (progressHandle) progressHandle.style.left = '0%';
    if (currentTimeEl) currentTimeEl.textContent = '0:00';
    if (durationEl) durationEl.textContent = '0:00';

    // 重置播放按钮状态
    this.updatePlayButton();

    // 重置歌词索引
    this.currentLyricIndex = -1;
    this.singlePlayEndTime = null;

    console.log('播放器已重置');
  }

  updateActiveUnit(unitIndex) {
    // 更新桌面端UI
    this.unitListContainer.querySelectorAll('.unit-item').forEach((item, index) => {
      if (index === unitIndex) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // 更新移动端选择器
    const unitSelect = document.getElementById('unitSelect');
    if (unitSelect) {
      unitSelect.value = unitIndex;
    }
  }

  renderLyrics() {
    if (this.currentLyrics.length === 0) {
      this.lyricsDisplay.innerHTML = '<p class="placeholder">没有歌词数据</p>';
      return;
    }

    this.lyricsDisplay.innerHTML = this.currentLyrics
      .map(
        (lyric, index) => `
      <div class="lyric-line" data-index="${index}" data-time="${lyric.time}">
        <div class="lyric-text">${lyric.english}</div>
        ${lyric.chinese ? `<div class="lyric-translation">${lyric.chinese}</div>` : ''}
      </div>
    `
      )
      .join('');

    // 为每行歌词添加点击事件
    this.lyricsDisplay.querySelectorAll('.lyric-line').forEach((line) => {
      line.addEventListener('click', () => {
        const index = parseInt(line.dataset.index);
        const time = parseFloat(line.dataset.time);
        this.playLyricAtIndex(index, time);
      });
    });
  }

  playLyricAtIndex(index, time) {
    this.audioPlayer.currentTime = time;

    if (this.playMode === 'single') {
      // 单句模式：设置当前句的结束时间
      const nextLyric = this.currentLyrics[index + 1];
      if (nextLyric) {
        this.singlePlayEndTime = nextLyric.time;
      } else {
        // 如果是最后一句，设置为音频结束时间
        this.singlePlayEndTime = this.audioPlayer.duration;
      }
    } else {
      // 连续模式：清除结束时间限制
      this.singlePlayEndTime = null;
    }

    // 开始播放
    this.audioPlayer.play();
  }

  checkSinglePlayEnd() {
    // 只在单句模式下检查
    if (this.playMode === 'single' && this.singlePlayEndTime !== null) {
      const currentTime = this.audioPlayer.currentTime;
      // 当播放时间达到或超过下一句开始时间时，暂停播放
      if (currentTime >= this.singlePlayEndTime && this.singlePlayEndTime !== this.audioPlayer.duration) {
        this.audioPlayer.pause();
        //冗余提前0.1S，修正播放当前句后，字幕跳到下一句的问题
        this.audioPlayer.currentTime = this.singlePlayEndTime - 0.1;
        this.singlePlayEndTime = null;
        console.log('单句播放完成');
      }
    }
  }

  setupCustomPlayer() {
    const playPauseBtn = document.getElementById('playPauseBtn');
    const progressBar = document.getElementById('progressBar');
    const speedBtn = document.getElementById('speedBtn');

    // 播放/暂停按钮
    playPauseBtn.addEventListener('click', () => {
      if (this.audioPlayer.paused) {
        this.audioPlayer.play();
      } else {
        this.audioPlayer.pause();
      }
    });

    // 速度调节按钮
    speedBtn.addEventListener('click', () => {
      this.cyclePlaybackSpeed();
    });

    // 进度条点击
    progressBar.addEventListener('click', (e) => {
      const rect = progressBar.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      this.audioPlayer.currentTime = percent * this.audioPlayer.duration;
    });

    // 进度条拖动
    let isDragging = false;
    const progressHandle = document.getElementById('progressHandle');

    progressBar.addEventListener('mousedown', (e) => {
      isDragging = true;
      this.updateProgressByMouse(e);
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        this.updateProgressByMouse(e);
      }
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  updateProgressByMouse(e) {
    const progressBar = document.getElementById('progressBar');
    const rect = progressBar.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    this.audioPlayer.currentTime = percent * this.audioPlayer.duration;
  }

  updateProgress() {
    const progressFill = document.getElementById('progressFill');
    const progressHandle = document.getElementById('progressHandle');
    const currentTimeEl = document.getElementById('currentTime');

    if (this.audioPlayer.duration) {
      const percent = (this.audioPlayer.currentTime / this.audioPlayer.duration) * 100;
      progressFill.style.width = percent + '%';
      progressHandle.style.left = percent + '%';
      currentTimeEl.textContent = this.formatTime(this.audioPlayer.currentTime);
    }
  }

  updateDuration() {
    const durationEl = document.getElementById('duration');
    durationEl.textContent = this.formatTime(this.audioPlayer.duration);
  }

  updatePlayButton() {
    const playPauseBtn = document.getElementById('playPauseBtn');
    if (this.audioPlayer.paused) {
      playPauseBtn.classList.remove('playing');
    } else {
      playPauseBtn.classList.add('playing');
    }
  }

  formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  cyclePlaybackSpeed() {
    // 循环切换播放速度
    const currentIndex = this.availableSpeeds.indexOf(this.playbackRate);
    const nextIndex = (currentIndex + 1) % this.availableSpeeds.length;
    this.playbackRate = this.availableSpeeds[nextIndex];

    // 应用新速度
    this.audioPlayer.playbackRate = this.playbackRate;

    // 更新按钮显示
    this.updateSpeedButton();

    // 保存到本地存储
    localStorage.setItem('playbackRate', this.playbackRate);

    console.log(`播放速度: ${this.playbackRate}x`);
  }

  updateSpeedButton() {
    const speedText = document.getElementById('speedText');
    const speedBtn = document.getElementById('speedBtn');

    speedText.textContent = `${this.playbackRate}x`;

    // 非1.0倍速时高亮显示
    if (this.playbackRate !== 1.0) {
      speedBtn.classList.add('active');
    } else {
      speedBtn.classList.remove('active');
    }
  }

  loadSavedSpeed() {
    // 从本地存储加载保存的速度
    const savedSpeed = localStorage.getItem('playbackRate');
    if (savedSpeed) {
      this.playbackRate = parseFloat(savedSpeed);
      this.audioPlayer.playbackRate = this.playbackRate;
      this.updateSpeedButton();
    }
  }

  setupEventListeners() {
    // 播放模式切换
    this.playModeBtn.addEventListener('click', () => {
      this.togglePlayMode();
    });

    // 监听音频播放，同步歌词高亮
    this.audioPlayer.addEventListener('timeupdate', () => {
      this.checkSinglePlayEnd(); // 检查单句播放是否应该停止
      this.updateLyricHighlight(); //更新歌词高亮
      this.updateProgress(); // 更新进度条
    });

    // 监听音频加载完成
    this.audioPlayer.addEventListener('loadedmetadata', () => {
      this.updateDuration();
    });

    // 监听音频播放结束
    this.audioPlayer.addEventListener('ended', () => {
      this.handleAudioEnded();
      this.updatePlayButton();
    });

    // 监听音频播放状态
    this.audioPlayer.addEventListener('play', () => {
      console.log('播放开始');
      this.updatePlayButton();
    });

    this.audioPlayer.addEventListener('pause', () => {
      console.log('播放暂停');
      // 清除单句播放结束时间
      this.singlePlayEndTime = null;
      this.updatePlayButton();
    });

    // 自定义播放控制
    this.setupCustomPlayer();

    // 上一课/下一课按钮事件监听
    this.setupNavigationButtons();
  }

  setupNavigationButtons() {
    const prevBtn = document.getElementById('prevUnitBtn');
    const nextBtn = document.getElementById('nextUnitBtn');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        this.loadPreviousUnit();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.loadNextUnit();
      });
    }
  }

  updateNavigationButtons() {
    const prevBtn = document.getElementById('prevUnitBtn');
    const nextBtn = document.getElementById('nextUnitBtn');

    if (prevBtn) {
      // 如果是第一课，则禁用上一课按钮
      if (this.currentUnitIndex <= 0) {
        prevBtn.disabled = true;
      } else {
        prevBtn.disabled = false;
      }
    }

    if (nextBtn) {
      // 如果是最后一课，则禁用下一课按钮
      if (this.currentUnitIndex >= this.units.length - 1) {
        nextBtn.disabled = true;
      } else {
        nextBtn.disabled = false;
      }
    }
  }

  loadPreviousUnit() {
    if (this.currentUnitIndex > 0) {
      this.loadUnitByIndex(this.currentUnitIndex - 1);
    }
  }

  loadNextUnit() {
    if (this.currentUnitIndex < this.units.length - 1) {
      this.loadUnitByIndex(this.currentUnitIndex + 1);
    }
  }

  togglePlayMode() {
    // 切换模式
    this.playMode = this.playMode === 'single' ? 'continuous' : 'single';
    this.updatePlayModeUI();
  }

  setPlayMode(mode) {
    this.playMode = mode;
    this.updatePlayModeUI();
  }

  updatePlayModeUI() {
    // 更新按钮文字和样式
    if (this.playMode === 'single') {
      this.playModeBtn.title = '单句点读';
      this.playModeBtn.classList.remove('continuous-mode');
    } else {
      this.playModeBtn.title = '连续点读';
      this.playModeBtn.classList.add('continuous-mode');
    }
  }

  handleAudioEnded() {
    if (this.playMode === 'continuous') {
      // 连续播放模式：播放下一句
      this.playNextLyric();
    } else {
      // 单句模式：停止播放
      console.log('单句播放完成');
    }
  }

  playNextLyric() {
    const nextIndex = this.currentLyricIndex + 1;
    if (nextIndex < this.currentLyrics.length) {
      const nextLyric = this.currentLyrics[nextIndex];
      this.audioPlayer.currentTime = nextLyric.time;
      this.audioPlayer.play();
    } else {
      console.log('已播放到最后一句');
    }
  }

  updateLyricHighlight() {
    const currentTime = this.audioPlayer.currentTime;
    // 找到当前应该高亮的歌词索引
    let newIndex = -1;
    for (let i = this.currentLyrics.length - 1; i >= 0; i--) {
      if (currentTime >= this.currentLyrics[i].time) {
        console.log(`${currentTime}:${this.currentLyrics[i].time}`);
        newIndex = i;
        break;
      }
    }
    // 如果索引改变，更新高亮
    if (newIndex !== this.currentLyricIndex) {
      this.currentLyricIndex = newIndex;

      // 移除所有高亮
      this.lyricsDisplay.querySelectorAll('.lyric-line').forEach((line) => {
        line.classList.remove('active');
      });

      // 添加当前高亮
      if (newIndex >= 0) {
        const activeLine = this.lyricsDisplay.querySelector(`[data-index="${newIndex}"]`);
        if (activeLine) {
          activeLine.classList.add('active');

          // 滚动到当前歌词（居中显示）
          activeLine.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }
    }
  }
}

// 初始化系统
document.addEventListener('DOMContentLoaded', () => {
  new ReadingSystem();
  initThemeToggle();
});

// 主题切换功能
function initThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

  // 检查本地存储的主题设置
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark' || (!savedTheme && prefersDark.matches)) {
    document.body.classList.add('dark-theme');
  }

  // 主题切换事件
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');

    // 添加切换动画
    themeToggle.style.transform = 'rotate(360deg)';
    setTimeout(() => {
      themeToggle.style.transform = '';
    }, 300);
  });

  // 监听系统主题变化
  prefersDark.addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      if (e.matches) {
        document.body.classList.add('dark-theme');
      } else {
        document.body.classList.remove('dark-theme');
      }
    }
  });
}
