import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  FAVORITES: '@favorites',
  HISTORY: '@history',
  SETTINGS: '@settings',
  SEARCH_HISTORY: '@search_history',
  CURRENT_SOURCE: '@current_source',
  INSTALLED_SOURCES: '@installed_sources',
};

// 内存缓存，减少 AsyncStorage 读取次数
let historyCache = null;
let historyCacheTime = 0;
const CACHE_DURATION = 5000; // 5秒缓存

// 收藏相关
export const getFavorites = async () => {
  try {
    const data = await AsyncStorage.getItem(KEYS.FAVORITES);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    return [];
  }
};

export const addFavorite = async (comic) => {
  try {
    const favorites = await getFavorites();
    const exists = favorites.find(item => item.id === comic.id);
    if (!exists) {
      favorites.unshift(comic);
      await AsyncStorage.setItem(
        KEYS.FAVORITES, 
        JSON.stringify(favorites)
      );
    }
    return true;
  } catch (error) {
    return false;
  }
};

export const removeFavorite = async (comicId) => {
  try {
    const favorites = await getFavorites();
    const filtered = favorites.filter(item => item.id !== comicId);
    await AsyncStorage.setItem(KEYS.FAVORITES, JSON.stringify(filtered));
    return true;
  } catch (error) {
    return false;
  }
};

export const isFavorite = async (comicId) => {
  try {
    const favorites = await getFavorites();
    return favorites.some(item => item.id === comicId);
  } catch (error) {
    return false;
  }
};

// 历史记录相关（优化版本，使用内存缓存提高性能）
export const getHistory = async (forceRefresh = false) => {
  try {
    const now = Date.now();
    // 如果不强制刷新且缓存未过期，直接返回缓存
    if (!forceRefresh && historyCache && (now - historyCacheTime) < CACHE_DURATION) {
      return historyCache;
    }
    
    const data = await AsyncStorage.getItem(KEYS.HISTORY);
    const history = data ? JSON.parse(data) : [];
    
    // 更新缓存
    historyCache = history;
    historyCacheTime = now;
    
    return history;
  } catch (error) {
    return [];
  }
};

export const addHistory = async (comic, chapterId, page) => {
  try {
    const history = await getHistory();
    const existingIndex = history.findIndex(
      item => item.id === comic.id
    );
    
    const historyItem = {
      ...comic,
      lastChapterId: chapterId,
      lastPage: page,
      timestamp: Date.now(),
    };
    
    if (existingIndex >= 0) {
      history.splice(existingIndex, 1);
    }
    
    history.unshift(historyItem);
    
    if (history.length > 100) {
      history.pop();
    }
    
    // 更新缓存
    historyCache = history;
    historyCacheTime = Date.now();
    
    await AsyncStorage.setItem(KEYS.HISTORY, JSON.stringify(history));
    return true;
  } catch (error) {
    return false;
  }
};

export const clearHistory = async () => {
  try {
    historyCache = [];
    historyCacheTime = Date.now();
    await AsyncStorage.setItem(KEYS.HISTORY, JSON.stringify([]));
    return true;
  } catch (error) {
    return false;
  }
};

// 设置相关
export const getSettings = async () => {
  try {
    const data = await AsyncStorage.getItem(KEYS.SETTINGS);
    return data ? JSON.parse(data) : {
      readingMode: 'single',
      readingDirection: 'ltr',
      scrollMode: 'horizontal',
      imageFitMode: 'width',
      backgroundColor: 'black',
      brightness: 1.0,
      keepScreenOn: true,
      darkMode: false,
      autoLoadHD: false,
      maxConcurrentDownloads: 10,
      viewMode: 'card', // 默认卡片视图
    };
  } catch (error) {
    return {};
  }
};

export const saveSettings = async (settings) => {
  try {
    await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    return true;
  } catch (error) {
    return false;
  }
};

// 搜索历史
export const getSearchHistory = async () => {
  try {
    const data = await AsyncStorage.getItem(KEYS.SEARCH_HISTORY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    return [];
  }
};

export const addSearchHistory = async (keyword) => {
  try {
    const history = await getSearchHistory();
    const filtered = history.filter(item => item !== keyword);
    filtered.unshift(keyword);
    
    if (filtered.length > 20) {
      filtered.pop();
    }
    
    await AsyncStorage.setItem(
      KEYS.SEARCH_HISTORY, 
      JSON.stringify(filtered)
    );
    return true;
  } catch (error) {
    return false;
  }
};

export const clearSearchHistory = async () => {
  try {
    await AsyncStorage.setItem(KEYS.SEARCH_HISTORY, JSON.stringify([]));
    return true;
  } catch (error) {
    return false;
  }
};

// 数据源相关
export const getCurrentSource = async () => {
  try {
    const data = await AsyncStorage.getItem(KEYS.CURRENT_SOURCE);
    return data || null;
  } catch (error) {
    return null;
  }
};

export const setCurrentSource = async (source) => {
  try {
    await AsyncStorage.setItem(KEYS.CURRENT_SOURCE, source);
    return true;
  } catch (error) {
    return false;
  }
};

// 已安装数据源相关
export const getInstalledSources = async () => {
  try {
    const data = await AsyncStorage.getItem(KEYS.INSTALLED_SOURCES);
    return data ? JSON.parse(data) : {
      video: [],
      comic: [],
      ebook: [],
      novel: [],
      news: [],
    };
  } catch (error) {
    return {
      video: [],
      comic: [],
      ebook: [],
      novel: [],
      news: [],
    };
  }
};

export const installSource = async (sourceId, category) => {
  try {
    const installed = await getInstalledSources();
    if (!installed[category]) {
      installed[category] = [];
    }
    
    if (!installed[category].includes(sourceId)) {
      installed[category].push(sourceId);
      await AsyncStorage.setItem(KEYS.INSTALLED_SOURCES, JSON.stringify(installed));
    }
    return true;
  } catch (error) {
    console.error('安装数据源失败:', error);
    return false;
  }
};

export const uninstallSource = async (sourceId) => {
  try {
    const installed = await getInstalledSources();
    let changed = false;
    
    // 从所有分类中移除
    for (const category in installed) {
      const index = installed[category].indexOf(sourceId);
      if (index !== -1) {
        installed[category].splice(index, 1);
        changed = true;
      }
    }
    
    if (changed) {
      await AsyncStorage.setItem(KEYS.INSTALLED_SOURCES, JSON.stringify(installed));
    }
    return true;
  } catch (error) {
    console.error('卸载数据源失败:', error);
    return false;
  }
};

export const isSourceInstalled = async (sourceId) => {
  try {
    const installed = await getInstalledSources();
    for (const category in installed) {
      if (installed[category].includes(sourceId)) {
        return true;
      }
    }
    return false;
  } catch (error) {
    return false;
  }
};

export const getInstalledSourcesByCategory = async (category) => {
  try {
    const installed = await getInstalledSources();
    return installed[category] || [];
  } catch (error) {
    return [];
  }
};
