import { getInstalledSources, getInstalledSourcesByCategory } from './storage';

// 重新导出 getInstalledSourcesByCategory，方便其他文件使用
export { getInstalledSourcesByCategory };

/**
 * 过滤已安装的数据源
 * @param {Array} sources - 所有数据源列表
 * @param {string} category - 分类
 * @returns {Promise<Array>} 已安装的数据源列表
 */
export const filterInstalledSources = async (sources, category) => {
  try {
    const installed = await getInstalledSourcesByCategory(category);
    return sources.filter(source => installed.includes(source.id));
  } catch (error) {
    console.error('过滤已安装数据源失败:', error);
    return [];
  }
};

/**
 * 获取已安装的数据源字典（按分类）
 * @returns {Promise<Object>} { video: [...], comic: [...], ... }
 */
export const getInstalledSourcesDict = async () => {
  try {
    return await getInstalledSources();
  } catch (error) {
    console.error('获取已安装数据源字典失败:', error);
    return {
      video: [],
      comic: [],
      ebook: [],
      novel: [],
      news: [],
    };
  }
};

/**
 * 检查数据源是否已安装
 * @param {string} sourceId - 数据源ID
 * @returns {Promise<boolean>}
 */
export const checkSourceInstalled = async (sourceId) => {
  try {
    const installed = await getInstalledSources();
    for (const category in installed) {
      if (installed[category].includes(sourceId)) {
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('检查数据源安装状态失败:', error);
    return false;
  }
};

