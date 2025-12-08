import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';
import { 
  mockSeriesList, 
  mockEpisodes, 
  mockPlaybackProgress,
  mockVideoCategories,
  mockVideoSources,
} from './mockVideoData';

// 数据源配置
let currentDataSource = 'api'; // 'mock' 或 'api'
let currentSource = 'thanju'; // 当前选择的视频源

export const setVideoDataSource = (source) => {
  currentDataSource = source;
  console.log(`视频数据源已切换为: ${source}`);
};

export const getVideoDataSource = () => currentDataSource;

export const setCurrentVideoSource = (source) => {
  currentSource = source;
  console.log(`当前视频源已切换为: ${source}`);
};

export const getCurrentVideoSource = () => currentSource;

// 获取视频分类列表
export const getVideoCategories = async (source = null) => {
  try {
    if (currentDataSource === 'mock') {
      await new Promise(resolve => setTimeout(resolve, 200));
      return {
        success: true,
        data: mockVideoCategories,
        source: 'mock',
      };
    } else {
      const params = {};
      if (source) params.source = source;
      const response = await axios.get(`${API_BASE_URL}/videos/categories`, { params });
      return {
        success: true,
        data: response.data,
        source: 'api',
      };
    }
  } catch (error) {
    console.error('获取视频分类失败:', error);
    return {
      success: false,
      data: [],
      error: error.message,
    };
  }
};

// 获取视频数据源列表
export const getVideoSources = async () => {
  try {
    if (currentDataSource === 'mock') {
      await new Promise(resolve => setTimeout(resolve, 200));
      return {
        success: true,
        data: mockVideoSources,
        source: 'mock',
      };
    } else {
      const response = await axios.get(`${API_BASE_URL}/videos/sources`);
      // 后端返回格式: { sources: { thanju: { name: '...', description: '...' } } }
      // 转换为前端需要的格式: { thanju: { name: '...', description: '...' } }
      const sourcesData = response.data.sources || response.data;
      return {
        success: true,
        data: sourcesData,
        source: 'api',
      };
    }
  } catch (error) {
    console.error('获取视频数据源失败:', error);
    return {
      success: false,
      data: {},
      error: error.message,
    };
  }
};

// 获取短剧列表（支持分类和分页）
export const getSeriesList = async (category = 'hot', page = 1, limit = 20, source = null) => {
  try {
    if (currentDataSource === 'mock') {
      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, 500));
      let filteredList = [...mockSeriesList];
      
      // 按分类过滤
      if (category === 'hot') {
        // 热门：按评分排序
        filteredList = filteredList.sort((a, b) => b.rating - a.rating);
      } else if (category === 'latest') {
        // 最新：按ID倒序
        filteredList = filteredList.reverse();
      } else {
        // 其他分类
        filteredList = filteredList.filter(item => item.category === category);
      }
      
      // 分页
      const start = (page - 1) * limit;
      const end = start + limit;
      const paginatedList = filteredList.slice(start, end);
      
      return {
        success: true,
        data: paginatedList,
        hasMore: end < filteredList.length,
        total: filteredList.length,
        source: 'mock',
      };
    } else {
      const params = { category, page, limit };
      if (source) params.source = source;
      const response = await axios.get(`${API_BASE_URL}/videos/series`, { params });
      return {
        success: true,
        data: response.data.series || response.data,
        hasMore: response.data.hasMore || false,
        total: response.data.total || 0,
        source: 'api',
      };
    }
  } catch (error) {
    console.error('获取短剧列表失败:', error);
    return {
      success: false,
      data: [],
      hasMore: false,
      total: 0,
      error: error.message,
    };
  }
};

// 搜索视频
export const searchVideos = async (keyword, page = 1, limit = 20, source = null) => {
  try {
    if (currentDataSource === 'mock') {
      await new Promise(resolve => setTimeout(resolve, 500));
      const filteredList = mockSeriesList.filter(item => 
        item.title.includes(keyword) || item.description.includes(keyword)
      );
      
      const start = (page - 1) * limit;
      const end = start + limit;
      const paginatedList = filteredList.slice(start, end);
      
      return {
        success: true,
        data: paginatedList,
        hasMore: end < filteredList.length,
        total: filteredList.length,
        source: 'mock',
      };
    } else {
      const params = { keyword, page, limit };
      if (source) params.source = source;
      const response = await axios.get(`${API_BASE_URL}/videos/search`, { params });
      return {
        success: true,
        data: response.data.series || response.data,
        hasMore: response.data.hasMore || false,
        total: response.data.total || 0,
        source: 'api',
      };
    }
  } catch (error) {
    console.error('搜索视频失败:', error);
    return {
      success: false,
      data: [],
      hasMore: false,
      total: 0,
      error: error.message,
    };
  }
};

// 获取短剧详情
export const getSeriesDetail = async (seriesId) => {
  try {
    if (currentDataSource === 'mock') {
      await new Promise(resolve => setTimeout(resolve, 300));
      const series = mockSeriesList.find(s => s.id === seriesId);
      if (!series) {
        throw new Error('短剧不存在');
      }
      return {
        success: true,
        data: series,
        source: 'mock',
      };
    } else {
      const params = {};
      if (currentSource) params.source = currentSource;
      const response = await axios.get(`${API_BASE_URL}/videos/series/${seriesId}`, { params });
      return {
        success: true,
        data: response.data,
        source: 'api',
      };
    }
  } catch (error) {
    console.error('获取短剧详情失败:', error);
    return {
      success: false,
      data: null,
      error: error.message,
    };
  }
};

