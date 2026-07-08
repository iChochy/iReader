/**
 * LRC (Lyric) 歌词解析器
 * 支持格式: [mm:ss.xx]英文 | 中文
 * 
 * @module LRCParser
 */

import { clamp } from './utils/helpers.js';

/**
 * LRC 歌词解析器
 * 将 LRC 格式的文本转换为结构化的歌词数据
 */
export class LRCParser {
  /**
   * 解析 LRC 文本为歌词对象数组
   * @param {string} lrcText - LRC 格式的歌词文本
   * @param {number} [timeOffset=0.5] - 时间偏移量（秒），用于调整高亮时机
   * @returns {Array<{time: number, english: string, chinese: string, fullText: string}>}
   */
  static parse(lrcText, timeOffset = 0.5) {
    if (!lrcText || typeof lrcText !== 'string') {
      return [];
    }

    const lines = lrcText.split('\n');
    const lyrics = [];

    for (const line of lines) {
      // 跳过空行和注释
      if (!line.trim() || line.trim().startsWith('#')) {
        continue;
      }

      // 匹配 LRC 时间标签: [mm:ss.xx] 或 [mm:ss.xxx]
      // 支持格式: [00:12.34]Content | [1:30.500]Content
      const match = line.match(/\[(\d{1,2}):(\d{2})\.(\d{2,3})\](.+)/);
      if (!match) {
        continue;
      }

      try {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const milliseconds = parseInt(match[3].padEnd(3, '0'), 10);

        // 确保秒数在有效范围内
        if (seconds > 59) continue;

        // 计算总时间（秒）
        let time = minutes * 60 + seconds + milliseconds / 1000;
        
        // 应用时间偏移，使高亮提前出现
        time -= timeOffset;

        const text = match[4].trim();

        // 使用 | 分隔英文和中文
        const parts = text.split('|').map(p => p.trim());
        const english = parts[0] || '';
        const chinese = parts[1] || '';

        if (english) {
          lyrics.push({
            time,
            english,
            chinese,
            fullText: text,
          });
        }
      } catch (error) {
        console.warn(`Failed to parse lyric line: ${line}`, error);
        continue;
      }
    }

    // 按时间排序
    return lyrics.sort((a, b) => a.time - b.time);
  }

  /**
   * 根据播放时间查找对应的歌词索引
   * @param {Array} lyrics - 歌词数组
   * @param {number} currentTime - 当前播放时间（秒）
   * @returns {number} 歌词索引，如果未找到则返回 -1
   */
  static findLyricIndexByTime(lyrics, currentTime) {
    if (!Array.isArray(lyrics) || lyrics.length === 0) {
      return -1;
    }

    // 从后向前遍历，找到最后一条小于等于当前时间的歌词
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (currentTime >= lyrics[i].time) {
        return i;
      }
    }

    return -1;
  }

  /**
   * 获取指定索引歌词的句子边界（用于单句循环）
   * @param {Array} lyrics - 歌词数组
   * @param {number} index - 歌词索引
   * @param {number} [audioStartTime=0.5] - 句子开始的时间偏移（相对于歌词时间）
   * @param {number} [audioDuration=0] - 音频总时长（用于计算最后一句的结束时间）
   * @returns {Object|null} {startTime, endTime, index} 或 null
   */
  static getSentenceBoundaries(lyrics, index, audioDuration = 0) {
    if (!Array.isArray(lyrics) || index < 0 || index >= lyrics.length) {
      return null;
    }

    const lyric = lyrics[index];
    const startTime = lyric.time;

    // 计算句子的结束时间：下一句的开始时间，或音频的总时长
    let endTime;
    if (index < lyrics.length - 1) {
      endTime = lyrics[index + 1].time;
    } else {
      // 最后一句：使用音频时长或给定的最小值
      endTime = Math.max(audioDuration, startTime + 0.1);
    }

    return {
      startTime,
      endTime,
      index,
      lyric,
    };
  }

  /**
   * 验证 LRC 文本的有效性
   * @param {string} lrcText - LRC 文本
   * @returns {boolean}
   */
  static isValid(lrcText) {
    if (!lrcText || typeof lrcText !== 'string') {
      return false;
    }

    // 至少包含一个有效的时间标签
    return /\[\d{1,2}:\d{2}\.\d{2,3}\]/.test(lrcText);
  }

  /**
   * 统计 LRC 文本中有效的歌词行数
   * @param {string} lrcText - LRC 文本
   * @returns {number}
   */
  static countLyrics(lrcText) {
    if (!lrcText || typeof lrcText !== 'string') {
      return 0;
    }

    const matches = lrcText.match(/\[\d{1,2}:\d{2}\.\d{2,3}\]/g);
    return matches ? matches.length : 0;
  }

  /**
   * 获取 LRC 的时间跨度
   * @param {Array} lyrics - 歌词数组
   * @returns {Object} {startTime, endTime, duration}
   */
  static getTimeSpan(lyrics) {
    if (!Array.isArray(lyrics) || lyrics.length === 0) {
      return { startTime: 0, endTime: 0, duration: 0 };
    }

    const startTime = lyrics[0].time;
    const endTime = lyrics[lyrics.length - 1].time;
    const duration = endTime - startTime;

    return { startTime, endTime, duration };
  }
}
