import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getChapterImages } from './api';

const DOWNLOAD_DIR = `${FileSystem.documentDirectory}netcom/downloads/`;
const MAX_CONCURRENT = 3;
const MAX_RETRIES = 3;

class DownloadManager {
  constructor() {
    this.queue = [];
    this.activeDownloads = new Map();
    this.downloadedChapters = new Map();
    this.listeners = new Set();
    this.currentDownloading = 0;
    this.init();
  }

  async init() {
    await this.ensureDownloadDir();
    await this.loadDownloadedChapters();
  }

  async ensureDownloadDir() {
    const dirInfo = await FileSystem.getInfoAsync(DOWNLOAD_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });
    }
  }

  async loadDownloadedChapters() {
    try {
      const data = await AsyncStorage.getItem('downloaded_chapters');
      if (data) {
        const chapters = JSON.parse(data);
        this.downloadedChapters = new Map(Object.entries(chapters));
      }
    } catch (error) {
      console.error('加载已下载章节失败:', error);
    }
  }

  async saveDownloadedChapters() {
    try {
      const data = Object.fromEntries(this.downloadedChapters);
      await AsyncStorage.setItem('downloaded_chapters', JSON.stringify(data));
    } catch (error) {
      console.error('保存已下载章节失败:', error);
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners() {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }

  getState() {
    return {
      queue: this.queue.map(task => ({
        chapterId: task.chapterId,
        chapterTitle: task.chapterTitle,
        status: task.status,
        progress: task.progress,
        error: task.error
      })),
      activeDownloads: Array.from(this.activeDownloads.values()),
      downloadedChapters: Array.from(this.downloadedChapters.keys())
    };
  }

  async downloadChapters(comicId, comicTitle, chapters, source) {
    for (const chapter of chapters) {
      // 检查是否已下载
      if (this.downloadedChapters.has(chapter.id)) {
        console.log(`章节 ${chapter.title} 已下载，跳过`);
        continue;
      }
      
      // 检查是否已在队列中
      const existingTask = this.queue.find(t => t.chapterId === chapter.id);
      if (existingTask) {
        console.log(`章节 ${chapter.title} 已在下载队列中，跳过`);
        continue;
      }
      
      const task = {
        comicId,
        comicTitle,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        source,
        status: 'pending',
        progress: 0,
        currentImage: 0,
        totalImages: 0,
        retries: 0,
        error: null
      };

      this.queue.push(task);
    }

    this.notifyListeners();
    this.processQueue();
  }

  async processQueue() {
    while (this.queue.length > 0 && this.currentDownloading < MAX_CONCURRENT) {
      const task = this.queue.find(t => t.status === 'pending');
      if (!task) break;

      task.status = 'downloading';
      this.currentDownloading++;
      this.activeDownloads.set(task.chapterId, task);
      this.notifyListeners();

      this.downloadChapter(task)
        .then(() => {
          task.status = 'completed';
          task.progress = 100;
          this.downloadedChapters.set(task.chapterId, {
            comicId: task.comicId,
            comicTitle: task.comicTitle,
            chapterId: task.chapterId,
            chapterTitle: task.chapterTitle,
            downloadedAt: new Date().toISOString()
          });
          this.saveDownloadedChapters();
        })
        .catch((error) => {
          if (task.retries < MAX_RETRIES) {
            task.retries++;
            task.status = 'pending';
            console.log(`章节 ${task.chapterTitle} 下载失败，准备重试 (${task.retries}/${MAX_RETRIES})`);
          } else {
            task.status = 'failed';
            task.error = error.message;
            console.error(`章节 ${task.chapterTitle} 下载失败:`, error);
          }
        })
        .finally(() => {
          this.currentDownloading--;
          this.activeDownloads.delete(task.chapterId);
          
          const taskIndex = this.queue.findIndex(t => t.chapterId === task.chapterId);
          if (taskIndex !== -1 && task.status === 'completed') {
            this.queue.splice(taskIndex, 1);
          }
          
          this.notifyListeners();
          this.processQueue();
        });
    }
  }

  async downloadChapter(task) {
    const { comicId, chapterId, chapterTitle, source } = task;
    
    console.log(`开始下载章节: ${chapterTitle} (ID: ${chapterId})`);
    
    const chapterDir = `${DOWNLOAD_DIR}${comicId}/${chapterId}/`;
    await FileSystem.makeDirectoryAsync(chapterDir, { intermediates: true });

    console.log(`调用API获取章节图片: /chapters/${chapterId}/images`);
    const imagesData = await getChapterImages(chapterId, source);
    const images = imagesData.images || [];
    console.log(`获取到 ${images.length} 张图片`);
    
    task.totalImages = images.length;
    task.currentImage = 0;

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const filename = `${String(image.page).padStart(3, '0')}.jpg`;
      const filepath = `${chapterDir}${filename}`;

      await FileSystem.downloadAsync(image.url, filepath);
      
      task.currentImage = i + 1;
      task.progress = Math.round((task.currentImage / task.totalImages) * 100);
      this.notifyListeners();
    }

    const metaData = {
      comicId,
      chapterId,
      chapterTitle,
      totalImages: images.length,
      downloadedAt: new Date().toISOString()
    };
    
    const metaPath = `${chapterDir}meta.json`;
    await FileSystem.writeAsStringAsync(metaPath, JSON.stringify(metaData));
  }

  isDownloaded(chapterId) {
    return this.downloadedChapters.has(chapterId);
  }

  getChapterStatus(chapterId) {
    if (this.downloadedChapters.has(chapterId)) {
      return 'completed';
    }
    
    const task = this.queue.find(t => t.chapterId === chapterId);
    if (task) {
      return task.status;
    }
    
    return null;
  }

  getChapterProgress(chapterId) {
    const task = this.queue.find(t => t.chapterId === chapterId) || 
                 this.activeDownloads.get(chapterId);
    return task ? task.progress : 0;
  }

  async getLocalChapterImages(comicId, chapterId) {
    const chapterDir = `${DOWNLOAD_DIR}${comicId}/${chapterId}/`;
    const metaPath = `${chapterDir}meta.json`;
    
    try {
      console.log(`读取本地章节: ${chapterId}`);
      
      // 检查目录是否存在
      const dirInfo = await FileSystem.getInfoAsync(chapterDir);
      if (!dirInfo.exists) {
        console.error(`目录不存在`);
        return null;
      }
      
      // 读取元数据
      const metaContent = await FileSystem.readAsStringAsync(metaPath);
      const meta = JSON.parse(metaContent);
      
      const images = [];
      let missingCount = 0;
      
      for (let i = 1; i <= meta.totalImages; i++) {
        const filename = `${String(i).padStart(3, '0')}.jpg`;
        const filepath = `${chapterDir}${filename}`;
        
        // 验证文件是否存在
        const fileInfo = await FileSystem.getInfoAsync(filepath);
        
        if (fileInfo.exists && fileInfo.size > 0) {
          images.push({
            page: i,
            url: filepath,
            isLocal: true,
            size: fileInfo.size
          });
        } else {
          missingCount++;
        }
      }
      
      console.log(`成功加载${images.length}/${meta.totalImages}张图片${missingCount > 0 ? `, 缺失${missingCount}张` : ''}`);
      return images;
    } catch (error) {
      console.error(`读取失败: ${error.message}`);
      return null;
    }
  }

  pauseAll() {
    this.queue.forEach(task => {
      if (task.status === 'downloading' || task.status === 'pending') {
        task.status = 'paused';
      }
    });
    this.notifyListeners();
  }

  resumeAll() {
    this.queue.forEach(task => {
      if (task.status === 'paused') {
        task.status = 'pending';
      }
    });
    this.notifyListeners();
    this.processQueue();
  }

  retryFailed() {
    this.queue.forEach(task => {
      if (task.status === 'failed') {
        task.status = 'pending';
        task.retries = 0;
        task.error = null;
      }
    });
    this.notifyListeners();
    this.processQueue();
  }

  async deleteChapter(comicId, chapterId) {
    const chapterDir = `${DOWNLOAD_DIR}${comicId}/${chapterId}/`;
    
    try {
      await FileSystem.deleteAsync(chapterDir, { idempotent: true });
      this.downloadedChapters.delete(chapterId);
      await this.saveDownloadedChapters();
      this.notifyListeners();
    } catch (error) {
      console.error('删除章节失败:', error);
      throw error;
    }
  }

  async downloadChapterDirect(comicId, comicTitle, chapter, source, onProgress) {
    const { id: chapterId, title: chapterTitle } = chapter;
    
    // 检查是否已下载
    if (this.downloadedChapters.has(chapterId)) {
      console.log(`章节 ${chapterTitle} 已下载`);
      if (onProgress) onProgress({ status: 'already_downloaded' });
      return { success: true, alreadyDownloaded: true };
    }

    try {
      console.log(`开始下载: ${chapterTitle}`);
      
      // 1. 获取章节下载信息
      const apiUrl = `/api/chapters/${chapterId}/download-info?source=${source}`;
      
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || '获取章节信息失败');
      }

      const { images, download_config } = data.data;
      const totalImages = images.length;
      console.log(`共${totalImages}张图片`);

      // 2. 创建下载目录
      const chapterDir = `${DOWNLOAD_DIR}${comicId}/${chapterId}/`;
      await FileSystem.makeDirectoryAsync(chapterDir, { intermediates: true });

      // 3. 下载所有图片
      let completed = 0;
      let failed = 0;

      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const filename = `${String(image.page).padStart(3, '0')}.jpg`;
        const filepath = `${chapterDir}${filename}`;

        try {
          // 只打印关键信息
          if (i === 0 || i === images.length - 1) {
            console.log(`下载第${image.page}页: ${image.url.substring(0, 80)}...`);
          }
          
          // 使用下载配置中的headers
          const downloadResult = await FileSystem.downloadAsync(
            image.url,
            filepath,
            {
              headers: download_config.headers
            }
          );
          
          // 验证文件是否真的存在并获取文件信息
          const fileInfo = await FileSystem.getInfoAsync(filepath);
          
          if (fileInfo.exists && fileInfo.size > 0) {
            completed++;
            // 只打印第一张和最后一张的详细信息
            if (i === 0 || i === images.length - 1) {
              console.log(`成功: ${(fileInfo.size / 1024).toFixed(1)}KB`);
            }
          } else {
            console.error(`第${image.page}页下载失败`);
            failed++;
          }
          
          if (onProgress) {
            onProgress({
              status: 'downloading',
              page: image.page,
              completed,
              failed,
              total: totalImages,
              percentage: Math.round((completed + failed) / totalImages * 100),
              fileSize: fileInfo.size
            });
          }
        } catch (error) {
          console.error(`第${image.page}页错误: ${error.message}`);
          failed++;
          
          if (onProgress) {
            onProgress({
              status: 'downloading',
              page: image.page,
              completed,
              failed,
              total: totalImages,
              percentage: Math.round((completed + failed) / totalImages * 100),
              error: error.message
            });
          }
        }
      }

      // 4. 保存元数据
      const metaData = {
        comicId,
        chapterId,
        chapterTitle,
        totalImages: images.length,
        successCount: completed,
        failedCount: failed,
        downloadedAt: new Date().toISOString()
      };
      
      const metaPath = `${chapterDir}meta.json`;
      await FileSystem.writeAsStringAsync(metaPath, JSON.stringify(metaData));

      // 5. 记录为已下载
      this.downloadedChapters.set(chapterId, {
        comicId,
        comicTitle,
        chapterId,
        chapterTitle,
        downloadedAt: new Date().toISOString()
      });
      await this.saveDownloadedChapters();
      this.notifyListeners();

      console.log(`下载完成: 成功${completed}张, 失败${failed}张`);
      
      if (onProgress) {
        onProgress({
          status: 'completed',
          completed,
          failed,
          total: totalImages,
          percentage: 100
        });
      }

      return {
        success: true,
        total: totalImages,
        successCount: completed,
        failedCount: failed
      };

    } catch (error) {
      console.error(`下载失败: ${error.message}`);
      if (onProgress) {
        onProgress({
          status: 'error',
          error: error.message
        });
      }
      throw error;
    }
  }
}

const downloadManager = new DownloadManager();
export default downloadManager;
