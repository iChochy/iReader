/**
 * 智能资源预加载和缓存管理系统
 * 支持优先级队列、并发控制、智能预测预加载
 * 
 * @module managers/PreloadManager
 */

import { CacheManager } from './CacheManager.js';

/**
 * 预加载任务优先级枚举
 */
export const PreloadPriority = {
  LOW: 0,
  NORMAL: 1,
  HIGH: 2,
  CRITICAL: 3,
};

/**
 * 预加载任务状态枚举
 */
export const PreloadStatus = {
  PENDING: 'pending',
  LOADING: 'loading',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

/**
 * 智能预加载管理器
 * 支持优先级队列、并发控制、智能预测
 */
export class PreloadManager {
  /**
   * 构造函数
   * @param {Object} [config={}] - 配置选项
   */
  constructor(config = {}) {
    this.config = {
      maxConcurrent: 3,
      timeout: 10000,
      priority: PreloadPriority.NORMAL,
      ...config,
    };

    // 优先级队列（使用数组模拟优先级队列）
    this.queue = [];
    
    // 当前加载中的任务
    this.activeLoads = new Map();
    
    // 已完成的缓存
    this.cache = new CacheManager(50);
    
    // 任务状态追踪
    this.taskStats = new Map();
    
    // 加载统计
    this.stats = {
      totalTasks: 0,
      successCount: 0,
      failureCount: 0,
      cancelledCount: 0,
      averageLoadTime: 0,
    };
  }

  /**
   * 添加预加载任务
   * @param {string} id - 任务 ID
   * @param {Function} loadFn - 加载函数，返回 Promise
   * @param {number} [priority=PreloadPriority.NORMAL] - 优先级
   * @returns {Promise} 加载结果
   */
  enqueue(id, loadFn, priority = PreloadPriority.NORMAL) {
    // 检查缓存
    if (this.cache.has(id)) {
      return Promise.resolve(this.cache.get(id));
    }

    // 检查是否已在加载中
    if (this.activeLoads.has(id)) {
      return this.activeLoads.get(id).promise;
    }

    return new Promise((resolve, reject) => {
      const task = {
        id,
        loadFn,
        priority,
        promise: null,
        status: PreloadStatus.PENDING,
        startTime: 0,
        endTime: 0,
        error: null,
      };

      // 插入队列（按优先级排序）
      this.insertTaskByPriority(task);

      // 保存 Promise
      task.promise = new Promise((taskResolve, taskReject) => {
        task._resolve = taskResolve;
        task._reject = taskReject;
      }).then(result => {
        this.activeLoads.delete(id);
        resolve(result);
        return result;
      }).catch(error => {
        this.activeLoads.delete(id);
        reject(error);
        throw error;
      });

      this.taskStats.set(id, task);
      this.stats.totalTasks++;

      // 尝试处理队列
      this.processQueue();
    });
  }

  /**
   * 处理预加载队列
   * @private
   */
  processQueue() {
    // 如果已达到最大并发数，则等待
    if (this.activeLoads.size >= this.config.maxConcurrent) {
      return;
    }

    // 如果队列为空，则返回
    if (this.queue.length === 0) {
      return;
    }

    // 取出下一个任务
    const task = this.queue.shift();
    if (!task) return;

    // 标记为加载中
    task.status = PreloadStatus.LOADING;
    task.startTime = Date.now();
    this.activeLoads.set(task.id, task);

    // 执行加载函数
    Promise.race([
      task.loadFn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), this.config.timeout)
      ),
    ])
      .then((result) => {
        task.status = PreloadStatus.SUCCESS;
        task.endTime = Date.now();
        this.cache.set(task.id, result);
        this.stats.successCount++;
        this.updateAverageLoadTime();
        task._resolve(result);
      })
      .catch((error) => {
        task.status = PreloadStatus.FAILED;
        task.endTime = Date.now();
        task.error = error;
        this.stats.failureCount++;
        task._reject(error);
      })
      .finally(() => {
        // 继续处理队列
        this.processQueue();
      });
  }

  /**
   * 按优先级插入任务
   * @private
   * @param {Object} task - 任务对象
   */
  insertTaskByPriority(task) {
    let inserted = false;

    for (let i = 0; i < this.queue.length; i++) {
      if (task.priority > this.queue[i].priority) {
        this.queue.splice(i, 0, task);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      this.queue.push(task);
    }
  }

  /**
   * 取消任务
   * @param {string} id - 任务 ID
   * @returns {boolean} 是否成功取消
   */
  cancel(id) {
    // 从队列中移除
    const queueIndex = this.queue.findIndex(t => t.id === id);
    if (queueIndex > -1) {
      const task = this.queue.splice(queueIndex, 1)[0];
      task.status = PreloadStatus.CANCELLED;
      this.stats.cancelledCount++;
      task._reject(new Error('Task cancelled'));
      return true;
    }

    // 从活跃加载中移除（无法真正中止 Promise，但可以标记）
    if (this.activeLoads.has(id)) {
      const task = this.activeLoads.get(id);
      task.status = PreloadStatus.CANCELLED;
      this.stats.cancelledCount++;
      return true;
    }

    return false;
  }

  /**
   * 批量预加载资源
   * @param {Array<{id: string, loadFn: Function, priority?: number}>} tasks - 任务列表
   * @returns {Promise<Map>} 加载结果映射
   */
  async loadBatch(tasks) {
    const results = new Map();

    for (const task of tasks) {
      try {
        const result = await this.enqueue(
          task.id,
          task.loadFn,
          task.priority || PreloadPriority.NORMAL
        );
        results.set(task.id, { success: true, data: result });
      } catch (error) {
        results.set(task.id, { success: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * 预加载相邻单元的资源
   * @param {number} currentUnitIndex - 当前单元索引
   * @param {Array} units - 所有单元列表
   * @param {Function} createLoadTask - 创建加载任务的函数
   */
  async prefetchAdjacentUnits(currentUnitIndex, units, createLoadTask) {
    const tasks = [];

    // 预加载下一个单元（高优先级）
    if (currentUnitIndex + 1 < units.length) {
      const nextTasks = createLoadTask(currentUnitIndex + 1, PreloadPriority.HIGH);
      tasks.push(...nextTasks);
    }

    // 预加载下下个单元（正常优先级）
    if (currentUnitIndex + 2 < units.length) {
      const nextNextTasks = createLoadTask(currentUnitIndex + 2, PreloadPriority.NORMAL);
      tasks.push(...nextNextTasks);
    }

    // 预加载上一个单元（低优先级）
    if (currentUnitIndex - 1 >= 0) {
      const prevTasks = createLoadTask(currentUnitIndex - 1, PreloadPriority.LOW);
      tasks.push(...prevTasks);
    }

    return this.loadBatch(tasks);
  }

  /**
   * 更新平均加载时间
   * @private
   */
  updateAverageLoadTime() {
    const loadTimes = [];
    for (const task of this.taskStats.values()) {
      if (task.status === PreloadStatus.SUCCESS && task.endTime > 0) {
        loadTimes.push(task.endTime - task.startTime);
      }
    }

    if (loadTimes.length > 0) {
      this.stats.averageLoadTime =
        loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length;
    }
  }

  /**
   * 获取任务状态
   * @param {string} id - 任务 ID
   * @returns {Object|null} 任务信息或 null
   */
  getTaskStatus(id) {
    return this.taskStats.get(id) || null;
  }

  /**
   * 获取队列中的待处理任务数
   * @returns {number}
   */
  getPendingCount() {
    return this.queue.length;
  }

  /**
   * 获取当前活跃加载数
   * @returns {number}
   */
  getActiveCount() {
    return this.activeLoads.size;
  }

  /**
   * 获取缓存统计信息
   * @returns {Object}
   */
  getCacheStats() {
    return {
      ...this.cache.getStats(),
      cacheHitRate:
        this.stats.totalTasks > 0
          ? ((this.stats.successCount / this.stats.totalTasks) * 100).toFixed(2) + '%'
          : 'N/A',
    };
  }

  /**
   * 获取加载统计信息
   * @returns {Object}
   */
  getLoadStats() {
    return {
      ...this.stats,
      pendingCount: this.getPendingCount(),
      activeCount: this.getActiveCount(),
      cacheSize: this.cache.size(),
    };
  }

  /**
   * 清空缓存
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * 清空队列（取消所有待处理任务）
   */
  clearQueue() {
    for (const task of this.queue) {
      task.status = PreloadStatus.CANCELLED;
      task._reject(new Error('Queue cleared'));
      this.stats.cancelledCount++;
    }
    this.queue = [];
  }

  /**
   * 完全重置管理器
   */
  reset() {
    this.clearQueue();
    this.clearCache();
    this.activeLoads.clear();
    this.taskStats.clear();
    this.stats = {
      totalTasks: 0,
      successCount: 0,
      failureCount: 0,
      cancelledCount: 0,
      averageLoadTime: 0,
    };
  }
}

/**
 * 智能预加载策略
 * 根据用户行为和网络状况自动调整预加载策略
 */
export class SmartPreloadStrategy {
  /**
   * 构造函数
   * @param {PreloadManager} preloadManager - 预加载管理器实例
   */
  constructor(preloadManager) {
    this.preloadManager = preloadManager;
    this.networkSpeed = 'good'; // 'slow', 'good', 'fast'
    this.lastUnitIndex = -1;
    this.userBehavior = 'normal'; // 'browsing', 'studying'
  }

  /**
   * 检测网络速度
   * @returns {Promise<string>} 网络速度级别
   */
  async detectNetworkSpeed() {
    const testImageUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    const startTime = Date.now();

    try {
      await fetch(testImageUrl);
      const duration = Date.now() - startTime;

      if (duration > 1000) {
        this.networkSpeed = 'slow';
      } else if (duration > 500) {
        this.networkSpeed = 'good';
      } else {
        this.networkSpeed = 'fast';
      }
    } catch (error) {
      this.networkSpeed = 'slow';
    }

    return this.networkSpeed;
  }

  /**
   * 根据用户行为更新预加载策略
   * @param {number} currentUnitIndex - 当前单元索引
   * @param {number} playbackRate - 播放速率
   */
  updateStrategy(currentUnitIndex, playbackRate) {
    // 判断用户行为：快速播放 = 浏览，普通播放 = 学习
    this.userBehavior = playbackRate > 1.5 ? 'browsing' : 'studying';

    // 如果用户向前跳跃，说明在快速浏览
    if (currentUnitIndex - this.lastUnitIndex > 1) {
      this.userBehavior = 'browsing';
    }

    this.lastUnitIndex = currentUnitIndex;
  }

  /**
   * 根据当前策略获取预加载优先级
   * @param {number} unitOffset - 相对于当前单元的偏移量（正数表示后续）
   * @returns {number} 优先级
   */
  getPreloadPriority(unitOffset) {
    const isBrowsing = this.userBehavior === 'browsing';
    const isSlowNetwork = this.networkSpeed === 'slow';

    if (unitOffset === 1) {
      // 下一个单元：总是高优先级
      return PreloadPriority.HIGH;
    } else if (unitOffset === 2) {
      // 下下个单元
      if (isBrowsing || isSlowNetwork) {
        return PreloadPriority.NORMAL;
      } else {
        return PreloadPriority.HIGH;
      }
    } else if (unitOffset === -1) {
      // 上一个单元
      return isSlowNetwork ? PreloadPriority.LOW : PreloadPriority.NORMAL;
    } else {
      return PreloadPriority.LOW;
    }
  }

  /**
   * 调整管理器配置
   */
  adjustManagerConfig() {
    if (this.networkSpeed === 'slow') {
      // 在慢速网络下，减少并发数，延长超时时间
      this.preloadManager.config.maxConcurrent = 1;
      this.preloadManager.config.timeout = 20000;
    } else if (this.networkSpeed === 'fast') {
      // 在快速网络下，增加并发数，缩短超时时间
      this.preloadManager.config.maxConcurrent = 5;
      this.preloadManager.config.timeout = 5000;
    } else {
      // 正常网络
      this.preloadManager.config.maxConcurrent = 3;
      this.preloadManager.config.timeout = 10000;
    }
  }
}
