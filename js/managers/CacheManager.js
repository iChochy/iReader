/**
 * 缓存管理器
 * 提供 LRU 缓存功能，支持音频和歌词文件的智能缓存
 * 
 * @module managers/CacheManager
 */

/**
 * LRU (Least Recently Used) 缓存管理器
 * 当达到容量限制时，自动删除最久未使用的项
 */
export class CacheManager {
  /**
   * 构造函数
   * @param {number} [maxSize=10] - 缓存最大容量
   */
  constructor(maxSize = 10) {
    this.maxSize = maxSize;
    this.cache = new Map(); // 使用 Map 以维持插入顺序
    this.accessOrder = []; // 记录访问顺序
  }

  /**
   * 获取缓存项
   * @param {string} key - 缓存键
   * @returns {*|undefined} 缓存的值或 undefined
   */
  get(key) {
    if (!this.cache.has(key)) {
      return undefined;
    }

    // 更新访问顺序（移到最后）
    this.updateAccessOrder(key);

    return this.cache.get(key);
  }

  /**
   * 设置缓存项
   * @param {string} key - 缓存键
   * @param {*} value - 缓存值
   */
  set(key, value) {
    // 如果键已存在，删除旧值
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // 如果缓存满了，删除最少使用的项
    if (this.cache.size >= this.maxSize) {
      const lruKey = this.accessOrder.shift();
      if (lruKey) {
        this.cache.delete(lruKey);
      }
    }

    // 添加新项
    this.cache.set(key, value);
    this.accessOrder.push(key);
  }

  /**
   * 检查缓存中是否存在指定键
   * @param {string} key - 缓存键
   * @returns {boolean}
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * 删除缓存项
   * @param {string} key - 缓存键
   * @returns {boolean} 是否成功删除
   */
  delete(key) {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    return this.cache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * 获取缓存大小
   * @returns {number}
   */
  size() {
    return this.cache.size;
  }

  /**
   * 获取缓存的所有键
   * @returns {string[]}
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * 获取缓存的所有值
   * @returns {*[]}
   */
  values() {
    return Array.from(this.cache.values());
  }

  /**
   * 更新访问顺序
   * @private
   * @param {string} key - 缓存键
   */
  updateAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * 获取缓存统计信息
   * @returns {Object}
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilization: (this.cache.size / this.maxSize * 100).toFixed(2) + '%',
      keys: this.keys(),
    };
  }
}

/**
 * 资源预加载管理器
 * 用于智能预加载音频和歌词资源
 */
export class ResourceLoader {
  /**
   * 构造函数
   * @param {Object} [config={}] - 配置选项
   */
  constructor(config = {}) {
    this.config = {
      maxConcurrentLoads: 3,
      timeout: 10000, // 10秒超时
      retryCount: 2,
      ...config,
    };

    this.activeLoads = new Map();
    this.queue = [];
    this.loadingCount = 0;
  }

  /**
   * 加载 LRC 歌词文件
   * @param {string} url - 文件 URL
   * @param {CacheManager} cache - 缓存管理器
   * @returns {Promise<string>} 文件内容
   */
  async loadLRC(url, cache) {
    // 检查缓存
    if (cache && cache.has(url)) {
      return cache.get(url);
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();

      // 存入缓存
      if (cache) {
        cache.set(url, text);
      }

      return text;
    } catch (error) {
      console.error(`Failed to load LRC: ${url}`, error);
      throw error;
    }
  }

  /**
   * 预加载音频文件
   * @param {string} url - 文件 URL
   * @returns {Promise<HTMLAudioElement>}
   */
  async loadAudio(url) {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.preload = 'auto';

      const timeout = setTimeout(() => {
        audio.onload = null;
        audio.onerror = null;
        reject(new Error(`Timeout loading audio: ${url}`));
      }, this.config.timeout);

      audio.oncanplaythrough = () => {
        clearTimeout(timeout);
        resolve(audio);
      };

      audio.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(`Failed to load audio: ${url}`));
      };

      audio.src = url;
    });
  }

  /**
   * 批量预加载资源
   * @param {Array<{url: string, type: 'lrc'|'audio'}>} resources - 资源列表
   * @param {CacheManager} [cache] - 缓存管理器（仅用于 LRC）
   * @returns {Promise<Map<string, any>>} 加载结果
   */
  async loadBatch(resources, cache) {
    const results = new Map();

    for (const resource of resources) {
      try {
        let result;
        if (resource.type === 'lrc') {
          result = await this.loadLRC(resource.url, cache);
        } else if (resource.type === 'audio') {
          result = await this.loadAudio(resource.url);
        }
        results.set(resource.url, { success: true, data: result });
      } catch (error) {
        results.set(resource.url, { success: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * 清空所有加载
   */
  cancel() {
    this.activeLoads.clear();
    this.queue = [];
    this.loadingCount = 0;
  }
}
