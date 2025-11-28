import ScraperFactory from './scrapers/ScraperFactory';
import CacheManager from './cache/CacheManager';

/**
 * API服务层
 * 直接调用爬虫获取数据，带缓存支持
 */

// 获取热门漫画
export const getHotComics = async (
  page = 1, 
  limit = 20, 
  source = null
) => {
  try {
    console.log(`[API] 获取热门漫画 - page: ${page}, limit: ${limit}, source: ${source}`);
    
    const cacheKey = { type: 'hot', page, limit, source };
    return await CacheManager.wrap('hot', cacheKey, async () => {
      const scraper = ScraperFactory.getScraper(source);
      return await scraper.getHotComics(page, limit);
    });
  } catch (error) {
    console.error('获取热门漫画失败:', error);
    throw error;
  }
};

// 获取最新漫画
export const getLatestComics = async (
  page = 1, 
  limit = 20, 
  source = null
) => {
  try {
    console.log(`[API] 获取最新漫画 - page: ${page}, limit: ${limit}, source: ${source}`);
    
    const cacheKey = { type: 'latest', page, limit, source };
    return await CacheManager.wrap('latest', cacheKey, async () => {
      const scraper = ScraperFactory.getScraper(source);
      return await scraper.getLatestComics(page, limit);
    });
  } catch (error) {
    console.error('获取最新漫画失败:', error);
    throw error;
  }
};

// 搜索漫画
export const searchComics = async (
  keyword, 
  page = 1, 
  limit = 20, 
  source = null
) => {
  try {
    console.log(`[API] 搜索漫画 - keyword: ${keyword}, page: ${page}, source: ${source}`);
    
    const cacheKey = { type: 'search', keyword, page, limit, source };
    return await CacheManager.wrap('search', cacheKey, async () => {
      const scraper = ScraperFactory.getScraper(source);
      return await scraper.searchComics(keyword, page, limit);
    });
  } catch (error) {
    console.error('搜索漫画失败:', error);
    throw error;
  }
};

// 获取漫画详情
export const getComicDetail = async (comicId, source = null) => {
  try {
    console.log(`[API] 获取漫画详情 - comicId: ${comicId}, source: ${source}`);
    
    const cacheKey = { type: 'detail', comicId, source };
    return await CacheManager.wrap('detail', cacheKey, async () => {
      const scraper = ScraperFactory.getScraper(source);
      return await scraper.getComicDetail(comicId);
    });
  } catch (error) {
    console.error('获取漫画详情失败:', error);
    throw error;
  }
};

// 获取章节列表
export const getChapters = async (comicId, source = null) => {
  try {
    console.log(`[API] 获取章节列表 - comicId: ${comicId}, source: ${source}`);
    
    const cacheKey = { type: 'chapters', comicId, source };
    return await CacheManager.wrap('chapters', cacheKey, async () => {
      const scraper = ScraperFactory.getScraper(source);
      return await scraper.getChapters(comicId);
    });
  } catch (error) {
    console.error('获取章节列表失败:', error);
    throw error;
  }
};

// 获取章节图片
export const getChapterImages = async (chapterId, source = null) => {
  try {
    console.log(`[API] 获取章节图片 - chapterId: ${chapterId}, source: ${source}`);
    
    const cacheKey = { type: 'images', chapterId, source };
    return await CacheManager.wrap('images', cacheKey, async () => {
      const scraper = ScraperFactory.getScraper(source);
      return await scraper.getChapterImages(chapterId);
    });
  } catch (error) {
    console.error('获取章节图片失败:', error);
    throw error;
  }
};

// 获取分类漫画
export const getComicsByCategory = async (
  category, 
  page = 1, 
  limit = 20, 
  source = null
) => {
  try {
    console.log(`[API] 获取分类漫画 - category: ${category}, page: ${page}, source: ${source}`);
    
    const cacheKey = { type: 'category', category, page, limit, source };
    return await CacheManager.wrap('category', cacheKey, async () => {
      const scraper = ScraperFactory.getScraper(source);
      return await scraper.getComicsByCategory(category, page, limit);
    });
  } catch (error) {
    console.error('获取分类漫画失败:', error);
    throw error;
  }
};

// 获取所有可用数据源
export const getAvailableSources = async () => {
  try {
    console.log('[API] 获取可用数据源');
    return ScraperFactory.getAvailableSources();
  } catch (error) {
    console.error('获取可用数据源失败:', error);
    throw error;
  }
};

// 获取分类列表
export const getCategories = async (source = null) => {
  try {
    console.log(`[API] 获取分类列表 - source: ${source}`);
    
    const cacheKey = { type: 'categories', source };
    return await CacheManager.wrap('categories', cacheKey, async () => {
      const scraper = ScraperFactory.getScraper(source);
      return await scraper.getCategories();
    });
  } catch (error) {
    console.error('获取分类列表失败:', error);
    throw error;
  }
};
