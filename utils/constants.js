// API 配置
// 🚨 打包APK前请修改为你的服务器地址！
// 开发环境: http://localhost:5000/api
// 生产环境: http://your-server-ip:5000/api 或 https://api.yoursite.com/api
export const API_BASE_URL = 'http://192.168.123.178:5000/api';

// 颜色主题
export const COLORS = {
  primary: '#6200EE',
  primaryDark: '#3700B3',
  secondary: '#03DAC6',
  background: '#FFFFFF',
  backgroundDark: '#121212',
  surface: '#FFFFFF',
  surfaceDark: '#1E1E1E',
  error: '#B00020',
  text: '#000000',
  textDark: '#FFFFFF',
  textSecondary: '#666666',
  textSecondaryDark: '#AAAAAA',
  border: '#E0E0E0',
  borderDark: '#333333',
};

// 阅读模式
export const READING_MODES = {
  SINGLE: 'single',
  CONTINUOUS: 'continuous',
  DOUBLE: 'double',
};

// 阅读方向
export const READING_DIRECTIONS = {
  LTR: 'ltr',
  RTL: 'rtl',
};

// 图片适配模式
export const IMAGE_FIT_MODES = {
  WIDTH: 'width',
  HEIGHT: 'height',
  FREE: 'free',
};

// 排序选项
export const SORT_OPTIONS = {
  POPULAR: 'popular',
  LATEST: 'latest',
  RATING: 'rating',
};

// 漫画状态
export const COMIC_STATUS = {
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
};

// 缓存配置
export const CACHE_CONFIG = {
  MAX_MEMORY_CACHE: 100,
  MAX_DISK_CACHE: 500,
  PRELOAD_COUNT: 3,
};
