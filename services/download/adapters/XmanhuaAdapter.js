import { BaseAdapter } from './BaseAdapter';

export class XmanhuaAdapter extends BaseAdapter {
  async getChapterImages(chapterId) {
    try {
      const response = await this.apiClient.get(`/chapters/${chapterId}/images`, {
        params: { source: 'xmanhua' }
      });
      
      return this.normalizeImageData(response.data);
    } catch (error) {
      console.error('XmanhuaAdapter获取图片失败:', error);
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
      console.error('XmanhuaAdapter获取章节信息失败:', error);
      throw error;
    }
  }
}
