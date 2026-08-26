/**
 * LRC 歌词解析：`[mm:ss.xx]英文 | 中文`
 * @module utils/LRCParser
 */

export class LRCParser {
  /**
   * @param {string} lrcText
   * @param {number} [timeOffset=0]
   * @returns {Array<{time: number, english: string, chinese: string, fullText: string}>}
   */
  static parse(lrcText, timeOffset = 0) {
    if (!lrcText || typeof lrcText !== 'string') return [];

    const lyrics = [];

    for (const raw of lrcText.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;

      // 建议将正则声明在循环/函数外部，避免重复编译
      const LYRIC_TIME_REGEX = /^\[(\d{1,2}):(\d{2})\.(\d{2,3})\](.*)/;

      // 循环内部代码：
      const match = line.match(LYRIC_TIME_REGEX);
      if (!match) continue;

      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      if (seconds >= 60) continue; // 校验秒数范围

      // 将 2/3 位毫秒统一转化为秒（例："4"->0.4s, "45"->0.45s, "456"->0.456s）
      const fraction = Number(`0.${match[3]}`);
      const rawTime = minutes * 60 + seconds + fraction - timeOffset;
      const time = Math.round(rawTime * 1000) / 1000;  // 保留三位小数，避免浮点数精度问题
      
      const text = match[4].trim(); // 提取后的歌词内容

      const [english = '', chinese = ''] = text.split('|').map((part) => part.trim());

      if (!english) continue;

      lyrics.push({ time, english, chinese, fullText: text });
    }

    return lyrics.sort((a, b) => a.time - b.time);
  }

  /**
   * @param {Array<{time: number}>} lyrics
   * @param {number} currentTime
   * @returns {number}
   */
  static findLyricIndexByTime(lyrics, currentTime) {
    if (!Array.isArray(lyrics) || lyrics.length === 0) return -1;

    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (currentTime >= lyrics[i].time) return i;
    }
    return -1;
  }

  /**
   * @param {Array<{time: number}>} lyrics
   * @param {number} index
   * @param {number} [audioDuration=0]
   * @returns {{startTime: number, endTime: number, index: number}|null}
   */
  static getSentenceBoundaries(lyrics, index, audioDuration = 0) {
    if (!Array.isArray(lyrics) || index < 0 || index >= lyrics.length) return null;

    const startTime = lyrics[index].time;
    const endTime = index < lyrics.length - 1
      ? lyrics[index + 1].time
      : Math.max(audioDuration, startTime + 0.1);

    return { startTime, endTime, index };
  }
}
