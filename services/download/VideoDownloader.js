import * as FileSystem from 'expo-file-system/legacy';
import { VideoTaskStatus } from './VideoDownloadTask';
import { API_BASE_URL } from '../../utils/constants';
import axios from 'axios';

const getInfoAsync = FileSystem.getInfoAsync.bind(FileSystem);
const makeDirectoryAsync = FileSystem.makeDirectoryAsync.bind(FileSystem);
const downloadAsync = FileSystem.downloadAsync.bind(FileSystem);
const writeAsStringAsync = FileSystem.writeAsStringAsync.bind(FileSystem);

export class VideoDownloader {
  constructor(maxRetries = 3, retryDelay = 1000) {
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  async downloadTask(task, baseDir) {
    if (task.status !== VideoTaskStatus.DOWNLOADING) {
      return;
    }

    const expoSeriesDir = `${baseDir}${task.seriesId}/`;
    const expoOutputPath = `${expoSeriesDir}${task.episodeId}.mp4`;
    
    try {
      // 确保目录存在
      const dirInfo = await getInfoAsync(expoSeriesDir);
      if (!dirInfo.exists) {
        await makeDirectoryAsync(expoSeriesDir, { intermediates: true });
      }

      // 检查文件是否已存在
      const fileInfo = await getInfoAsync(expoOutputPath);
      if (fileInfo.exists) {
        console.log(`视频文件已存在: ${expoOutputPath}`);
        task.setOutputPath(expoOutputPath);
        task.complete();
        return;
      }

      task.setOutputPath(expoOutputPath);

      // 根据视频类型选择下载方式
      if (task.videoType === 'm3u8') {
        // m3u8: 使用后端转换
        await this.downloadM3u8ViaBackend(task, expoOutputPath);
      } else if (task.videoType === 'mp4') {
        // mp4: 直接下载
        await this.downloadMp4Directly(task, expoOutputPath);
      } else {
        task.fail(new Error(`不支持的视频类型: ${task.videoType}`));
      }

    } catch (error) {
      console.error(`下载视频失败: ${task.episodeTitle}`, error);
      task.fail(error);
    }
  }

  async downloadM3u8ViaBackend(task, outputPath) {
    try {
      console.log(`开始转换视频: ${task.episodeTitle}`);
      console.log(`m3u8 URL: ${task.videoUrl}`);

      // 步骤1: 调用后端转换接口
      let convertResponse;
      try {
        const body = {
          m3u8_url: task.videoUrl,
          episode_id: task.episodeId,
          series_id: task.seriesId,
          source: task.source,
        };
        if (task.playReferer) {
          body.play_referer = task.playReferer;
        }
        convertResponse = await axios.post(`${API_BASE_URL}/videos/convert`, body);
      } catch (apiError) {
        // 检查是否是 ffmpeg 未安装的错误
        const errorMsg = apiError.response?.data?.error || apiError.message || '';
        if (errorMsg.includes('FFmpeg') || errorMsg.includes('ffmpeg')) {
          throw new Error('服务器未安装 FFmpeg，无法下载 m3u8 格式视频。该视频仅支持在线播放。');
        }
        throw apiError;
      }

      if (!convertResponse.data.success) {
        const errorMsg = convertResponse.data.error || '启动转换失败';
        if (errorMsg.includes('FFmpeg') || errorMsg.includes('ffmpeg')) {
          throw new Error('服务器未安装 FFmpeg，无法下载 m3u8 格式视频。该视频仅支持在线播放。');
        }
        throw new Error(errorMsg);
      }

      const taskId = convertResponse.data.task_id;
      console.log(`转换任务已启动: ${taskId}`);

      // 如果已经完成（可能之前转换过）
      if (convertResponse.data.status === 'completed') {
        await this.downloadConvertedVideo(task, outputPath);
        return;
      }

      // 步骤2: 轮询转换状态
      const maxPollAttempts = 600; // 最多轮询10分钟（每秒一次）
      let pollAttempts = 0;
      let conversionCompleted = false;
      let lastError = null;
      let consecutiveErrors = 0;

      while (pollAttempts < maxPollAttempts && task.status === VideoTaskStatus.DOWNLOADING) {
        await this.delay(1000); // 每秒检查一次

        try {
          const statusResponse = await axios.get(`${API_BASE_URL}/videos/convert/status/${taskId}`);
          const statusData = statusResponse.data;
          consecutiveErrors = 0; // 重置连续错误计数

          // 更新进度
          if (statusData.progress !== undefined) {
            task.updateProgress(statusData.progress, 0, 0);
          }

          if (statusData.status === 'completed') {
            conversionCompleted = true;
            console.log(`视频转换完成: ${task.episodeTitle}`);
            break;
          } else if (statusData.status === 'failed') {
            lastError = statusData.error || '转换失败';
            // 检查是否是 ffmpeg 相关错误
            if (lastError.includes('FFmpeg') || lastError.includes('ffmpeg') || lastError.includes('aac_adtstoasc')) {
              throw new Error('服务器未安装 FFmpeg 或转换失败，该 m3u8 视频仅支持在线播放。');
            }
            throw new Error(lastError);
          }

          pollAttempts++;
        } catch (pollError) {
          // 如果是自定义错误直接抛出
          if (pollError.message && pollError.message.includes('FFmpeg')) {
            throw pollError;
          }
          // 其他轮询错误，记录并继续尝试
          console.warn('轮询转换状态失败:', pollError.message || pollError);
          lastError = pollError.message || '轮询失败';
          consecutiveErrors++;
          pollAttempts++;
          
          // 如果连续5次轮询失败，检查是否是转换失败
          if (consecutiveErrors >= 5) {
            throw new Error('视频转换失败，该 m3u8 视频可能仅支持在线播放。请确保服务器已安装 FFmpeg。');
          }
        }
      }

      if (!conversionCompleted) {
        if (pollAttempts >= maxPollAttempts) {
          throw new Error('转换超时');
        } else if (task.status !== VideoTaskStatus.DOWNLOADING) {
          // 任务被取消或暂停
          return;
        } else {
          throw new Error('转换未完成');
        }
      }

      // 步骤3: 下载转换后的 mp4 文件
      await this.downloadConvertedVideo(task, outputPath);

    } catch (error) {
      console.error(`转换 m3u8 视频失败: ${task.episodeTitle}`, error.message || error);
      throw error;
    }
  }

  async downloadMp4Directly(task, outputPath) {
    try {
      console.log(`开始直接下载 MP4 视频: ${task.episodeTitle}`);
      console.log(`视频URL: ${task.videoUrl}`);

      // 首先获取文件大小（如果服务器支持）
      let totalBytes = 0;
      try {
        const headResponse = await axios.head(task.videoUrl, {
          headers: {
            'Accept': 'video/mp4',
          },
        });
        if (headResponse.headers['content-length']) {
          totalBytes = parseInt(headResponse.headers['content-length'], 10);
          task.totalBytes = totalBytes;
        }
      } catch (headError) {
        console.warn('无法获取文件大小:', headError);
      }

      // 使用 expo-file-system 下载文件
      // 注意：downloadAsync 不支持进度回调，所以我们通过定期检查文件大小来估算进度
      const progressCheckInterval = setInterval(async () => {
        if (task.status !== VideoTaskStatus.DOWNLOADING) {
          clearInterval(progressCheckInterval);
          return;
        }

        try {
          const fileInfo = await getInfoAsync(outputPath);
          if (fileInfo.exists && fileInfo.size && totalBytes > 0) {
            const progress = fileInfo.size / totalBytes;
            task.updateProgress(progress, 0, 0);
          } else if (fileInfo.exists && !totalBytes) {
            // 如果无法获取总大小，显示不确定进度
            task.updateProgress(0.5, 0, 0);
          }
        } catch (error) {
          // 忽略检查错误
        }
      }, 500); // 每500ms检查一次

      try {
        const downloadResult = await downloadAsync(task.videoUrl, outputPath, {
          headers: {
            'Accept': 'video/mp4',
          },
        });

        clearInterval(progressCheckInterval);

        if (downloadResult.status === 200) {
          // 最终确认文件大小
          const fileInfo = await getInfoAsync(outputPath);
          if (fileInfo.exists) {
            task.updateProgress(1, 0, 0);
            console.log(`MP4 视频下载成功: ${outputPath}`);
            task.complete();
          } else {
            throw new Error('下载完成但文件不存在');
          }
        } else {
          throw new Error(`下载失败，状态码: ${downloadResult.status}`);
        }
      } catch (downloadError) {
        clearInterval(progressCheckInterval);
        throw downloadError;
      }

    } catch (error) {
      console.error(`下载 MP4 视频失败:`, error);
      throw error;
    }
  }

  async downloadConvertedVideo(task, outputPath) {
    try {
      const downloadUrl = `${API_BASE_URL}/videos/download/${task.seriesId || 'default'}/${task.episodeId}.mp4`;
      console.log(`开始下载转换后的视频: ${downloadUrl}`);

      // 使用 expo-file-system 下载文件
      const downloadResult = await downloadAsync(downloadUrl, outputPath, {
        headers: {
          'Accept': 'video/mp4',
        },
      });

      if (downloadResult.status === 200) {
        console.log(`视频下载成功: ${outputPath}`);
        task.complete();
      } else {
        throw new Error(`下载失败，状态码: ${downloadResult.status}`);
      }
    } catch (error) {
      console.error(`下载转换后的视频失败:`, error);
      throw error;
    }
  }


  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

