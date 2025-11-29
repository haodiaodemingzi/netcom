import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  FAVORITES: '@favorites',
  HISTORY: '@history',
  SETTINGS: '@settings',
  SEARCH_HISTORY: '@search_history',
  CURRENT_SOURCE: '@current_source',
};

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

// 历史记录相关
export const getHistory = async () => {
  try {
    const data = await AsyncStorage.getItem(KEYS.HISTORY);
    return data ? JSON.parse(data) : [];
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
    
    await AsyncStorage.setItem(KEYS.HISTORY, JSON.stringify(history));
    return true;
  } catch (error) {
    return false;
  }
};

export const clearHistory = async () => {
  try {
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
    return data || 'xmanhua';
  } catch (error) {
    return 'xmanhua';
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
