import { BaseDownloadTask, TaskStatus } from './BaseDownloadTask';

export { TaskStatus };

/**
 * 漫画章节下载任务 - 继承基础下载任务类
 */
export class DownloadTask extends BaseDownloadTask {
  constructor(chapterId, comicId, comicTitle, chapterTitle, images, source) {
    super(chapterId, comicId, comicTitle, chapterTitle, source);
    
    // 漫画特有的别名属性（向后兼容）
    this.chapterId = chapterId;
    this.comicId = comicId;
    this.comicTitle = comicTitle;
    this.chapterTitle = chapterTitle;
    
    // 漫画特有属性
    this.images = images;
    this.totalImages = images.length;
    this.downloadedImages = 0;
    this.failedImages = 0;
  }

  updateProgress(downloadedImages, downloadedBytes = 0) {
    this.downloadedImages = downloadedImages;
    this.downloadedBytes = downloadedBytes;
    this.progress = this.totalImages > 0 ? downloadedImages / this.totalImages : 0;
    
    if (this.startTime && !this.pausedAt) {
      const elapsed = (Date.now() - this.startTime) / 1000;
      this.speed = elapsed > 0 ? downloadedBytes / elapsed : 0;
    }
    
    if (this.onProgress) {
      this.onProgress(this);
    }
  }

  incrementFailed() {
    this.failedImages++;
  }

  getInfo() {
    return {
      ...this.getBaseInfo(),
      chapterId: this.chapterId,
      comicId: this.comicId,
      comicTitle: this.comicTitle,
      chapterTitle: this.chapterTitle,
      totalImages: this.totalImages,
      downloadedImages: this.downloadedImages,
      failedImages: this.failedImages,
    };
  }
}
