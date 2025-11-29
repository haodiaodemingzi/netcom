export const TaskStatus = {
  PENDING: 'pending',
  DOWNLOADING: 'downloading',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

export class DownloadTask {
  constructor(chapterId, comicId, comicTitle, chapterTitle, images, source) {
    this.id = `${comicId}_${chapterId}`;
    this.chapterId = chapterId;
    this.comicId = comicId;
    this.comicTitle = comicTitle;
    this.chapterTitle = chapterTitle;
    this.images = images;
    this.source = source;
    
    this.status = TaskStatus.PENDING;
    this.totalImages = images.length;
    this.downloadedImages = 0;
    this.failedImages = 0;
    this.progress = 0;
    this.speed = 0;
    this.error = null;
    
    this.startTime = null;
    this.endTime = null;
    this.pausedAt = null;
    
    this.downloadedBytes = 0;
    this.totalBytes = 0;
    
    this.onProgress = null;
    this.onComplete = null;
    this.onError = null;
  }

  start() {
    this.status = TaskStatus.DOWNLOADING;
    this.startTime = Date.now();
    this.pausedAt = null;
  }

  pause() {
    this.status = TaskStatus.PAUSED;
    this.pausedAt = Date.now();
  }

  resume() {
    this.status = TaskStatus.DOWNLOADING;
    this.pausedAt = null;
  }

  cancel() {
    this.status = TaskStatus.CANCELLED;
    this.endTime = Date.now();
  }

  complete() {
    this.status = TaskStatus.COMPLETED;
    this.endTime = Date.now();
    this.progress = 1;
    if (this.onComplete) {
      this.onComplete(this);
    }
  }

  fail(error) {
    this.status = TaskStatus.FAILED;
    this.error = error;
    this.endTime = Date.now();
    if (this.onError) {
      this.onError(this, error);
    }
  }

  updateProgress(downloadedImages, downloadedBytes = 0) {
    this.downloadedImages = downloadedImages;
    this.downloadedBytes = downloadedBytes;
    this.progress = this.totalImages > 0 ? downloadedImages / this.totalImages : 0;
    
    if (this.startTime && !this.pausedAt) {
      const elapsed = (Date.now() - this.startTime) / 1000;
      this.speed = elapsed > 0 ? downloadedBytes / elapsed : 0;
    }
  }

  incrementFailed() {
    this.failedImages++;
  }

  getInfo() {
    return {
      id: this.id,
      chapterId: this.chapterId,
      comicId: this.comicId,
      comicTitle: this.comicTitle,
      chapterTitle: this.chapterTitle,
      source: this.source,
      status: this.status,
      totalImages: this.totalImages,
      downloadedImages: this.downloadedImages,
      failedImages: this.failedImages,
      progress: this.progress,
      speed: this.speed,
      error: this.error,
    };
  }
}