// 获取剧集列表
export const getEpisodes = async (seriesId) => {
  try {
    if (currentDataSource === 'mock') {
      await new Promise(resolve => setTimeout(resolve, 300));
      const episodes = mockEpisodes[seriesId] || [];
      return {
        success: true,
        data: episodes,
        source: 'mock',
      };
    } else {
      const params = {};
      if (currentSource) params.source = currentSource;
      const response = await axios.get(`${API_BASE_URL}/videos/series/${seriesId}/episodes`, { params });
      return {
        success: true,
        data: response.data,
        source: 'api',
      };
    }
  } catch (error) {
    console.error('获取剧集列表失败:', error);
    return {
      success: false,
      data: [],
      error: error.message,
    };
  }
};

// 获取单个剧集详情
export const getEpisodeDetail = async (episodeId) => {
  try {
    if (currentDataSource === 'mock') {
      await new Promise(resolve => setTimeout(resolve, 200));
      for (const episodes of Object.values(mockEpisodes)) {
        const episode = episodes.find(e => e.id === episodeId);
        if (episode) {
          return {
            success: true,
            data: episode,
            source: 'mock',
          };
        }
      }
      throw new Error('剧集不存在');
    } else {
      console.log('=== 调用后端API获取剧集详情 ===');
      console.log('剧集ID:', episodeId);
      console.log('数据源:', currentSource);
      console.log('API地址:', `${API_BASE_URL}/videos/episodes/${episodeId}`);
      
      const params = {};
      if (currentSource) params.source = currentSource;
      
      console.log('请求参数:', params);
      const response = await axios.get(`${API_BASE_URL}/videos/episodes/${episodeId}`, { params });
      console.log('后端API响应状态:', response.status);
      console.log('后端API响应数据:', response.data);
      
      // 如果返回的视频URL是外部链接，转换为代理URL
      if (response.data) {
        console.log('后端返回的完整数据:', response.data);
        console.log('videoUrl值:', response.data.videoUrl);
        console.log('videoUrl类型:', typeof response.data.videoUrl);
        console.log('videoUrl是否为null:', response.data.videoUrl === null);
        console.log('videoUrl是否为空字符串:', response.data.videoUrl === '');
        console.log('videoUrl是否存在:', !!response.data.videoUrl);
        
        // 注意：这里不再转换URL，保持原始URL
        // URL转换和本地视频检查将在 videoPlayerService 中统一处理
        if (response.data.videoUrl) {
          console.log('原始视频URL:', response.data.videoUrl);
        } else {
          console.warn('=== 后端返回的数据中没有videoUrl ===');
          console.warn('返回的数据:', JSON.stringify(response.data, null, 2));
          console.warn('playUrl:', response.data.playUrl);
          console.warn('可能原因: 播放页面返回错误或解析失败');
        }
      } else {
        console.error('后端返回的数据为空');
      }
      
      return {
        success: true,
        data: response.data,
        source: 'api',
      };
    }
  } catch (error) {
    console.error('获取剧集详情失败:', error);
    return {
      success: false,
      data: null,
      error: error.message,
    };
  }
};

// 获取播放进度
export const getPlaybackProgress = async (episodeId) => {
  try {
    if (currentDataSource === 'mock') {
      await new Promise(resolve => setTimeout(resolve, 100));
      return {
        success: true,
        data: mockPlaybackProgress[episodeId] || null,
        source: 'mock',
      };
    } else {
      const response = await axios.get(`${API_BASE_URL}/api/playback-progress/${episodeId}`);
      return {
        success: true,
        data: response.data,
        source: 'api',
      };
    }
  } catch (error) {
    console.error('获取播放进度失败:', error);
    return {
      success: false,
      data: null,
      error: error.message,
    };
  }
};

// 保存播放进度
export const savePlaybackProgress = async (episodeId, currentTime, duration) => {
  try {
    if (currentDataSource === 'mock') {
      await new Promise(resolve => setTimeout(resolve, 100));
      mockPlaybackProgress[episodeId] = {
        episodeId,
        currentTime,
        duration,
        lastWatchedAt: new Date().toISOString(),
      };
      console.log(`播放进度已保存: ${episodeId} - ${currentTime}/${duration}`);
      return {
        success: true,
        source: 'mock',
      };
    } else {
      const response = await axios.post(`${API_BASE_URL}/api/playback-progress`, {
        episodeId,
        currentTime,
        duration,
      });
      return {
        success: true,
        source: 'api',
      };
    }
  } catch (error) {
    console.error('保存播放进度失败:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// 获取视频标签列表（热搜标签）
export const getVideoTags = async (source = null, limit = 100) => {
  try {
    const params = { limit };
    if (source) params.source = source;
    const response = await axios.get(`${API_BASE_URL}/videos/tags`, { params });
    return {
      success: true,
      data: response.data.tags || [],
      total: response.data.total || 0,
    };
  } catch (error) {
    console.error('获取视频标签失败:', error);
    return {
      success: false,
      data: [],
      total: 0,
      error: error.message,
    };
  }
};

// 根据标签获取视频列表
export const getVideosByTag = async (tagId, page = 1, limit = 30, source = null) => {
  try {
    const params = { page, limit };
    if (source) params.source = source;
    const response = await axios.get(`${API_BASE_URL}/videos/tags/${encodeURIComponent(tagId)}`, { params });
    return {
      success: true,
      data: response.data.series || [],
      hasMore: response.data.hasMore || false,
      total: response.data.total || 0,
    };
  } catch (error) {
    console.error('根据标签获取视频失败:', error);
    return {
      success: false,
      data: [],
      hasMore: false,
      total: 0,
      error: error.message,
    };
  }
};
