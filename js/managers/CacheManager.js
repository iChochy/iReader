/**
 * 有容量上限的 LRU 缓存。Map 的插入顺序即访问顺序。
 * @module managers/CacheManager
 */

export class CacheManager {
  /**
   * @param {number} [maxSize=10]
   * @param {(value: *, key: string) => void} [onEvict]
   */
  constructor(maxSize = 10, onEvict) {
    this.maxSize = Math.max(1, maxSize);
    this.cache = new Map();
    this.onEvict = typeof onEvict === 'function' ? onEvict : null;
  }

  get(key) {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, value);
    this.#trim();
  }

  has(key) {
    return this.cache.has(key);
  }

  delete(key) {
    if (!this.cache.has(key)) return false;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.onEvict?.(value, key);
    return true;
  }

  clear() {
    if (this.onEvict) {
      for (const [key, value] of this.cache) {
        this.onEvict(value, key);
      }
    }
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }

  #trim() {
    while (this.cache.size > this.maxSize) {
      const oldest = this.cache.keys().next().value;
      const value = this.cache.get(oldest);
      this.cache.delete(oldest);
      this.onEvict?.(value, oldest);
    }
  }
}
