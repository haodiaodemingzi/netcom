import * as FileSystem from 'expo-file-system/legacy';
import { TaskStatus } from './DownloadTask';

// 使用 legacy API 的辅助函数（避免弃用警告，但功能正常）
const getInfoAsync = FileSystem.getInfoAsync.bind(FileSystem);
const makeDirectoryAsync = FileSystem.makeDirectoryAsync.bind(FileSystem);
const downloadAsync = FileSystem.downloadAsync.bind(FileSystem);

export class ImageDownloader {
  constructor(maxRetries = 3, retryDelay = 1000, maxConcurrent = 10) {
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
    this.maxConcurrent = maxConcurrent;
    this.activeDownloads = new Map();
  }

  setMaxConcurrent(maxConcurrent) {
    this.maxConcurrent = maxConcurrent;
  }

  async downloadTask(task, baseDir) {
    if (task.status !== TaskStatus.DOWNLOADING) {
      return;
    }

    const taskDir = `${baseDir}${task.comicId}/${task.chapterId}/`;
    
    try {
      const dirInfo = await getInfoAsync(taskDir);
      if (!dirInfo.exists) {
        await makeDirectoryAsync(taskDir, { intermediates: true });
      }

      let completedCount = 0;
      let totalBytes = 0;

      // 使用并发控制下载所有图片
      await this.downloadWithConcurrency(
        task.images,
        this.maxConcurrent,
        async (image, index) => {
          if (task.status === TaskStatus.CANCELLED || task.status === TaskStatus.PAUSED) {
            return { success: false, cancelled: true };
          }

          const filename = `${String(index + 1).padStart(3, '0')}.jpg`;
          const localPath = `${taskDir}${filename}`;

          // 随机延迟0-500ms
          const randomDelay = Math.floor(Math.random() * 501);
          await this.delay(randomDelay);

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

          return result;
        }
      );

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

  async downloadWithConcurrency(items, concurrency, handler) {
    const results = [];
    const executing = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const promise = handler(item, i).then(result => {
        executing.splice(executing.indexOf(promise), 1);
        return result;
      });

      results.push(promise);
      executing.push(promise);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }

    return Promise.all(results);
  }

  async downloadImage(url, localPath, task, retryCount = 0) {
    try {
      if (task.status === TaskStatus.CANCELLED || task.status === TaskStatus.PAUSED) {
        return { success: false, cancelled: true };
      }

      const fileInfo = await getInfoAsync(localPath);
      if (fileInfo.exists && fileInfo.size > 0) {
        return { success: true, size: fileInfo.size, cached: true };
      }

      console.log(`📥 下载: ${url}`);
      console.log(`💾 保存: ${localPath}`);

      // 根据数据源设置不同的Referer
      const referers = {
        'xmanhua': 'https://xmanhua.com/',
        'hmzxa': 'https://hmzxa.com/',
      };
      const referer = referers[task.source];
      if (!referer) {
        console.warn(`未知数据源: ${task.source}`);
      }

      const downloadHeaders = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
        'Referer': referer,
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9'
      };
      
      // 如果task有cookies，添加到headers
      if (task.cookies) {
        downloadHeaders['Cookie'] = task.cookies;
        console.log(`使用${task.source}的Cookie下载`);
      }

      const downloadResult = await downloadAsync(url, localPath, {
        headers: downloadHeaders
      });
      
      if (downloadResult.status === 200) {
        const info = await getInfoAsync(localPath);
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
