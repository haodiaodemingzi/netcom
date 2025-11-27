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
    console.error('API Error:', error);
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

export default apiClient;
