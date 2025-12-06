export const VideoTaskStatus = {
  PENDING: 'pending',
  DOWNLOADING: 'downloading',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

export class VideoDownloadTask {
  constructor(episodeId, seriesId, seriesTitle, episodeTitle, m3u8Url, source) {
    this.id = episodeId;
    this.episodeId = episodeId;
    this.seriesId = seriesId;
    this.seriesTitle = seriesTitle;
    this.episodeTitle = episodeTitle;
    this.m3u8Url = m3u8Url;
    this.source = source;
    
    this.status = VideoTaskStatus.PENDING;
    this.progress = 0;
    this.speed = 0;
    this.error = null;
    
    this.startTime = null;
    this.endTime = null;
    this.pausedAt = null;
    
    this.downloadedBytes = 0;
    this.totalBytes = 0;
    this.currentTime = 0; // FFmpeg转换的当前时间
    this.duration = 0; // 视频总时长
    
    this.outputPath = null;
    this.session = null; // FFmpegKit session
    
    this.onProgress = null;
    this.onComplete = null;
    this.onError = null;
  }

  start() {
    this.status = VideoTaskStatus.DOWNLOADING;
    this.startTime = Date.now();
    this.pausedAt = null;
  }

  pause() {
    this.status = VideoTaskStatus.PAUSED;
    this.pausedAt = Date.now();
    // 如果FFmpegKit session存在，尝试取消
    if (this.session) {
      try {
        this.session.cancel();
      } catch (e) {
        console.error('暂停FFmpeg session失败:', e);
      }
    }
  }

  resume() {
    this.status = VideoTaskStatus.DOWNLOADING;
    this.pausedAt = null;
    // 注意：FFmpegKit不支持真正的暂停/继续，需要重新开始
    // 这里只是更新状态，实际需要重新执行转换
  }

  cancel() {
    this.status = VideoTaskStatus.CANCELLED;
    this.endTime = Date.now();
    // 取消FFmpegKit session
    if (this.session) {
      try {
        this.session.cancel();
      } catch (e) {
        console.error('取消FFmpeg session失败:', e);
      }
    }
  }

  complete() {
    this.status = VideoTaskStatus.COMPLETED;
    this.endTime = Date.now();
    this.progress = 1;
    if (this.onComplete) {
      this.onComplete(this);
    }
  }

  fail(error) {
    this.status = VideoTaskStatus.FAILED;
    this.error = error;
    this.endTime = Date.now();
    if (this.onError) {
      this.onError(this, error);
    }
  }

  updateProgress(progress, currentTime = 0, duration = 0) {
    this.progress = Math.min(Math.max(progress, 0), 1);
    this.currentTime = currentTime;
    this.duration = duration;
    
    if (this.startTime && !this.pausedAt) {
      const elapsed = (Date.now() - this.startTime) / 1000;
      if (elapsed > 0 && duration > 0) {
        // 根据已转换的时间估算速度
        this.speed = currentTime / elapsed;
      }
    }
    
    if (this.onProgress) {
      this.onProgress(this);
    }
  }

  setSession(session) {
    this.session = session;
  }

  setOutputPath(path) {
    this.outputPath = path;
  }

  getInfo() {
    return {
      id: this.id,
      episodeId: this.episodeId,
      seriesId: this.seriesId,
      seriesTitle: this.seriesTitle,
      episodeTitle: this.episodeTitle,
      source: this.source,
      status: this.status,
      progress: this.progress,
      speed: this.speed,
      error: this.error,
      outputPath: this.outputPath,
      currentTime: this.currentTime,
      duration: this.duration,
    };
  }
}

