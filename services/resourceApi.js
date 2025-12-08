/**
 * 统一资源API客户端
 * 提供comic/video/ebook三种资源类型的统一访问接口
 */
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

// 资源类型枚举
export const ResourceType = {
  COMIC: 'comics',
  VIDEO: 'videos',
  EBOOK: 'ebooks',
};

// 创建axios实例
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 响应拦截器 - 统一处理响应
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const errorMessage = error.response?.data?.error || error.message || '请求失败';
    console.error(`API Error: ${errorMessage}`);
    return Promise.reject(new Error(errorMessage));
  }
);

/**
 * 构建请求参数 - 统一参数处理
 */
const buildParams = (options = {}) => {
  const params = {};
  
  if (options.source) params.source = options.source;
  if (options.page) params.page = options.page;
  if (options.limit) params.limit = options.limit;
  if (options.category) params.category = options.category;
  if (options.keyword) params.keyword = options.keyword;
  
  // 添加其他自定义参数
  if (options.extra) {
    Object.assign(params, options.extra);
  }
  
  return params;
};

/**
 * 统一响应格式化
 */
const formatResponse = (data, options = {}) => {
  return {
    success: true,
    data: data,
    ...options,
  };
};

/**
 * 统一错误响应
 */
const formatError = (error, defaultData = null) => {
  return {
    success: false,
    data: defaultData,
    error: error.message || '请求失败',
  };
};

// ==================== 通用资源API ====================

/**
 * 获取资源数据源列表
 * @param {string} resourceType - 资源类型 (comics/videos/ebooks)
 */
export const getSources = async (resourceType) => {
  try {
    const response = await apiClient.get(`/${resourceType}/sources`);
    return formatResponse(response.sources || response);
  } catch (error) {
    return formatError(error, {});
  }
};

/**
 * 获取资源分类列表
 * @param {string} resourceType - 资源类型
 * @param {object} options - 可选参数 { source }
 */
export const getCategories = async (resourceType, options = {}) => {
  try {
    const params = buildParams(options);
    const response = await apiClient.get(`/${resourceType}/categories`, { params });
    return formatResponse(response.categories || response);
  } catch (error) {
    return formatError(error, []);
  }
};

/**
 * 获取资源列表
 * @param {string} resourceType - 资源类型
 * @param {object} options - { category, page, limit, source }
 */
export const getList = async (resourceType, options = {}) => {
  try {
    const params = buildParams({
      page: options.page || 1,
      limit: options.limit || 20,
      ...options,
    });
    
    let endpoint = `/${resourceType}`;
    if (options.category) {
      endpoint = `/${resourceType}/category`;
    } else if (options.listType === 'hot') {
      endpoint = `/${resourceType}/hot`;
    } else if (options.listType === 'latest') {
      endpoint = `/${resourceType}/latest`;
    }
    
    const response = await apiClient.get(endpoint, { params });
    
    // 处理不同资源类型的响应格式
    const dataKey = resourceType === 'videos' ? 'series' : resourceType;
    const items = response[dataKey] || response.data || response;
    
    return formatResponse(items, {
      hasMore: response.hasMore || false,
      total: response.total || 0,
    });
  } catch (error) {
    return formatError(error, []);
  }
};

/**
 * 获取资源详情
 * @param {string} resourceType - 资源类型
 * @param {string} id - 资源ID
 * @param {object} options - { source }
 */
export const getDetail = async (resourceType, id, options = {}) => {
  try {
    const params = buildParams(options);
    
    let endpoint = `/${resourceType}/${id}`;
    if (resourceType === 'videos') {
      endpoint = `/videos/series/${id}`;
    }
    
    const response = await apiClient.get(endpoint, { params });
    return formatResponse(response);
  } catch (error) {
    return formatError(error, null);
  }
};

/**
 * 获取章节/剧集列表
 * @param {string} resourceType - 资源类型
 * @param {string} id - 资源ID
 * @param {object} options - { source }
 */
export const getChapters = async (resourceType, id, options = {}) => {
  try {
    const params = buildParams(options);
    
    let endpoint;
    if (resourceType === 'videos') {
      endpoint = `/videos/series/${id}/episodes`;
    } else {
      endpoint = `/${resourceType}/${id}/chapters`;
    }
    
    const response = await apiClient.get(endpoint, { params });
    return formatResponse(response.chapters || response.episodes || response);
  } catch (error) {
    return formatError(error, []);
  }
};

