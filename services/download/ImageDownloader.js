import * as FileSystem from 'expo-file-system';
import { TaskStatus } from './DownloadTask';

export class ImageDownloader {
  constructor(maxRetries = 3, retryDelay = 1000) {
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
    this.activeDownloads = new Map();
  }

  async downloadTask(task, baseDir) {
    if (task.status !== TaskStatus.DOWNLOADING) {
      return;
    }

    const taskDir = `${baseDir}${task.comicId}/${task.chapterId}/`;
    
    try {
      const dirInfo = await FileSystem.getInfoAsync(taskDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(taskDir, { intermediates: true });
      }

      const downloadPromises = [];
      let completedCount = 0;
      let totalBytes = 0;

      for (let i = 0; i < task.images.length; i++) {
        if (task.status === TaskStatus.CANCELLED || task.status === TaskStatus.PAUSED) {
          break;
        }

        const image = task.images[i];
        const promise = this.downloadImage(
          image.url,
          `${taskDir}${image.page}.jpg`,
          task
        ).then((result) => {
          if (result.success) {
            completedCount++;
            totalBytes += result.size || 0;
          } else {
            task.incrementFailed();
          }
        });

        downloadPromises.push(promise);

        if (downloadPromises.length >= 5 || i === task.images.length - 1) {
          await Promise.all(downloadPromises);
          downloadPromises.length = 0;
          task.updateProgress(completedCount, totalBytes);
          if (task.onProgress) {
            task.onProgress(task);
          }
        }
      }

      if (task.status === TaskStatus.DOWNLOADING) {
        if (task.failedImages === 0) {
          task.complete();
        } else if (task.downloadedImages > 0) {
          task.complete();
        } else {
          task.fail(new Error('所有图片下载失败'));
        }
      }
    } catch (error) {
      task.fail(error);
    }
  }

  async downloadImage(url, localPath, task, retryCount = 0) {
    try {
      if (task.status === TaskStatus.CANCELLED || task.status === TaskStatus.PAUSED) {
        return { success: false, cancelled: true };
      }

      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (fileInfo.exists && fileInfo.size > 0) {
        return { success: true, size: fileInfo.size, cached: true };
      }

      const downloadResult = await FileSystem.downloadAsync(url, localPath);
      
      if (downloadResult.status === 200) {
        const info = await FileSystem.getInfoAsync(localPath);
        return { success: true, size: info.size || 0 };
      } else {
        throw new Error(`下载失败: HTTP ${downloadResult.status}`);
      }
    } catch (error) {
      if (retryCount < this.maxRetries) {
        await this.delay(this.retryDelay * (retryCount + 1));
        return this.downloadImage(url, localPath, task, retryCount + 1);
      }
      
      console.error(`下载失败: ${url}`, error);
      return { success: false, error };
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  cancelDownload(taskId) {
    if (this.activeDownloads.has(taskId)) {
      this.activeDownloads.delete(taskId);
    }
  }
}
