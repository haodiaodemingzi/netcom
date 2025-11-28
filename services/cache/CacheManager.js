import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 缓存管理器
 * 提供数据缓存功能，减少网络请求
 */
class CacheManager {
  constructor() {
    this.prefix = '@comic_cache_';
    
    // 缓存时间配置（单位：秒）
    this.cacheDuration = {
      hot: 300,           // 热门漫画: 5分钟
      latest: 300,        // 最新漫画: 5分钟
      category: 300,      // 分类漫画: 5分钟
      search: 600,        // 搜索结果: 10分钟
      detail: 1800,       // 漫画详情: 30分钟
      chapters: 1800,     // 章节列表: 30分钟
      images: 3600,       // 章节图片: 1小时
      categories: 86400,  // 分类列表: 1天
    };
  }

  /**
   * 生成缓存键
   * @param {string} type - 缓存类型
   * @param {object} params - 参数对象
   * @returns {string} - 缓存键
   */
  generateKey(type, params) {
    const paramStr = JSON.stringify(params);
    return `${this.prefix}${type}_${paramStr}`;
  }

  /**
   * 获取缓存数据
   * @param {string} type - 缓存类型
   * @param {object} params - 参数对象
   * @returns {Promise<any|null>} - 缓存数据或null
   */
  async get(type, params) {
    try {
      const key = this.generateKey(type, params);
      const cached = await AsyncStorage.getItem(key);

      if (!cached) {
        console.log(`[Cache] MISS - ${type}:`, params);
        return null;
      }

      const data = JSON.parse(cached);
      const now = Date.now();

      // 检查是否过期
      if (now > data.expireAt) {
        console.log(`[Cache] EXPIRED - ${type}:`, params);
        await this.remove(type, params);
        return null;
      }

      console.log(`[Cache] HIT - ${type}:`, params);
      return data.value;
    } catch (error) {
      console.error('[Cache] 读取失败:', error);
      return null;
    }
  }

  /**
   * 设置缓存数据
   * @param {string} type - 缓存类型
   * @param {object} params - 参数对象
   * @param {any} value - 要缓存的数据
   * @returns {Promise<void>}
   */
  async set(type, params, value) {
    try {
      const key = this.generateKey(type, params);
      const duration = this.cacheDuration[type] || 300; // 默认5分钟
      const expireAt = Date.now() + duration * 1000;

      const data = {
        value,
        expireAt,
        createdAt: Date.now(),
      };

      await AsyncStorage.setItem(key, JSON.stringify(data));
      console.log(`[Cache] SET - ${type}:`, params, `(${duration}s)`);
    } catch (error) {
      console.error('[Cache] 写入失败:', error);
    }
  }

  /**
   * 移除缓存数据
   * @param {string} type - 缓存类型
   * @param {object} params - 参数对象
   * @returns {Promise<void>}
   */
  async remove(type, params) {
    try {
      const key = this.generateKey(type, params);
      await AsyncStorage.removeItem(key);
      console.log(`[Cache] REMOVE - ${type}:`, params);
    } catch (error) {
      console.error('[Cache] 删除失败:', error);
    }
  }

  /**
   * 清除所有缓存
   * @returns {Promise<void>}
   */
  async clearAll() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.prefix));

      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
        console.log(`[Cache] CLEAR ALL - 清除了 ${cacheKeys.length} 个缓存`);
      }
    } catch (error) {
      console.error('[Cache] 清除全部失败:', error);
    }
  }

  /**
   * 清除过期缓存
   * @returns {Promise<void>}
   */
  async clearExpired() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.prefix));

      let removedCount = 0;
      const now = Date.now();

      for (const key of cacheKeys) {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          const data = JSON.parse(cached);
          if (now > data.expireAt) {
            await AsyncStorage.removeItem(key);
            removedCount++;
          }
        }
      }

      if (removedCount > 0) {
        console.log(`[Cache] CLEAR EXPIRED - 清除了 ${removedCount} 个过期缓存`);
      }
    } catch (error) {
      console.error('[Cache] 清除过期缓存失败:', error);
    }
  }

  /**
   * 获取缓存统计信息
   * @returns {Promise<object>} - 缓存统计
   */
  async getStats() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.prefix));

      let totalSize = 0;
      let expiredCount = 0;
      const now = Date.now();

      for (const key of cacheKeys) {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          totalSize += cached.length;
          const data = JSON.parse(cached);
          if (now > data.expireAt) {
            expiredCount++;
          }
        }
      }

      return {
        total: cacheKeys.length,
        expired: expiredCount,
        active: cacheKeys.length - expiredCount,
        size: totalSize,
        sizeKB: (totalSize / 1024).toFixed(2),
        sizeMB: (totalSize / 1024 / 1024).toFixed(2),
      };
    } catch (error) {
      console.error('[Cache] 获取统计信息失败:', error);
      return {
        total: 0,
        expired: 0,
        active: 0,
        size: 0,
        sizeKB: '0',
        sizeMB: '0',
      };
    }
  }

  /**
   * 包装异步函数，自动缓存结果
   * @param {string} type - 缓存类型
   * @param {object} params - 参数对象
   * @param {Function} fetchFn - 获取数据的函数
   * @returns {Promise<any>} - 数据
   */
  async wrap(type, params, fetchFn) {
    // 先尝试从缓存获取
    const cached = await this.get(type, params);
    if (cached !== null) {
      return cached;
    }

    // 缓存未命中，执行获取函数
    const data = await fetchFn();

    // 保存到缓存
    if (data !== null && data !== undefined) {
      await this.set(type, params, data);
    }

    return data;
  }
}

// 导出单例
export default new CacheManager();
