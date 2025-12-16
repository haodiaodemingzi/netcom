import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

/**
 * 获取市场数据源列表
 * @param {string} category - 分类 (all, video, comic, ebook, novel, news)
 * @param {string} search - 搜索关键词
 * @returns {Promise<{success: boolean, data: Array, error?: string}>}
 */
export const getMarketSources = async (category = 'all', search = '', token = '') => {
  try {
    const params = { category };
    if (search) {
      params.search = search;
    }
    if (token) {
      params.token = token;
    }
    
    const response = await axios.get(`${API_BASE_URL}/market/sources`, { params });
    return {
      success: true,
      data: response.data.sources || [],
      total: response.data.total || 0,
    };
  } catch (error) {
    console.error('获取市场数据源失败:', error);
    return {
      success: false,
      data: [],
      total: 0,
      error: error.message,
    };
  }
};

/**
 * 激活数据源市场
 * @param {string} code - 激活码
 * @returns {Promise<{success: boolean, token?: string, message?: string}>}
 */
export const activateMarket = async (code) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/market/activate`, { code });
    return {
      success: true,
      token: response.data.token,
    };
  } catch (error) {
    const message = error?.response?.data?.message || '激活失败';
    return {
      success: false,
      message,
    };
  }
};

/**
 * 获取数据源详情
 * @param {string} sourceId - 数据源ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export const getSourceDetail = async (sourceId, token = '') => {
  try {
    const params = {};
    if (token) {
      params.token = token;
    }
    const response = await axios.get(`${API_BASE_URL}/market/sources/${sourceId}`, { params });
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('获取数据源详情失败:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * 获取市场分类列表
 * @returns {Promise<{success: boolean, data: Array, error?: string}>}
 */
export const getMarketCategories = async (token = '') => {
  try {
    const params = {};
    if (token) {
      params.token = token;
    }
    const response = await axios.get(`${API_BASE_URL}/market/categories`, { params });
    return {
      success: true,
      data: response.data.categories || [],
      total: response.data.total || 0,
    };
  } catch (error) {
    console.error('获取市场分类失败:', error);
    return {
      success: false,
      data: [],
      total: 0,
      error: error.message,
    };
  }
};

