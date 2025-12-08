import videoDownloadManager from './videoDownloadManager';

/**
 * 统一的视频播放服务
 * 处理本地视频检查、URL类型判断等逻辑
 * 原则：所有视频都直接使用原始URL，不走代理
 */
class VideoPlayerService {
  /**
   * 检测视频URL类型
   * @param {string} url - 视频URL
   * @returns {string} - 'm3u8', 'mp4', 'other'
   */
  detectVideoType(url) {
    if (!url) return 'other';
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('.m3u8') || lowerUrl.includes('m3u8')) {
      return 'm3u8';
    } else if (lowerUrl.includes('.mp4') || lowerUrl.includes('mp4')) {
      return 'mp4';
    }
    return 'other';
  }

  /**
   * 处理视频URL（原则：不走代理，直接使用原始URL）
   * @param {string} originalUrl - 原始视频URL
   * @returns {string} - 原始URL（不做任何转换）
   */
  processVideoUrl(originalUrl) {
    if (!originalUrl) return null;
    // 原则：所有视频都直接使用原始URL，不走代理
    // app端的播放器应该能够处理各种格式的视频URL
    return originalUrl;
  }

  /**
   * 获取视频播放URL（统一接口）
   * 优先使用本地视频，在线视频直接使用原始URL（不走代理）
   * 
   * @param {Object} options - 配置选项
   * @param {string} options.episodeId - 剧集ID（必需）
   * @param {string} options.seriesId - 系列ID（可选，用于查找本地视频）
   * @param {string} options.videoUrl - 在线视频URL（可选，如果没有本地视频时使用）
   * @param {string} options.source - 数据源（可选，已废弃，保留用于兼容）
   * @returns {Promise<Object>} - { url: string, isLocal: boolean, videoType: string }
   */
  async getVideoPlayUrl({ episodeId, seriesId = null, videoUrl = null, source = null }) {
    if (!episodeId) {
      throw new Error('episodeId is required');
    }

    // 1. 优先检查本地视频
    const localVideoUri = await videoDownloadManager.getLocalVideoUri(seriesId, episodeId);
    if (localVideoUri) {
      console.log('[VideoPlayerService] 找到本地视频，使用本地文件');
      return {
        url: localVideoUri,
        isLocal: true,
        videoType: 'mp4', // 本地视频都是mp4格式
        originalUrl: null,
      };
    }

    // 2. 如果没有本地视频，使用在线URL
    if (!videoUrl) {
      throw new Error('videoUrl is required when local video not found');
    }

    console.log('[VideoPlayerService] 使用在线视频URL');
    const videoType = this.detectVideoType(videoUrl);

    // 3. 原则：不走代理，直接使用原始URL
    // app端的播放器（expo-video）应该能够处理各种格式的视频URL
    const finalUrl = this.processVideoUrl(videoUrl);
    console.log('[VideoPlayerService] 直接使用原始URL（不走代理）:', finalUrl);

    return {
      url: finalUrl,
      isLocal: false,
      videoType: videoType,
      originalUrl: videoUrl,
    };
  }

  /**
   * 从剧集详情获取播放URL（便捷方法）
   * @param {string} episodeId - 剧集ID
   * @param {Object} episodeData - 剧集详情数据（包含 videoUrl, seriesId 等）
   * @param {string} source - 数据源（可选）
   * @returns {Promise<Object>} - { url: string, isLocal: boolean, videoType: string }
   */
  async getPlayUrlFromEpisode(episodeId, episodeData, source = null) {
    return this.getVideoPlayUrl({
      episodeId,
      seriesId: episodeData?.seriesId || episodeData?.series_id || null,
      videoUrl: episodeData?.videoUrl || null,
      source: source || episodeData?.source || null,
    });
  }
}

// 导出单例
const videoPlayerService = new VideoPlayerService();
export default videoPlayerService;

