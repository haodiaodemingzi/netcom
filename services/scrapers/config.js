// 数据源配置
export const COMIC_SOURCES = {
  xmanhua: {
    name: 'X漫画',
    baseUrl: 'https://xmanhua.com',
    enabled: true,
    description: 'X漫画网',
  },
  guoman8: {
    name: '国漫8',
    baseUrl: 'https://www.guoman8.cc',
    enabled: true,
    description: '国漫8漫画网',
  },
};

// 默认数据源
export const DEFAULT_SOURCE = 'xmanhua';

// 请求配置
export const REQUEST_CONFIG = {
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9',
  },
};
