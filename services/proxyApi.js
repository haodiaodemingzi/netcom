/**
 * 代理API服务 - 纯前端实现
 * 管理SSR/Trojan订阅和节点选择
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decode as atob, encode as btoa } from 'base-64';
import { setNativeProxy, clearNativeProxy, testNativeProxy, isNativeProxyAvailable } from './nativeProxyModule';

const SUBSCRIPTION_KEY = '@proxy_subscription_url';
const NODES_KEY = '@proxy_nodes';
const SELECTED_NODE_KEY = '@proxy_selected_node';
const PROXY_ENABLED_KEY = '@proxy_enabled';
const MANUAL_PROXY_KEY = '@proxy_manual_config';
const PROXY_MODE_KEY = '@proxy_mode'; // 'manual' | 'subscription' | 'off'

class ProxyApi {
  constructor() {
    this.subscriptionUrl = null;
    this.nodes = [];
    this.selectedNode = null;
    this.proxyEnabled = false;
    this.proxyMode = 'off'; // 'manual' | 'subscription' | 'off'
    this.manualProxy = {
      type: 'http', // 'http' | 'https' | 'socks5'
      host: '',
      port: '',
      username: '',
      password: '',
    };
    this.init();
  }

  async init() {
    // 加载保存的配置
    try {
      const url = await AsyncStorage.getItem(SUBSCRIPTION_KEY);
      const nodesJson = await AsyncStorage.getItem(NODES_KEY);
      const selectedJson = await AsyncStorage.getItem(SELECTED_NODE_KEY);
      const enabled = await AsyncStorage.getItem(PROXY_ENABLED_KEY);
      const manualJson = await AsyncStorage.getItem(MANUAL_PROXY_KEY);
      const mode = await AsyncStorage.getItem(PROXY_MODE_KEY);
      
      if (url) {
        this.subscriptionUrl = url;
      }
      
      if (nodesJson) {
        this.nodes = JSON.parse(nodesJson);
      }
      
      if (selectedJson) {
        this.selectedNode = JSON.parse(selectedJson);
      }
      
      if (manualJson) {
        this.manualProxy = JSON.parse(manualJson);
      }
      
      this.proxyMode = mode || 'off';
      this.proxyEnabled = enabled === 'true';
      
      // 如果启用了代理，同步设置原生代理
      if (this.proxyEnabled && this.proxyMode !== 'off') {
        this._syncNativeProxy();
      }
    } catch (error) {
      console.error('初始化代理配置失败:', error);
    }
  }

  /**
   * 同步代理配置到原生模块
   */
  async _syncNativeProxy() {
    if (!isNativeProxyAvailable()) {
      return;
    }
    
    const config = this.getProxyConfig();
    if (config && config.host && config.port) {
      await setNativeProxy({
        type: config.type,
        host: config.host,
        port: parseInt(config.port),
        username: config.username,
        password: config.password,
      });
    } else {
      await clearNativeProxy();
    }
  }

  /**
   * 更新订阅
   * @param {string} url - 订阅URL
   * @returns {Promise<{success: boolean, nodes: Array, message: string}>}
   */
  async updateSubscription(url) {
    try {
      // 获取订阅内容
      const response = await axios.get(url, { timeout: 10000 });
      const base64Content = response.data;
      
      // 解析订阅
      const nodes = this.parseSubscription(base64Content);
      
      if (nodes.length > 0) {
        this.nodes = nodes;
        this.subscriptionUrl = url;
        
        // 保存到本地
        await AsyncStorage.setItem(SUBSCRIPTION_KEY, url);
        await AsyncStorage.setItem(NODES_KEY, JSON.stringify(nodes));
        
        return {
          success: true,
          nodes,
          message: `成功获取 ${nodes.length} 个节点`,
        };
      } else {
        return {
          success: false,
          message: '未解析到任何节点',
        };
      }
    } catch (error) {
      console.error('更新订阅失败:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 解析订阅内容
   * @param {string} base64Content - Base64编码的订阅内容
   * @returns {Array} 节点列表
   */
  parseSubscription(base64Content) {
    try {
      // 解码Base64
      const decoded = atob(base64Content);
      
      // 按行分割
      const lines = decoded.trim().split('\n');
      
      const nodes = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        const node = this.parseNode(trimmed);
        if (node) {
          nodes.push(node);
        }
      }
      
      return nodes;
    } catch (error) {
      console.error('解析订阅失败:', error);
      return [];
    }
  }

  /**
   * 解析单个节点
   * @param {string} url - 节点配置URL
   * @returns {Object|null} 节点对象
   */
  parseNode(url) {
    try {
      if (url.startsWith('trojan://')) {
        return this.parseTrojan(url);
      } else if (url.startsWith('ss://')) {
        return this.parseShadowsocks(url);
      } else if (url.startsWith('ssr://')) {
        return this.parseShadowsocksR(url);
      } else if (url.startsWith('vmess://')) {
        return this.parseVMess(url);
      }
      return null;
    } catch (error) {
      console.error('解析节点失败:', error);
      return null;
    }
  }

  /**
   * 解析Trojan节点
   */
  parseTrojan(url) {
    // trojan://password@host:port?params#name
    const rest = url.substring(9); // 去掉 trojan://
    
    let urlPart, name;
    if (rest.includes('#')) {
      const parts = rest.split('#');
      urlPart = parts[0];
      name = decodeURIComponent(parts[1]);
    } else {
      urlPart = rest;
      name = '未命名';
    }
    
    if (!urlPart.includes('@')) return null;
    
    const [password, hostPart] = urlPart.split('@');
    
    let hostPort, params = {};
    if (hostPart.includes('?')) {
      const parts = hostPart.split('?');
      hostPort = parts[0];
      // 简单解析参数
      const paramStr = parts[1];
      paramStr.split('&').forEach(p => {
        const [key, value] = p.split('=');
        params[key] = value;
      });
    } else {
      hostPort = hostPart;
    }
    
    const [host, port] = hostPort.split(':');
    
    return {
      protocol: 'trojan',
      name,
      server: host,
      port: parseInt(port) || 443,
      password,
      sni: params.sni,
      allowInsecure: params.allowInsecure === '1',
    };
  }

  /**
   * 解析Shadowsocks节点
   */
  parseShadowsocks(url) {
    // ss://base64(method:password)@host:port#name
    const rest = url.substring(5);
    
    let urlPart, name;
    if (rest.includes('#')) {
      const parts = rest.split('#');
      urlPart = parts[0];
      name = decodeURIComponent(parts[1]);
    } else {
      urlPart = rest;
      name = '未命名';
    }
    
    if (!urlPart.includes('@')) return null;
    
    const [encodedPart, hostPort] = urlPart.split('@');
    const decoded = atob(encodedPart);
    const [method, password] = decoded.split(':');
    
    const [host, port] = hostPort.split(':');
    
    return {
      protocol: 'shadowsocks',
      name,
      server: host,
      port: parseInt(port) || 8388,
      password,
      method,
    };
  }

  /**
   * 解析ShadowsocksR节点
   */
  parseShadowsocksR(url) {
    // ssr://base64(...)
    const encoded = url.substring(6);
    const decoded = atob(encoded);
    
    const parts = decoded.split('/');
    const mainPart = parts[0];
    
    const [host, port, protocol, method, obfs, passwordB64] = mainPart.split(':');
    const password = atob(passwordB64);
    
    let name = '未命名';
    if (parts.length > 1 && parts[1]) {
      const params = {};
      parts[1].replace('?', '').split('&').forEach(p => {
        const [key, value] = p.split('=');
        params[key] = value;
      });
      
      if (params.remarks) {
        name = atob(params.remarks);
      }
    }
    
    return {
      protocol: 'shadowsocksr',
      name,
      server: host,
      port: parseInt(port),
      password,
      method,
      ssrProtocol: protocol,
      obfs,
    };
  }

  /**
   * 解析VMess节点
   */
  parseVMess(url) {
    // vmess://base64(json)
    const encoded = url.substring(8);
    const decoded = atob(encoded);
    const config = JSON.parse(decoded);
    
    return {
      protocol: 'vmess',
      name: config.ps || '未命名',
      server: config.add || '',
      port: parseInt(config.port) || 443,
      uuid: config.id || '',
      alterId: config.aid || 0,
      network: config.net || 'tcp',
      tls: config.tls || '',
    };
  }

  /**
   * 获取所有节点
   * @returns {Array}
   */
  getNodes() {
    return this.nodes;
  }

  /**
   * 选择节点
   * @param {number} index - 节点索引
   * @returns {Promise<{success: boolean, node: Object}>}
   */
  async selectNode(index) {
    try {
      if (index >= 0 && index < this.nodes.length) {
        this.selectedNode = this.nodes[index];
        await AsyncStorage.setItem(
          SELECTED_NODE_KEY,
          JSON.stringify(this.selectedNode)
        );
        
        return {
          success: true,
          node: this.selectedNode,
        };
      }
      
      return {
        success: false,
        message: '节点索引无效',
      };
    } catch (error) {
      console.error('选择节点失败:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 获取当前选中的节点
   * @returns {Object|null}
   */
  getSelectedNode() {
    return this.selectedNode;
  }

  /**
   * 启用/禁用代理
   * @param {boolean} enabled 
   */
  async setProxyEnabled(enabled) {
    this.proxyEnabled = enabled;
    await AsyncStorage.setItem(PROXY_ENABLED_KEY, enabled.toString());
  }

  /**
   * 检查代理是否已启用
   * @returns {boolean}
   */
  isProxyEnabled() {
    return this.proxyEnabled;
  }

  /**
   * 获取当前代理信息（用于显示）
   * @returns {Object|null}
   */
  getCurrentProxyInfo() {
    if (!this.proxyEnabled || !this.selectedNode) {
      return null;
    }

    return {
      name: this.selectedNode.name,
      server: this.selectedNode.server,
      port: this.selectedNode.port,
      protocol: this.selectedNode.protocol,
    };
  }

  /**
   * 获取SOCKS5代理配置（供网络请求使用）
   * 注意: React Native需要配置原生代理或使用VPN
   */
  getProxyConfig() {
    if (!this.proxyEnabled) {
      return null;
    }

    // 手动代理模式
    if (this.proxyMode === 'manual' && this.manualProxy.host) {
      return {
        type: this.manualProxy.type,
        host: this.manualProxy.host,
        port: this.manualProxy.port,
        username: this.manualProxy.username,
        password: this.manualProxy.password,
      };
    }

    // 订阅节点模式
    if (this.proxyMode === 'subscription' && this.selectedNode) {
      return {
        type: this.selectedNode.protocol,
        host: this.selectedNode.server,
        port: this.selectedNode.port,
        password: this.selectedNode.password,
      };
    }

    return null;
  }

  // ==================== 手动代理配置 ====================

  /**
   * 获取手动代理配置
   * @returns {Object}
   */
  getManualProxy() {
    return this.manualProxy;
  }

  /**
   * 保存手动代理配置
   * @param {Object} config - 代理配置 {type, host, port, username, password}
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async saveManualProxy(config) {
    try {
      this.manualProxy = {
        type: config.type || 'http',
        host: config.host || '',
        port: config.port || '',
        username: config.username || '',
        password: config.password || '',
      };
      
      await AsyncStorage.setItem(MANUAL_PROXY_KEY, JSON.stringify(this.manualProxy));
      
      // 如果当前是手动模式，同步到原生模块
      if (this.proxyMode === 'manual') {
        await this._syncNativeProxy();
      }
      
      return {
        success: true,
        message: '代理配置已保存',
      };
    } catch (error) {
      console.error('保存代理配置失败:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 获取代理模式
   * @returns {string} 'manual' | 'subscription' | 'off'
   */
  getProxyMode() {
    return this.proxyMode;
  }

  /**
   * 设置代理模式
   * @param {string} mode - 'manual' | 'subscription' | 'off'
   */
  async setProxyMode(mode) {
    this.proxyMode = mode;
    this.proxyEnabled = mode !== 'off';
    
    await AsyncStorage.setItem(PROXY_MODE_KEY, mode);
    await AsyncStorage.setItem(PROXY_ENABLED_KEY, this.proxyEnabled.toString());
    
    // 同步原生代理配置
    if (mode === 'off') {
      await clearNativeProxy();
    } else {
      await this._syncNativeProxy();
    }
  }

  /**
   * 获取代理URL字符串（用于显示或传递给后端）
   * @returns {string|null}
   */
  getProxyUrl() {
    const config = this.getProxyConfig();
    if (!config || !config.host || !config.port) {
      return null;
    }

    let auth = '';
    if (config.username && config.password) {
      auth = `${encodeURIComponent(config.username)}:${encodeURIComponent(config.password)}@`;
    }

    // 格式: http://user:pass@host:port 或 socks5://host:port
    return `${config.type}://${auth}${config.host}:${config.port}`;
  }

  /**
   * 测试代理连接
   * @param {Object} config - 可选，不传则使用当前配置
   * @returns {Promise<{success: boolean, message: string, latency: number}>}
   */
  async testProxy(config = null) {
    const proxyConfig = config || this.getProxyConfig();
    
    if (!proxyConfig || !proxyConfig.host || !proxyConfig.port) {
      return {
        success: false,
        message: '代理配置不完整',
        latency: -1,
      };
    }

    // 使用原生模块测试（代理完全在App端处理）
    if (isNativeProxyAvailable()) {
      try {
        // 先设置原生代理
        await setNativeProxy({
          type: proxyConfig.type,
          host: proxyConfig.host,
          port: parseInt(proxyConfig.port),
          username: proxyConfig.username,
          password: proxyConfig.password,
        });
        
        // 使用原生模块测试
        const result = await testNativeProxy('https://www.google.com');
        return result;
      } catch (error) {
        return {
          success: false,
          message: `测试失败: ${error.message}`,
          latency: -1,
        };
      }
    }

    // 原生模块不可用，提示用户重新构建APK
    return {
      success: false,
      message: '原生代理模块不可用，请重新构建APK后使用',
      latency: -1,
    };
  }
}

export default new ProxyApi();
