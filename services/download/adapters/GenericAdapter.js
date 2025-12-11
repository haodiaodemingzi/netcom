import { BaseAdapter } from './BaseAdapter';

/**
 * 通用下载适配器
 * 从后端 download-info API 统一获取下载配置
 * 新数据源只需在后端 config.py 添加 download_config，无需修改前端代码
 */
export class GenericAdapter extends BaseAdapter {
  constructor(apiClient, downloadManager, source) {
    super(apiClient);
    this.downloadManager = downloadManager;
    this.source = source;
  }

  /**
   * 获取章节图片列表
   */
  async getChapterImages(chapterId) {
    try {
      const response = await this.apiClient.get(`/chapters/${chapterId}/images`, {
        params: { source: this.source }
      });
      
      return this.normalizeImageData(response.data);
    } catch (error) {
      console.error(`GenericAdapter[${this.source}]获取图片失败:`, error);
      throw error;
    }
  }

  /**
   * 获取章节下载信息（包含图片列表和下载配置）
   * 下载配置从后端动态获取，包括 referer、cookie_url、headers 等
   */
  async getChapterInfo(chapterId) {
    try {
      // 调用 download-info API，获取图片和下载配置
      const response = await this.apiClient.get(`/chapters/${chapterId}/download-info`, {
        params: { source: this.source }
      });
      
      const data = response.data;
      
      if (!data.success) {
        throw new Error(data.message || '获取章节信息失败');
      }
      
      const { images, total, download_config } = data.data;
      
      return {
        total: total || images.length,
        images: images.map((img, index) => ({
          page: img.page || index + 1,
          url: img.url,
        })),
        download_config: download_config
      };
    } catch (error) {
      console.error(`GenericAdapter[${this.source}]获取章节信息失败:`, error);
      throw error;
    }
  }

  /**
   * 获取下载所需的请求头
   * 从 download_config 中获取，支持 referer 和 cookie
   */
  async getDownloadHeaders(downloadConfig) {
    const headers = {
      ...downloadConfig?.headers,
    };
    
    // 如果配置了 referer，添加到 headers
    if (downloadConfig?.referer) {
      headers['Referer'] = downloadConfig.referer;
    }
    
    // 如果需要 cookie，从 cookie_url 获取
    if (downloadConfig?.cookie_url && this.downloadManager) {
      const cookies = await this.downloadManager.getCookiesFromUrl(downloadConfig.cookie_url);
      if (cookies) {
        headers['Cookie'] = cookies;
      }
    }
    
    return headers;
  }
}
