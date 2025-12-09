import { BaseAdapter } from './BaseAdapter';

export class AnimezillaAdapter extends BaseAdapter {
  constructor(apiClient, downloadManager) {
    super(apiClient);
    this.downloadManager = downloadManager;
  }

  async getChapterImages(chapterId) {
    try {
      const response = await this.apiClient.get(`/chapters/${chapterId}/images`, {
        params: { source: 'animezilla' }
      });
      
      return this.normalizeImageData(response.data);
    } catch (error) {
      console.error('AnimezillaAdapter获取图片失败:', error);
      throw error;
    }
  }

  async getChapterInfo(chapterId) {
    try {
      const images = await this.getChapterImages(chapterId);
      return {
        total: images.length,
        images: images
      };
    } catch (error) {
      console.error('AnimezillaAdapter获取章节信息失败:', error);
      throw error;
    }
  }

  async getDownloadHeaders() {
    // 获取animezilla的cookie
    const cookies = await this.downloadManager.getCookies('animezilla');
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Referer': 'https://18h.animezilla.com/'
    };
    
    if (cookies) {
      headers['Cookie'] = cookies;
    }
    
    return headers;
  }
}
