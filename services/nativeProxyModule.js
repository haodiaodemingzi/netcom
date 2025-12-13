/**
 * 原生代理模块封装
 * 
 * 提供对 Android/iOS 原生代理配置的访问
 * 支持 HTTP, HTTPS, SOCKS5 代理
 */

import { NativeModules, Platform } from 'react-native';

const { ProxyModule } = NativeModules;

/**
 * 原生代理管理器
 */
class NativeProxyManager {
  constructor() {
    this.isAvailable = !!ProxyModule;
    
    if (!this.isAvailable) {
      console.warn('NativeProxyModule: 原生代理模块不可用，可能需要重新构建 App');
    }
  }

  /**
   * 检查原生模块是否可用
   */
  isNativeModuleAvailable() {
    return this.isAvailable;
  }

  /**
   * 设置代理配置
   * @param {Object} config - {type, host, port, username, password}
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async setProxy(config) {
    if (!this.isAvailable) {
      return {
        success: false,
        message: '原生代理模块不可用',
      };
    }

    try {
      const result = await ProxyModule.setProxy({
        type: config.type,
        host: config.host,
        port: config.port,
        username: config.username || null,
        password: config.password || null,
      });
      
      // 解析返回的 JSON 字符串
      if (typeof result === 'string') {
        try {
          const parsed = result.match(/success=(true|false)/)?.[1] === 'true';
          const msg = result.match(/message=([^,}]+)/)?.[1] || '配置成功';
          return { success: parsed, message: msg };
        } catch (e) {
          return { success: true, message: '代理配置成功' };
        }
      }
      
      return { success: true, message: '代理配置成功' };
    } catch (error) {
      console.error('设置代理失败:', error);
      return {
        success: false,
        message: error.message || '设置代理失败',
      };
    }
  }

  /**
   * 清除代理配置
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async clearProxy() {
    if (!this.isAvailable) {
      return {
        success: false,
        message: '原生代理模块不可用',
      };
    }

    try {
      await ProxyModule.clearProxy();
      return { success: true, message: '代理已清除' };
    } catch (error) {
      console.error('清除代理失败:', error);
      return {
        success: false,
        message: error.message || '清除代理失败',
      };
    }
  }

  /**
   * 获取代理状态
   * @returns {Promise<Object|null>}
   */
  async getProxyStatus() {
    if (!this.isAvailable) {
      return null;
    }

    try {
      const result = await ProxyModule.getProxyStatus();
      if (typeof result === 'string') {
        // 简单解析 Kotlin map toString() 格式
        const enabled = result.includes('enabled=true');
        const host = result.match(/host=([^,}]+)/)?.[1] || '';
        const port = parseInt(result.match(/port=(\d+)/)?.[1] || '0');
        const type = result.match(/type=([^,}]+)/)?.[1] || 'direct';
        const hasAuth = result.includes('hasAuth=true');
        
        return { enabled, type, host, port, hasAuth };
      }
      return result;
    } catch (error) {
      console.error('获取代理状态失败:', error);
      return null;
    }
  }

  /**
   * 测试代理连接
   * @param {string} testUrl - 测试URL
   * @returns {Promise<{success: boolean, message: string, latency: number}>}
   */
  async testProxy(testUrl = 'https://www.google.com') {
    if (!this.isAvailable) {
      return {
        success: false,
        message: '原生代理模块不可用',
        latency: -1,
      };
    }

    try {
      const result = await ProxyModule.testProxy(testUrl);
      
      if (typeof result === 'string') {
        const success = result.includes('success=true');
        const latency = parseInt(result.match(/latency=(\d+)/)?.[1] || '-1');
        const statusCode = parseInt(result.match(/statusCode=(\d+)/)?.[1] || '0');
        const message = result.match(/message=([^,}]+)/)?.[1] || '';
        
        return { success, message, latency, statusCode };
      }
      
      return result;
    } catch (error) {
      console.error('测试代理失败:', error);
      return {
        success: false,
        message: error.message || '测试代理失败',
        latency: -1,
      };
    }
  }
}

// 导出单例
export const nativeProxyManager = new NativeProxyManager();

// 导出便捷函数
export const setNativeProxy = (config) => nativeProxyManager.setProxy(config);
export const clearNativeProxy = () => nativeProxyManager.clearProxy();
export const getNativeProxyStatus = () => nativeProxyManager.getProxyStatus();
export const testNativeProxy = (url) => nativeProxyManager.testProxy(url);
export const isNativeProxyAvailable = () => nativeProxyManager.isNativeModuleAvailable();

export default nativeProxyManager;
