import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';
import { mockNovelList, mockNovelChapters, mockReadingProgress } from './mockNovelData';

let currentDataSource = 'mock';

export const setNovelDataSource = (source) => {
  currentDataSource = source;
};

export const getNovelDataSource = () => currentDataSource;

// 获取小说列表
export const getNovelList = async () => {
  try {
    if (currentDataSource === 'mock') {
      await new Promise(resolve => setTimeout(resolve, 500));
      return {
        success: true,
        data: mockNovelList,
        source: 'mock',
      };
    } else {
      const response = await axios.get(`${API_BASE_URL}/api/novels`);
      return {
        success: true,
        data: response.data,
        source: 'api',
      };
    }
  } catch (error) {
    console.error('获取小说列表失败:', error.message);
    return {
      success: false,
      data: [],
      error: error.message,
    };
  }
};

// 获取小说详情
export const getNovelDetail = async (novelId) => {
  try {
    if (currentDataSource === 'mock') {
      await new Promise(resolve => setTimeout(resolve, 300));
      const novel = mockNovelList.find(n => n.id === novelId);
      if (!novel) {
        throw new Error('小说不存在');
      }
      return {
        success: true,
        data: novel,
        source: 'mock',
      };
    } else {
      const response = await axios.get(`${API_BASE_URL}/api/novels/${novelId}`);
      return {
        success: true,
        data: response.data,
        source: 'api',
      };
    }
  } catch (error) {
    console.error('获取小说详情失败:', error.message);
    return {
      success: false,
      data: null,
      error: error.message,
    };
  }
};

// 获取章节列表
export const getNovelChapters = async (novelId) => {
  try {
    if (currentDataSource === 'mock') {
      await new Promise(resolve => setTimeout(resolve, 300));
      const chapters = mockNovelChapters[novelId] || [];
      return {
        success: true,
        data: chapters,
        source: 'mock',
      };
    } else {
      const response = await axios.get(`${API_BASE_URL}/api/novels/${novelId}/chapters`);
      return {
        success: true,
        data: response.data,
        source: 'api',
      };
    }
  } catch (error) {
    console.error('获取章节列表失败:', error.message);
    return {
      success: false,
      data: [],
      error: error.message,
    };
  }
};

// 获取章节内容
export const getChapterContent = async (chapterId) => {
  try {
    if (currentDataSource === 'mock') {
      await new Promise(resolve => setTimeout(resolve, 200));
      for (const chapters of Object.values(mockNovelChapters)) {
        const chapter = chapters.find(c => c.id === chapterId);
        if (chapter) {
          return {
            success: true,
            data: chapter,
            source: 'mock',
          };
        }
      }
      throw new Error('章节不存在');
    } else {
      const response = await axios.get(`${API_BASE_URL}/api/chapters/${chapterId}`);
      return {
        success: true,
        data: response.data,
        source: 'api',
      };
    }
  } catch (error) {
    console.error('获取章节内容失败:', error.message);
    return {
      success: false,
      data: null,
      error: error.message,
    };
  }
};

// 获取阅读进度
export const getReadingProgress = async (novelId) => {
  try {
    if (currentDataSource === 'mock') {
      await new Promise(resolve => setTimeout(resolve, 100));
      return {
        success: true,
        data: mockReadingProgress[novelId] || null,
        source: 'mock',
      };
    } else {
      const response = await axios.get(`${API_BASE_URL}/api/reading-progress/${novelId}`);
      return {
        success: true,
        data: response.data,
        source: 'api',
      };
    }
  } catch (error) {
    console.error('获取阅读进度失败:', error.message);
    return {
      success: false,
      data: null,
      error: error.message,
    };
  }
};

// 保存阅读进度
export const saveReadingProgress = async (novelId, chapterId, position) => {
  try {
    if (currentDataSource === 'mock') {
      await new Promise(resolve => setTimeout(resolve, 100));
      mockReadingProgress[novelId] = {
        novelId,
        chapterId,
        position,
        lastReadAt: new Date().toISOString(),
      };
      return {
        success: true,
        source: 'mock',
      };
    } else {
      const response = await axios.post(`${API_BASE_URL}/api/reading-progress`, {
        novelId,
        chapterId,
        position,
      });
      return {
        success: true,
        source: 'api',
      };
    }
  } catch (error) {
    console.error('保存阅读进度失败:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};
