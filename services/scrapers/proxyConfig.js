import AsyncStorage from '@react-native-async-storage/async-storage';

const PROXY_CONFIG_KEY = 'proxyConfig';

// 默认代理配置
const defaultProxyConfig = {
  enabled: false,
  host: '',
  port: '',
  type: 'http', // http, https, socks5
};

// 保存代理配置
export const saveProxyConfig = async (config) => {
  try {
    await AsyncStorage.setItem(PROXY_CONFIG_KEY, JSON.stringify(config));
    console.log('代理配置已保存:', config);
  } catch (error) {
    console.error('保存代理配置失败:', error);
  }
};

// 读取代理配置
export const getProxyConfig = async () => {
  try {
    const config = await AsyncStorage.getItem(PROXY_CONFIG_KEY);
    return config ? JSON.parse(config) : defaultProxyConfig;
  } catch (error) {
    console.error('读取代理配置失败:', error);
    return defaultProxyConfig;
  }
};

// 清除代理配置
export const clearProxyConfig = async () => {
  try {
    await AsyncStorage.removeItem(PROXY_CONFIG_KEY);
    console.log('代理配置已清除');
  } catch (error) {
    console.error('清除代理配置失败:', error);
  }
};
