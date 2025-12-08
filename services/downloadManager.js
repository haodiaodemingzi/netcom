import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';
import { DownloadQueue } from './download/DownloadQueue';
import { DownloadTask } from './download/DownloadTask';
import { ImageDownloader } from './download/ImageDownloader';
import { XmanhuaAdapter } from './download/adapters/XmanhuaAdapter';
import { HmzxaAdapter } from './download/adapters/HmzxaAdapter';
import { getSettings } from './storage';

const DOWNLOAD_DIR = `${FileSystem.documentDirectory}netcom/downloads/`;

// 使用 legacy API 的辅助函数（避免弃用警告，但功能正常）
const getInfoAsync = FileSystem.getInfoAsync.bind(FileSystem);
const makeDirectoryAsync = FileSystem.makeDirectoryAsync.bind(FileSystem);
const readAsStringAsync = FileSystem.readAsStringAsync.bind(FileSystem);
const writeAsStringAsync = FileSystem.writeAsStringAsync.bind(FileSystem);
const deleteAsync = FileSystem.deleteAsync.bind(FileSystem);
const downloadAsync = FileSystem.downloadAsync.bind(FileSystem);

class DownloadManager {
  constructor() {
    this.downloadedChapters = new Map();
    this.listeners = new Set();
    this.cachedCookies = new Map(); // 按数据源缓存cookie
    this.cookiesExpireTime = new Map(); // 按数据源记录过期时间
    this.maxConcurrent = 10; // 默认值
    this.initialized = false; // 初始化标志
    
    this.queue = new DownloadQueue(this.maxConcurrent);
    this.downloader = new ImageDownloader(3, 1000, this.maxConcurrent);
    
    this.apiClient = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
    });
    
    this.adapters = {
      xmanhua: new XmanhuaAdapter(this.apiClient),
      hmzxa: new HmzxaAdapter(this.apiClient, this),
    };
    
    this.setupQueueListeners();
    this.init();
  }

  async init() {
    try {
      await this.ensureDownloadDir();
      await this.loadDownloadedChapters();
      await this.loadSettings();
      this.initialized = true;
      console.log('DownloadManager 初始化完成');
      this.notifyListeners();
    } catch (error) {
      console.error('DownloadManager 初始化失败:', error);
      this.initialized = true; // 即使失败也标记为已初始化
    }
  }
  
  async loadSettings() {
    try {
      const settings = await getSettings();
      if (settings.maxConcurrentDownloads) {
        this.maxConcurrent = settings.maxConcurrentDownloads;
        this.queue.setMaxConcurrent(this.maxConcurrent);
        this.downloader.setMaxConcurrent(this.maxConcurrent);
        console.log(`下载并发数设置为: ${this.maxConcurrent}`);
      }
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  }
  
  async updateMaxConcurrent(max) {
    this.maxConcurrent = max;
    this.queue.setMaxConcurrent(max);
    this.downloader.setMaxConcurrent(max);
  }
  
  async getCookies(source) {
    if (!source) {
      console.warn('getCookies: 未指定数据源');
      return '';
    }
    
    // 如果缓存的cookie还没过期，直接返回
    const now = Date.now();
    const cachedCookie = this.cachedCookies.get(source);
    const expireTime = this.cookiesExpireTime.get(source);
    
    if (cachedCookie && expireTime && now < expireTime) {
      return cachedCookie;
    }
    
    try {
      // 根据数据源选择访问的URL
      const sourceUrls = {
        'xmanhua': 'https://xmanhua.com/',
        'hmzxa': 'https://hmzxa.com/',
      };
      
      const url = sourceUrls[source];
      if (!url) {
        console.warn(`getCookies: 未知数据源 ${source}`);
        return '';
      }
      
      // 访问主站获取cookie
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        credentials: 'include'
      });
      
      const setCookie = response.headers.get('set-cookie');
      console.log(`获取到${source}的Cookie:`, setCookie);
      
      // 缓存cookie，5分钟后过期
      const cookieValue = setCookie || '';
      this.cachedCookies.set(source, cookieValue);
      this.cookiesExpireTime.set(source, now + 5 * 60 * 1000);
      
      return cookieValue;
    } catch (error) {
      console.error(`获取${source}的Cookie失败:`, error);
      return '';
    }
  }

  async ensureDownloadDir() {
    const dirInfo = await getInfoAsync(DOWNLOAD_DIR);
    if (!dirInfo.exists) {
      await makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });
    }
  }

  async loadDownloadedChapters() {
    try {
      const data = await AsyncStorage.getItem('downloaded_chapters');
      console.log('从 AsyncStorage 加载已下载章节:', data ? '有数据' : '无数据');
      if (data) {
        const chapters = JSON.parse(data);
        console.log('已下载章节数:', Object.keys(chapters).length);
        this.downloadedChapters = new Map(Object.entries(chapters));
        console.log('已下载章节列表:', Array.from(this.downloadedChapters.keys()).slice(0, 10));
      } else {
        console.log('AsyncStorage 中没有已下载章节数据');
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
      console.error('保存下载记录失败:', error);
    }
  }

  setupQueueListeners() {
    this.queue.onTaskStart = (task) => {
      this.handleTaskStart(task);
      this.notifyListeners();
    };
    
    this.queue.onTaskProgress = (task) => {
      this.notifyListeners();
    };
    
    this.queue.onTaskComplete = async (task) => {
      await this.handleTaskComplete(task);
      this.notifyListeners();
    };
    
    this.queue.onTaskFail = (task, error) => {
      this.handleTaskFail(task, error);
      this.notifyListeners();
    };
    
    this.queue.onQueueChange = () => {
      this.notifyListeners();
    };
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
    const queueInfo = this.queue.getQueueInfo();
    const allTasks = this.queue.getAllTasks();
    
    return {
      queue: [...allTasks.pending, ...allTasks.running, ...allTasks.paused].map(task => task.getInfo()),
      activeDownloads: allTasks.running.map(task => task.getInfo()),
      downloadedChapters: Array.from(this.downloadedChapters.keys()),
      queueInfo: queueInfo,
    };
  }

  async downloadChapters(comicId, comicTitle, chapters, source) {
    const adapter = this.adapters[source];
    if (!adapter) {
      console.error(`不支持的数据源: ${source}`);
      return;
    }

    let addedCount = 0;

    for (const chapter of chapters) {
      if (this.downloadedChapters.has(chapter.id)) {
        console.log(`章节${chapter.title}已下载，跳过`);
        continue;
      }

      try {
        console.log(`正在获取章节信息: ${chapter.title}`);
        const chapterInfo = await adapter.getChapterInfo(chapter.id);
        const images = chapterInfo.images || [];

        if (images.length === 0) {
          console.log(`章节${chapter.title}没有图片，跳过`);
          continue;
        }

        console.log(`章节${chapter.title}共${images.length}张图片，加入下载队列`);

        const task = new DownloadTask(
          chapter.id,
          comicId,
          comicTitle,
          chapter.title,
          images,
          source
        );

        this.queue.addTask(task);
        addedCount++;
      } catch (error) {
        console.error(`获取章节${chapter.id}信息失败:`, error);
      }
    }

    console.log(`已添加${addedCount}个章节到下载队列`);
  }

  async handleTaskStart(task) {
    console.log(`开始执行下载任务: ${task.chapterTitle}, 共${task.totalImages}张图片, 数据源: ${task.source}`);
    
    // 根据数据源获取对应的cookie
    if (task.source) {
      const cookies = await this.getCookies(task.source);
      task.cookies = cookies;
    }
    
    this.downloader.downloadTask(task, DOWNLOAD_DIR).catch(error => {
      console.error(`下载任务执行失败: ${task.chapterTitle}`, error);
    });
  }

  async handleTaskComplete(task) {
    const chapterData = {
      comicId: task.comicId,
      comicTitle: task.comicTitle,
      chapterId: task.chapterId,
      chapterTitle: task.chapterTitle,
      totalImages: task.totalImages,
      downloadedAt: new Date().toISOString()
    };
    
    // 保存 meta.json 文件到章节目录
    const chapterDir = `${DOWNLOAD_DIR}${task.comicId}/${task.chapterId}/`;
    const metaPath = `${chapterDir}meta.json`;
    try {
      await writeAsStringAsync(
        metaPath,
        JSON.stringify(chapterData, null, 2)
      );
      console.log(`meta.json已保存: ${metaPath}`);
    } catch (error) {
      console.error('保存meta.json失败:', error);
    }
    
    this.downloadedChapters.set(task.chapterId, chapterData);
    console.log(`章节${task.chapterId}已添加到已下载列表`);
    await this.saveDownloadedChapters();
    console.log(`已下载章节已保存到 AsyncStorage`);
  }

  handleTaskFail(task, error) {
    console.error(`下载失败: ${task.chapterTitle}`, error);
  }

  isDownloaded(chapterId) {
    return this.downloadedChapters.has(chapterId);
  }

  getChapterStatus(chapterId) {
    if (this.downloadedChapters.has(chapterId)) {
      return 'completed';
    }
    
    const allTasks = this.queue.getAllTasks();
    const allTasksList = [
      ...allTasks.pending,
      ...allTasks.running,
      ...allTasks.failed
    ];
    
    const task = allTasksList.find(t => t.chapterId === chapterId);
    return task ? task.status : null;
  }

  getChapterProgress(chapterId) {
    const allTasks = this.queue.getAllTasks();
    const allTasksList = [
      ...allTasks.pending,
      ...allTasks.running
    ];
    
    const task = allTasksList.find(t => t.chapterId === chapterId);
    return task ? task.progress : 0;
  }

  pauseDownload(chapterId) {
    // 查找包含该chapterId的任务
    const allTasks = this.queue.getAllTasks();
    const task = [...allTasks.pending, ...allTasks.running].find(t => t.chapterId === chapterId);
    if (task) {
      return this.queue.pauseTask(task.id);
    }
    return false;
  }

  resumeDownload(chapterId) {
    // 查找包含该chapterId的任务
    const allTasks = this.queue.getAllTasks();
    const task = allTasks.paused.find(t => t.chapterId === chapterId);
    if (task) {
      return this.queue.resumeTask(task.id);
    }
    return false;
  }

  cancelDownload(chapterId) {
    // 查找包含该chapterId的任务
    const allTasks = this.queue.getAllTasks();
    const task = [...allTasks.pending, ...allTasks.running, ...allTasks.paused].find(t => t.chapterId === chapterId);
    if (task) {
      return this.queue.removeTask(task.id);
    }
    return false;
  }

  retryDownload(chapterId) {
    // 查找包含该chapterId的任务
    const allTasks = this.queue.getAllTasks();
    const task = allTasks.failed.find(t => t.chapterId === chapterId);
    if (task) {
      return this.queue.retryTask(task.id);
    }
    return false;
  }
  
  async deleteDownloadedChapter(chapterId) {
    try {
      // 从内存中移除
      const chapterData = this.downloadedChapters.get(chapterId);
      if (!chapterData) {
        return false;
      }
      
      this.downloadedChapters.delete(chapterId);
      
      // 删除本地文件
      const chapterDir = `${DOWNLOAD_DIR}${chapterData.comicId}/${chapterId}/`;
      const dirInfo = await getInfoAsync(chapterDir);
      if (dirInfo.exists) {
        await deleteAsync(chapterDir, { idempotent: true });
        console.log(`已删除章节文件: ${chapterDir}`);
      }
      
      // 保存状态
      await this.saveDownloadedChapters();
      this.notifyListeners();
      
      return true;
    } catch (error) {
      console.error('删除章节失败:', error);
      return false;
    }
  }

  clearCompletedTasks() {
    this.queue.clearCompleted();
  }

  clearFailedTasks() {
    this.queue.clearFailed();
  }

  async getLocalChapterImages(comicId, chapterId) {
    const chapterDir = `${DOWNLOAD_DIR}${comicId}/${chapterId}/`;
    const metaPath = `${chapterDir}meta.json`;
    
    console.log('=== 加载本地章节 ===');
    console.log('章节目录:', chapterDir);
    
    try {
      // 检查目录是否存在
      const dirInfo = await getInfoAsync(chapterDir);
      
      if (!dirInfo.exists) {
        console.log('❌ 章节目录不存在');
        return null;
      }
      
      console.log('✓ 章节目录存在');
      
      // 检查meta.json
      const metaInfo = await getInfoAsync(metaPath);
      if (!metaInfo.exists) {
        console.log('❌ meta.json不存在');
        return null;
      }
      
      console.log('✓ meta.json存在');
      
      // 读取元数据
      const metaContent = await readAsStringAsync(metaPath);
      const meta = JSON.parse(metaContent);
      
      console.log('meta.json内容:', meta);
      console.log(`总图片数: ${meta.totalImages}`);
      
      const images = [];
      let missingCount = 0;
      
      for (let i = 1; i <= meta.totalImages; i++) {
        const filename = `${String(i).padStart(3, '0')}.jpg`;
        const filepath = `${chapterDir}${filename}`;
        
        // 验证文件是否存在
        const fileInfo = await getInfoAsync(filepath);
        
        if (fileInfo.exists && fileInfo.size > 0) {
          images.push({
            page: i,
            url: filepath,
            isLocal: true,
            size: fileInfo.size
          });
        } else {
          missingCount++;
          if (i <= 3) {
            console.log(`❌ 图片${i}缺失或为空: ${filepath}`);
          }
        }
      }
      
      console.log(`✓ 成功加载: ${images.length}张, 缺失: ${missingCount}张`);
      console.log('前3张图片路径:', images.slice(0, 3).map(img => img.url));
      
      return images;
    } catch (error) {
      console.error('❌ 加载本地章节失败:', error);
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

  async saveToGallery(chapterDir, totalImages, chapterTitle) {
    try {
      // 注意：expo-media-library 在 Android 上需要 development build 才能完全访问媒体库
      // Expo Go 可能无法提供完整权限，这是正常的警告，不影响功能
      // 请求相册权限
      const { status } = await MediaLibrary.requestPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('提示', '需要相册权限才能保存图片到相册');
        return;
      }
      
      let successCount = 0;
      let failCount = 0;
      
      // 创建相册（如果不存在）
      const albumName = '漫画下载';
      let album = await MediaLibrary.getAlbumAsync(albumName);
      
      for (let i = 1; i <= totalImages; i++) {
        try {
          const filename = `${String(i).padStart(3, '0')}.jpg`;
          const filepath = `${chapterDir}${filename}`;
          
          // 检查文件是否存在
          const fileInfo = await getInfoAsync(filepath);
          if (!fileInfo.exists) {
            failCount++;
            continue;
          }
          
          // 保存到相册
          const asset = await MediaLibrary.createAssetAsync(filepath);
          
          // 添加到专辑
          if (album === null) {
            album = await MediaLibrary.createAlbumAsync(albumName, asset, false);
          } else {
            await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
          }
          
          successCount++;
        } catch (error) {
          failCount++;
        }
      }
      
      // 提示用户
      if (successCount > 0) {
        Alert.alert(
          '保存成功',
          `${chapterTitle}\n已保存${successCount}张图片到相册"${albumName}"`
        );
      }
    } catch (error) {
      // 静默失败
    }
  }

  async deleteChapter(comicId, chapterId) {
    const chapterDir = `${DOWNLOAD_DIR}${comicId}/${chapterId}/`;
    
    try {
      // 删除文件
      await deleteAsync(chapterDir, { idempotent: true });
      
      // 从内存中删除
      this.downloadedChapters.delete(chapterId);
      
      // 从 AsyncStorage 中删除
      await this.saveDownloadedChapters();
      
      this.notifyListeners();
    } catch (error) {
      throw error;
    }
  }

  async downloadChapterDirect(comicId, comicTitle, chapter, source, onProgress) {
    const { id: chapterId, title: chapterTitle } = chapter;
    
    // 检查是否已下载
    if (this.downloadedChapters.has(chapterId)) {
      if (onProgress) onProgress({ status: 'already_downloaded' });
      return { success: true, alreadyDownloaded: true };
    }

    try {
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

      // 2. 创建下载目录
      const chapterDir = `${DOWNLOAD_DIR}${comicId}/${chapterId}/`;
      await makeDirectoryAsync(chapterDir, { intermediates: true });

      // 3. 如果有cookie_urls，先访问这些URL获取cookie
      let cookieHeader = '';
      if (download_config.cookie_urls && download_config.cookie_urls.length > 0) {
        for (const url of download_config.cookie_urls) {
          try {
            const cookieResponse = await fetch(url, {
              headers: download_config.headers || {},
              credentials: 'include'
            });
            
            // 从响应头中提取Set-Cookie
            const setCookieHeader = cookieResponse.headers.get('set-cookie');
            if (setCookieHeader) {
              cookieHeader += setCookieHeader + '; ';
            }
          } catch (error) {
            // 静默失败
          }
        }
      }

      // 4. 准备下载headers
      let downloadHeaders = { ...download_config.headers };
      if (cookieHeader) {
        downloadHeaders['Cookie'] = cookieHeader.trim();
      }

      // 5. 下载所有图片
      let completed = 0;
      let failed = 0;

      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const filename = `${String(image.page).padStart(3, '0')}.jpg`;
        const filepath = `${chapterDir}${filename}`;

        try {
          // 使用带cookie的headers下载
          const downloadResult = await downloadAsync(
            image.url,
            filepath,
            {
              headers: downloadHeaders
            }
          );
          
          // 验证文件是否真的存在并获取文件信息
          const fileInfo = await getInfoAsync(filepath);
          
          if (fileInfo.exists && fileInfo.size > 0) {
            completed++;
          } else {
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
      await writeAsStringAsync(metaPath, JSON.stringify(metaData));

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
      if (onProgress) {
        onProgress({
          status: 'error',
          error: error.message
        });
      }
      throw error;
    }
  }

  async downloadSingleImage(comicId, chapterId, page, imageUrl) {
    const chapterDir = `${DOWNLOAD_DIR}${comicId}/${chapterId}/`;
    await makeDirectoryAsync(chapterDir, { intermediates: true });
    
    const filename = `${String(page).padStart(3, '0')}.jpg`;
    const filepath = `${chapterDir}${filename}`;
    
    const fileInfo = await getInfoAsync(filepath);
    if (fileInfo.exists && fileInfo.size > 0) {
      return filepath;
    }
    
    const downloadHeaders = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
      'Referer': 'https://xmanhua.com/',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9'
    };
    
    // 获取并添加Cookie
    const cookies = await this.getCookies();
    if (cookies) {
      downloadHeaders['Cookie'] = cookies;
    }
    
    await downloadAsync(imageUrl, filepath, {
      headers: downloadHeaders
    });
    
    return filepath;
  }

  async getOrDownloadImage(comicId, chapterId, page, source) {
    const chapterDir = `${DOWNLOAD_DIR}${comicId}/${chapterId}/`;
    const filename = `${String(page).padStart(3, '0')}.jpg`;
    const filepath = `${chapterDir}${filename}`;
    
    const fileInfo = await getInfoAsync(filepath);
    if (fileInfo.exists && fileInfo.size > 0) {
      return { url: filepath, isLocal: true, page };
    }
    
    try {
      const response = await this.apiClient.get(`/chapters/${chapterId}/images/${page}`, {
        params: { source }
      });
      
      const imageData = response.data;
      await this.downloadSingleImage(comicId, chapterId, page, imageData.url);
      
      return { url: filepath, isLocal: true, page, total: imageData.total };
    } catch (error) {
      console.error(`获取第${page}页图片失败:`, error);
      throw error;
    }
  }

  // 清理所有下载的文件和记录
  async clearAllDownloads() {
    try {
      // 停止所有下载任务
      const allTasks = this.queue.getAllTasks();
      
      // 取消所有运行中的任务
      for (const task of allTasks.running) {
        task.cancel();
        this.queue.runningTasks.delete(task.id);
      }
      
      // 取消所有暂停的任务
      for (const task of allTasks.paused) {
        task.cancel();
        this.queue.pausedTasks.delete(task.id);
      }
      
      // 清空待处理任务列表
      this.queue.pendingTasks = [];
      
      // 清空下载记录
      this.downloadedChapters.clear();
      await this.saveDownloadedChapters();
      
      // 删除下载目录
      const dirInfo = await getInfoAsync(DOWNLOAD_DIR);
      if (dirInfo.exists) {
        await deleteAsync(DOWNLOAD_DIR, { idempotent: true });
        console.log('已删除漫画下载目录');
      }
      
      // 重新创建空目录
      await this.ensureDownloadDir();
      
      // 通知监听器
      this.notifyListeners();
      
      return true;
    } catch (error) {
      console.error('清理漫画下载失败:', error);
      return false;
    }
  }
}

const downloadManager = new DownloadManager();
export default downloadManager;
