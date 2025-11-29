import { BaseAdapter } from './BaseAdapter';

export class HmzxaAdapter extends BaseAdapter {
  async getChapterImages(chapterId) {
    try {
      const response = await this.apiClient.get(`/chapters/${chapterId}/images`, {
        params: { source: 'hmzxa' }
      });
      
      return this.normalizeImageData(response.data);
    } catch (error) {
      console.error('HmzxaAdapter获取图片失败:', error);
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
      console.error('HmzxaAdapter获取章节信息失败:', error);
      throw error;
    }
  }
}
