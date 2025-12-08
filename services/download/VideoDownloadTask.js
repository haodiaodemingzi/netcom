import { BaseDownloadTask, TaskStatus } from './BaseDownloadTask';

export const VideoTaskStatus = TaskStatus;

/**
 * 视频剧集下载任务 - 继承基础下载任务类
 */
export class VideoDownloadTask extends BaseDownloadTask {
  constructor(episodeId, seriesId, seriesTitle, episodeTitle, videoUrl, source) {
    super(episodeId, seriesId, seriesTitle, episodeTitle, source);
    
    // 视频任务的 id 直接使用 episodeId（与原实现保持一致）
    this.id = episodeId;
    
    // 视频特有的别名属性（向后兼容）
    this.episodeId = episodeId;
    this.seriesId = seriesId;
    this.seriesTitle = seriesTitle;
    this.episodeTitle = episodeTitle;
    
    // 视频特有属性
    this.videoUrl = videoUrl;
    this.videoType = this.detectVideoType(videoUrl);
    this.currentTime = 0; // FFmpeg转换的当前时间
    this.duration = 0;    // 视频总时长
    this.outputPath = null;
    this.session = null;  // FFmpegKit session
  }

  detectVideoType(url) {
    if (!url) return 'unknown';
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('.m3u8') || lowerUrl.includes('m3u8')) {
      return 'm3u8';
    } else if (lowerUrl.includes('.mp4') || lowerUrl.includes('mp4')) {
      return 'mp4';
    }
    return 'unknown';
  }

  isM3u8() {
    return this.videoType === 'm3u8';
  }

  isMp4() {
    return this.videoType === 'mp4';
  }

  pause() {
    super.pause();
    // 如果FFmpegKit session存在，尝试取消
    if (this.session) {
      try {
        this.session.cancel();
      } catch (e) {
        console.error('暂停FFmpeg session失败:', e);
      }
    }
  }

  cancel() {
    super.cancel();
    // 取消FFmpegKit session
    if (this.session) {
      try {
        this.session.cancel();
      } catch (e) {
        console.error('取消FFmpeg session失败:', e);
      }
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
      ...this.getBaseInfo(),
      episodeId: this.episodeId,
      seriesId: this.seriesId,
      seriesTitle: this.seriesTitle,
      episodeTitle: this.episodeTitle,
      videoUrl: this.videoUrl,
      videoType: this.videoType,
      outputPath: this.outputPath,
      currentTime: this.currentTime,
      duration: this.duration,
    };
  }
}

