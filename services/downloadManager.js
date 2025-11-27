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
      const metaContent = await FileSystem.readAsStringAsync(metaPath);
      const meta = JSON.parse(metaContent);
      
      const images = [];
      for (let i = 1; i <= meta.totalImages; i++) {
        const filename = `${String(i).padStart(3, '0')}.jpg`;
        const filepath = `${chapterDir}${filename}`;
        images.push({
          page: i,
          url: filepath,
          isLocal: true
        });
      }
      
      return images;
    } catch (error) {
      console.error('读取本地章节失败:', error);
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
}

const downloadManager = new DownloadManager();
export default downloadManager;
