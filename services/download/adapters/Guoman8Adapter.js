import { BaseAdapter } from './BaseAdapter';

export class Guoman8Adapter extends BaseAdapter {
  async getChapterImages(chapterId) {
    try {
      const response = await this.apiClient.get(`/chapters/${chapterId}/images`, {
        params: { source: 'guoman8' }
      });
      
      return this.normalizeImageData(response.data);
    } catch (error) {
      console.error('Guoman8Adapter获取图片失败:', error);
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
      console.error('Guoman8Adapter获取章节信息失败:', error);
      throw error;
    }
  }
}
