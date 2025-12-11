import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 获取热门漫画
export const getHotComics = async (
  page = 1, 
  limit = 20, 
  source = null
) => {
  const params = { page, limit };
  if (source) params.source = source;
  return apiClient.get('/comics/hot', { params });
};

// 获取最新漫画
export const getLatestComics = async (
  page = 1, 
  limit = 20, 
  source = null
) => {
  const params = { page, limit };
  if (source) params.source = source;
  return apiClient.get('/comics/latest', { params });
};

// 搜索漫画
export const searchComics = async (
  keyword, 
  page = 1, 
  limit = 20, 
  source = null
) => {
  const params = { keyword, page, limit };
  if (source) params.source = source;
  return apiClient.get('/comics/search', { params });
};

// 获取漫画详情
export const getComicDetail = async (comicId, source = null) => {
  const params = {};
  if (source) params.source = source;
  return apiClient.get(`/comics/${comicId}`, { params });
};

// 获取章节列表
export const getChapters = async (comicId, source = null) => {
  const params = {};
  if (source) params.source = source;
  return apiClient.get(`/comics/${comicId}/chapters`, { params });
};

// 获取章节图片
export const getChapterImages = async (chapterId, source = null) => {
  const params = {};
  if (source) params.source = source;
  return apiClient.get(`/chapters/${chapterId}/images`, { params });
};

// 获取单页章节图片
export const getChapterImageByPage = async (chapterId, page, source = null) => {
  const params = {};
  if (source) params.source = source;
  return apiClient.get(`/chapters/${chapterId}/images/${page}`, { params });
};

// 获取分类漫画
export const getComicsByCategory = async (
  category, 
  page = 1, 
  limit = 20, 
  source = null
) => {
  const params = { category, page, limit };
  if (source) params.source = source;
  return apiClient.get('/comics/category', { params });
};

// 获取所有可用数据源
export const getAvailableSources = async () => {
  return apiClient.get('/sources');
};

// 获取分类列表
export const getCategories = async (source = null) => {
  const params = {};
  if (source) params.source = source;
  return apiClient.get('/categories', { params });
};

// ==================== 电子书 API ====================

// 获取电子书分类列表
export const getEbookCategories = async (source = null) => {
  const params = {};
  if (source) params.source = source;
  return apiClient.get('/ebooks/categories', { params });
};

// 获取分类下的电子书列表
export const getEbooksByCategory = async (
  categoryId,
  page = 1,
  limit = 20,
  source = null
) => {
  const params = { page, limit };
  if (source) params.source = source;
  return apiClient.get(`/ebooks/category/${categoryId}`, { params });
};

// 获取电子书详情
export const getEbookDetail = async (bookId, source = null) => {
  const params = {};
  if (source) params.source = source;
  return apiClient.get(`/ebooks/${bookId}`, { params });
};

// 获取电子书章节列表
export const getEbookChapters = async (bookId, source = null) => {
  const params = {};
  if (source) params.source = source;
  return apiClient.get(`/ebooks/${bookId}/chapters`, { params });
};

// 获取章节内容
export const getChapterContent = async (chapterId, source = null) => {
  const params = {};
  if (source) params.source = source;
  return apiClient.get(`/ebooks/chapters/${chapterId}/content`, { params });
};

// 搜索电子书
export const searchEbooks = async (
  keyword,
  page = 1,
  limit = 20,
  source = null
) => {
  const params = { keyword, page, limit };
  if (source) params.source = source;
  return apiClient.get('/ebooks/search', { params });
};

// 获取电子书数据源列表
export const getEbookSources = async () => {
  return apiClient.get('/ebooks/sources');
};

export default apiClient;
