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

      let completedCount = 0;
      let totalBytes = 0;

      for (let i = 0; i < task.images.length; i++) {
        if (task.status === TaskStatus.CANCELLED || task.status === TaskStatus.PAUSED) {
          break;
        }

        const image = task.images[i];
        const filename = `${String(i + 1).padStart(3, '0')}.jpg`;
        const localPath = `${taskDir}${filename}`;

        // 串行下载，每次只下载一张
        const result = await this.downloadImage(
          image.url,
          localPath,
          task
        );
        
        if (result.success) {
          completedCount++;
          totalBytes += result.size || 0;
        } else {
          task.incrementFailed();
        }
        
        // 更新进度
        task.updateProgress(completedCount, totalBytes);
        if (task.onProgress) {
          task.onProgress(task);
        }
        
        // 每张图片下载后延迟300ms
        if (i < task.images.length - 1) {
          await this.delay(300);
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

      console.log(`📥 下载: ${url}`);
      console.log(`💾 保存: ${localPath}`);

      const downloadHeaders = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
        'Referer': 'https://xmanhua.com/',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9'
      };
      
      // 如果task有cookies，添加到headers
      if (task.cookies) {
        downloadHeaders['Cookie'] = task.cookies;
        console.log('使用Cookie下载');
      }

      const downloadResult = await FileSystem.downloadAsync(url, localPath, {
        headers: downloadHeaders
      });
      
      if (downloadResult.status === 200) {
        const info = await FileSystem.getInfoAsync(localPath);
        console.log(`✅ 成功: ${info.size} bytes`);
        return { success: true, size: info.size || 0 };
      } else {
        console.error(`❌ 失败: HTTP ${downloadResult.status}`);
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
