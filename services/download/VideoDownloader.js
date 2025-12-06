import * as FileSystem from 'expo-file-system/legacy';
import { VideoTaskStatus } from './VideoDownloadTask';
import { API_BASE_URL } from '../../utils/constants';
import axios from 'axios';

const getInfoAsync = FileSystem.getInfoAsync.bind(FileSystem);
const makeDirectoryAsync = FileSystem.makeDirectoryAsync.bind(FileSystem);
const downloadAsync = FileSystem.downloadAsync.bind(FileSystem);

export class VideoDownloader {
  constructor(maxRetries = 3, retryDelay = 1000) {
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  async downloadTask(task, baseDir) {
    if (task.status !== VideoTaskStatus.DOWNLOADING) {
      return;
    }

    // 使用后端转换方案
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

      console.log(`开始转换视频: ${task.episodeTitle}`);
      console.log(`m3u8 URL: ${task.m3u8Url}`);

      // 步骤1: 调用后端转换接口
      const convertResponse = await axios.post(`${API_BASE_URL}/videos/convert`, {
        m3u8_url: task.m3u8Url,
        episode_id: task.episodeId,
        series_id: task.seriesId,
        source: task.source,
      });

      if (!convertResponse.data.success) {
        throw new Error(convertResponse.data.error || '启动转换失败');
      }

      const taskId = convertResponse.data.task_id;
      console.log(`转换任务已启动: ${taskId}`);

      // 如果已经完成（可能之前转换过）
      if (convertResponse.data.status === 'completed') {
        await this.downloadConvertedVideo(task, expoOutputPath);
        return;
      }

      // 步骤2: 轮询转换状态
      const maxPollAttempts = 600; // 最多轮询10分钟（每秒一次）
      let pollAttempts = 0;
      let conversionCompleted = false;

      while (pollAttempts < maxPollAttempts && task.status === VideoTaskStatus.DOWNLOADING) {
        await this.delay(1000); // 每秒检查一次

        try {
          const statusResponse = await axios.get(`${API_BASE_URL}/videos/convert/status/${taskId}`);
          const statusData = statusResponse.data;

          // 更新进度
          if (statusData.progress !== undefined) {
            task.updateProgress(statusData.progress, 0, 0);
          }

          if (statusData.status === 'completed') {
            conversionCompleted = true;
            console.log(`视频转换完成: ${task.episodeTitle}`);
            break;
          } else if (statusData.status === 'failed') {
            throw new Error(statusData.error || '转换失败');
          }

          pollAttempts++;
        } catch (pollError) {
          // 如果轮询出错，继续尝试
          console.warn('轮询转换状态失败:', pollError);
          pollAttempts++;
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
      await this.downloadConvertedVideo(task, expoOutputPath);

    } catch (error) {
      console.error(`下载视频失败: ${task.episodeTitle}`, error);
      task.fail(error);
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

