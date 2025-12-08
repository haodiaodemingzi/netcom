/**
 * 简单的事件总线，用于跨组件通信
 * 主要用于数据源变化、缓存清除等场景
 */

class EventBus {
  constructor() {
    this.listeners = {};
  }

  /**
   * 订阅事件
   * @param {string} event 事件名称
   * @param {function} callback 回调函数
   * @returns {function} 取消订阅函数
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    // 返回取消订阅函数
    return () => {
      this.off(event, callback);
    };
  }

  /**
   * 取消订阅事件
   * @param {string} event 事件名称
   * @param {function} callback 回调函数
   */
  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  /**
   * 发布事件
   * @param {string} event 事件名称
   * @param {any} data 事件数据
   */
  emit(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`EventBus: Error in ${event} listener:`, error);
      }
    });
  }

  /**
   * 清除所有订阅
   */
  clear() {
    this.listeners = {};
  }
}

// 事件名称常量
export const EVENTS = {
  CACHE_CLEARED: 'cache_cleared',           // 缓存已清除
  SOURCE_CHANGED: 'source_changed',         // 数据源已切换
  SOURCE_INSTALLED: 'source_installed',     // 数据源已安装
  SOURCE_UNINSTALLED: 'source_uninstalled', // 数据源已卸载
  DOWNLOAD_STATE_CHANGED: 'download_state_changed', // 下载状态变化
};

const eventBus = new EventBus();
export default eventBus;
