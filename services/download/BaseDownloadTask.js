/**
 * 基础下载任务类 - 漫画和视频下载任务的公共基类
 * 统一接口，方便复用代码
 */

export const TaskStatus = {
  PENDING: 'pending',
  DOWNLOADING: 'downloading',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

export class BaseDownloadTask {
  constructor(contentId, parentId, parentTitle, contentTitle, source) {
    this.id = `${parentId}_${contentId}`;
    this.contentId = contentId;       // 章节ID / 剧集ID
    this.parentId = parentId;         // 漫画ID / 剧集系列ID
    this.parentTitle = parentTitle;   // 漫画标题 / 剧集系列标题
    this.contentTitle = contentTitle; // 章节标题 / 剧集标题
    this.source = source;
    
    this.status = TaskStatus.PENDING;
    this.progress = 0;
    this.speed = 0;
    this.error = null;
    
    this.startTime = null;
    this.endTime = null;
    this.pausedAt = null;
    
    this.downloadedBytes = 0;
    this.totalBytes = 0;
    
    // 回调函数
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

  updateProgress(progress) {
    this.progress = Math.min(Math.max(progress, 0), 1);
    if (this.onProgress) {
      this.onProgress(this);
    }
  }

  /**
   * 获取基础信息（子类应覆盖并扩展）
   */
  getBaseInfo() {
    return {
      id: this.id,
      contentId: this.contentId,
      parentId: this.parentId,
      parentTitle: this.parentTitle,
      contentTitle: this.contentTitle,
      source: this.source,
      status: this.status,
      progress: this.progress,
      speed: this.speed,
      error: this.error,
    };
  }
}
