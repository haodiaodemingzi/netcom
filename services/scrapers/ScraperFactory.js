import { XmanhuaScraper } from './XmanhuaScraper';
import { Guoman8Scraper } from './Guoman8Scraper';
import { COMIC_SOURCES, DEFAULT_SOURCE } from './config';

/**
 * 爬虫工厂类
 * 根据数据源创建对应的爬虫实例
 */
class ScraperFactory {
  constructor() {
    // 爬虫类映射
    this.scrapers = {
      xmanhua: XmanhuaScraper,
      guoman8: Guoman8Scraper,
    };

    // 爬虫实例缓存 (单例模式)
    this.instances = {};
  }

  /**
   * 获取爬虫实例
   * @param {string} source - 数据源ID
   * @returns {BaseScraper} - 爬虫实例
   */
  getScraper(source = null) {
    // 使用默认数据源
    if (!source) {
      source = DEFAULT_SOURCE;
    }

    // 检查数据源是否存在且启用
    if (!COMIC_SOURCES[source]) {
      throw new Error(`未知的数据源: ${source}`);
    }

    if (!COMIC_SOURCES[source].enabled) {
      throw new Error(`数据源已禁用: ${source}`);
    }

    // 单例模式，避免重复创建
    if (!this.instances[source]) {
      const ScraperClass = this.scrapers[source];
      if (!ScraperClass) {
        throw new Error(`数据源未实现: ${source}`);
      }

      console.log(`创建爬虫实例: ${COMIC_SOURCES[source].name}`);
      this.instances[source] = new ScraperClass();
    }

    return this.instances[source];
  }

  /**
   * 获取所有可用的数据源
   * @returns {object} - 数据源列表
   */
  getAvailableSources() {
    const sources = {};
    
    for (const [key, value] of Object.entries(COMIC_SOURCES)) {
      if (value.enabled) {
        sources[key] = {
          name: value.name,
          description: value.description,
          enabled: value.enabled,
        };
      }
    }

    return sources;
  }
}

// 导出单例
export default new ScraperFactory();
