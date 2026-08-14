/**
 * 课本目录与课件配置加载
 * @module services/BookService
 */

export class BookService {
  /**
   * @param {string} [catalogUrl='data.json']
   */
  constructor(catalogUrl = 'data.json') {
    this.catalogUrl = catalogUrl;
    this.books = [];
  }

  /**
   * @param {AbortSignal} [signal]
   * @returns {Promise<Array>}
   */
  async loadCatalog(signal) {
    const response = await fetch(this.catalogUrl, { signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    this.books = Array.isArray(data.books) ? data.books : [];
    return this.books;
  }

  /**
   * @param {string} bookKey
   * @param {string} defaultKey
   * @returns {Object|null}
   */
  resolve(bookKey, defaultKey) {
    if (!this.books.length) return null;

    const getPath = (book) => book?.path || '';

    const exact = this.books.find((book) => book?.key === bookKey && getPath(book));
    if (exact) return exact;

    const fallback = this.books.find((book) => book?.key === defaultKey && getPath(book));
    if (fallback) return fallback;

    return this.books.find((book) => getPath(book)) || null;
  }

  /**
   * @param {{key?: string, path?: string, bookPath?: string}} book
   * @param {AbortSignal} [signal]
   * @returns {Promise<{units: Array, coverUrl: string, bookName: string, bookLevel: string}>}
   */
  async loadBook(book, signal) {
    const rawPath = book.path || '';
    const bookPath = rawPath.trim().replace(/\/$/, '');
    const response = await fetch(`${bookPath}/book.json`, { signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    const units = (Array.isArray(data.units) ? data.units : [])
      .filter((unit) => unit?.filename)
      .map((unit, index) => ({
        ...unit,
        id: index + 1,
        title: unit.title || `Unit ${index + 1}`,
        audio: `${bookPath}/${unit.filename}.mp3`,
        lrc: `${bookPath}/${unit.filename}.lrc`,
      }));

    return {
      units,
      coverUrl: data.cover ? `${bookPath}/${data.cover}` : '',
      bookName: data.name || book.title || '',
      bookLevel: data.level || book.key || '',
    };
  }
}
