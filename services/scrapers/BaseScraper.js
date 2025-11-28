import axios from 'axios';
import { getProxyConfig } from './proxyConfig';
import { REQUEST_CONFIG } from './config';
import CacheManager from '../cache/CacheManager';

/**
 * 基础爬虫类
 * 所有爬虫都应该继承此类
 */
export class BaseScraper {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cache = CacheManager;
    this.enableCache = true; // 默认启用缓存
  }

  /**
   * 发起HTTP请求
   * @param {string} url - 请求URL
   * @param {object} options - 请求选项
   * @returns {Promise} - 响应数据
   */
  async makeRequest(url, options = {}) {
    try {
      // 获取代理配置
      const proxyConfig = await getProxyConfig();
      
      const requestOptions = {
        timeout: REQUEST_CONFIG.timeout,
        headers: {
          ...REQUEST_CONFIG.headers,
          ...options.headers,
        },
        ...options,
      };

      // 如果启用代理且配置了代理地址
      if (proxyConfig.enabled && proxyConfig.host && proxyConfig.port) {
        console.log(`使用代理: ${proxyConfig.type}://${proxyConfig.host}:${proxyConfig.port}`);
        requestOptions.proxy = {
          host: proxyConfig.host,
          port: parseInt(proxyConfig.port, 10),
          protocol: proxyConfig.type,
        };
      }

      console.log(`请求URL: ${url}`);
      const response = await axios.get(url, requestOptions);
      return response;
    } catch (error) {
      console.error(`请求失败: ${url}`, error.message);
      throw error;
    }
  }

  /**
   * 获取热门漫画
   * 子类必须实现此方法
   */
  async getHotComics(page, limit) {
    throw new Error('子类必须实现 getHotComics 方法');
  }

  /**
   * 获取最新漫画
   * 子类必须实现此方法
   */
  async getLatestComics(page, limit) {
    throw new Error('子类必须实现 getLatestComics 方法');
  }

  /**
   * 根据分类获取漫画
   * 子类必须实现此方法
   */
  async getComicsByCategory(categoryId, page, limit) {
    throw new Error('子类必须实现 getComicsByCategory 方法');
  }

  /**
   * 搜索漫画
   * 子类必须实现此方法
   */
  async searchComics(keyword, page, limit) {
    throw new Error('子类必须实现 searchComics 方法');
  }

  /**
   * 获取漫画详情
   * 子类必须实现此方法
   */
  async getComicDetail(comicId) {
    throw new Error('子类必须实现 getComicDetail 方法');
  }

  /**
   * 获取章节列表
   * 子类必须实现此方法
   */
  async getChapters(comicId) {
    throw new Error('子类必须实现 getChapters 方法');
  }

  /**
   * 获取章节图片列表
   * 子类必须实现此方法
   */
  async getChapterImages(chapterId) {
    throw new Error('子类必须实现 getChapterImages 方法');
  }

  /**
   * 获取分类列表
   * 子类必须实现此方法
   */
  async getCategories() {
    throw new Error('子类必须实现 getCategories 方法');
  }
}