/**
 * 获取章节/剧集内容
 * @param {string} resourceType - 资源类型
 * @param {string} chapterId - 章节ID
 * @param {object} options - { source, page }
 */
export const getChapterContent = async (resourceType, chapterId, options = {}) => {
  try {
    const params = buildParams(options);
    
    let endpoint;
    if (resourceType === 'comics') {
      endpoint = options.page 
        ? `/chapters/${chapterId}/images/${options.page}`
        : `/chapters/${chapterId}/images`;
    } else if (resourceType === 'videos') {
      endpoint = `/videos/episodes/${chapterId}`;
    } else {
      endpoint = `/ebooks/chapters/${chapterId}/content`;
    }
    
    const response = await apiClient.get(endpoint, { params });
    return formatResponse(response);
  } catch (error) {
    return formatError(error, null);
  }
};

/**
 * 搜索资源
 * @param {string} resourceType - 资源类型
 * @param {string} keyword - 搜索关键词
 * @param {object} options - { page, limit, source }
 */
export const search = async (resourceType, keyword, options = {}) => {
  try {
    const params = buildParams({
      keyword,
      page: options.page || 1,
      limit: options.limit || 20,
      ...options,
    });
    
    const response = await apiClient.get(`/${resourceType}/search`, { params });
    
    const dataKey = resourceType === 'videos' ? 'series' : resourceType;
    const items = response[dataKey] || response.data || response;
    
    return formatResponse(items, {
      hasMore: response.hasMore || false,
      total: response.total || 0,
    });
  } catch (error) {
    return formatError(error, []);
  }
};

// ==================== 便捷方法 ====================

// 漫画相关
export const comicApi = {
  getSources: () => getSources(ResourceType.COMIC),
  getCategories: (options) => getCategories(ResourceType.COMIC, options),
  getList: (options) => getList(ResourceType.COMIC, options),
  getHot: (options) => getList(ResourceType.COMIC, { ...options, listType: 'hot' }),
  getLatest: (options) => getList(ResourceType.COMIC, { ...options, listType: 'latest' }),
  getDetail: (id, options) => getDetail(ResourceType.COMIC, id, options),
  getChapters: (id, options) => getChapters(ResourceType.COMIC, id, options),
  getChapterImages: (chapterId, options) => getChapterContent(ResourceType.COMIC, chapterId, options),
  search: (keyword, options) => search(ResourceType.COMIC, keyword, options),
};

// 视频相关
export const videoApi = {
  getSources: () => getSources(ResourceType.VIDEO),
  getCategories: (options) => getCategories(ResourceType.VIDEO, options),
  getList: (options) => getList(ResourceType.VIDEO, options),
  getSeriesList: (category, page, limit, source) => getList(ResourceType.VIDEO, { category, page, limit, source }),
  getDetail: (id, options) => getDetail(ResourceType.VIDEO, id, options),
  getEpisodes: (id, options) => getChapters(ResourceType.VIDEO, id, options),
  getEpisodeDetail: (episodeId, options) => getChapterContent(ResourceType.VIDEO, episodeId, options),
  search: (keyword, options) => search(ResourceType.VIDEO, keyword, options),
};

// 电子书相关
export const ebookApi = {
  getSources: () => getSources(ResourceType.EBOOK),
  getCategories: (options) => getCategories(ResourceType.EBOOK, options),
  getList: (options) => getList(ResourceType.EBOOK, options),
  getDetail: (id, options) => getDetail(ResourceType.EBOOK, id, options),
  getChapters: (id, options) => getChapters(ResourceType.EBOOK, id, options),
  getChapterContent: (chapterId, options) => getChapterContent(ResourceType.EBOOK, chapterId, options),
  search: (keyword, options) => search(ResourceType.EBOOK, keyword, options),
};

// 默认导出
export default {
  ResourceType,
  getSources,
  getCategories,
  getList,
  getDetail,
  getChapters,
  getChapterContent,
  search,
  comicApi,
  videoApi,
  ebookApi,
};
