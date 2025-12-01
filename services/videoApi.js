import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';
import { mockSeriesList, mockEpisodes, mockPlaybackProgress } from './mockVideoData';

// 数据源配置
let currentDataSource = 'mock'; // 'mock' 或 'api'

export const setVideoDataSource = (source) => {
  currentDataSource = source;
  console.log(`视频数据源已切换为: ${source}`);
};

export const getVideoDataSource = () => currentDataSource;

// 获取短剧列表
export const getSeriesList = async () => {
  try {
    if (currentDataSource === 'mock') {
      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, 500));
      return {
        success: true,
        data: mockSeriesList,
        source: 'mock',
      };
    } else {
      // 真实 API 调用
      const response = await axios.get(`${API_BASE_URL}/api/series`);
      return {
        success: true,
        data: response.data,
        source: 'api',
      };
    }
  } catch (error) {
    console.error('获取短剧列表失败:', error);
    return {
      success: false,
      data: [],
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
      const response = await axios.get(`${API_BASE_URL}/api/series/${seriesId}`);
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
      const response = await axios.get(`${API_BASE_URL}/api/series/${seriesId}/episodes`);
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
      const response = await axios.get(`${API_BASE_URL}/api/episodes/${episodeId}`);
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
