export class BaseAdapter {
  constructor(apiClient) {
    this.apiClient = apiClient;
  }

  async getChapterImages(chapterId) {
    throw new Error('getChapterImages must be implemented by subclass');
  }

  async getChapterInfo(chapterId) {
    throw new Error('getChapterInfo must be implemented by subclass');
  }

  normalizeImageData(rawData) {
    if (!rawData || !rawData.images) {
      return [];
    }

    return rawData.images.map((img, index) => ({
      page: img.page || index + 1,
      url: img.url,
    }));
  }

  validateImageUrl(url) {
    if (!url) {
      return false;
    }
    return url.startsWith('http://') || url.startsWith('https://');
  }
}
