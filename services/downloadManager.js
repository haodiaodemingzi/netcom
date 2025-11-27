import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getChapterImages } from './api';
import { Alert } from 'react-native';

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

    // 使用旧API获取图片
    console.log(`调用API获取章节图片`);
    const imagesData = await getChapterImages(chapterId, source);
    const images = imagesData.images || [];
    console.log(`获取到 ${images.length} 张图片`);

    task.totalImages = images.length;
    task.currentImage = 0;

    // 先访问网站首页获取cookie
    let cookieHeader = '';
    const cookieUrl = 'https://xmanhua.com/';
    
    console.log(`访问网站获取cookie: ${cookieUrl}`);
    
    try {
      const cookieResponse = await fetch(cookieUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9'
        },
        credentials: 'include'
      });
      
      // 从响应头中提取Set-Cookie
      const setCookieHeader = cookieResponse.headers.get('set-cookie');
      if (setCookieHeader) {
        console.log(`获取到cookie: ${setCookieHeader.substring(0, 80)}...`);
        cookieHeader = setCookieHeader;
      } else {
        console.log(`未获取到cookie`);
      }
    } catch (error) {
      console.log(`访问网站失败: ${error.message}`);
    }

    // 准备下载headers
    let downloadHeaders = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
      'Referer': 'https://xmanhua.com/',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9'
    };

    if (cookieHeader) {
      downloadHeaders['Cookie'] = cookieHeader;
      console.log(`下载headers已添加Cookie`);
    }
    
    console.log(`下载headers:`, JSON.stringify(downloadHeaders, null, 2));

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const filename = `${String(image.page).padStart(3, '0')}.jpg`;
      const filepath = `${chapterDir}${filename}`;

      // 打印图片下载信息
      if (i === 0 || i === images.length - 1 || i % 10 === 0) {
        console.log(`[下载] 第${image.page}页:`);
        console.log(`  URL: ${image.url}`);
        console.log(`  保存到: ${filepath}`);
        console.log(`  Headers:`, JSON.stringify(downloadHeaders, null, 2));
      }

      // 使用带headers和cookie的下载
      let downloadResult;
      if (Object.keys(downloadHeaders).length > 0) {
        downloadResult = await FileSystem.downloadAsync(image.url, filepath, {
          headers: downloadHeaders
        });
      } else {
        downloadResult = await FileSystem.downloadAsync(image.url, filepath);
      }
      
      // 打印下载响应
      if (i === 0 || i === images.length - 1 || i % 10 === 0) {
        console.log(`  下载响应:`, JSON.stringify(downloadResult, null, 2));
      }
      
      // 验证文件是否下载成功
      if (i === 0 || i === images.length - 1 || i % 10 === 0) {
        const fileInfo = await FileSystem.getInfoAsync(filepath);
        if (fileInfo.exists) {
          console.log(`  ✓ 下载成功: ${(fileInfo.size / 1024).toFixed(1)}KB`);
        } else {
          console.log(`  ✗ 下载失败: 文件不存在`);
        }
      }
      
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
    
    // 将章节添加到已下载列表
    this.downloadedChapters.set(chapterId, {
      comicId,
      comicTitle: task.comicTitle,
      chapterId,
      chapterTitle,
      downloadedAt: new Date().toISOString()
    });
    
    // 保存已下载章节列表
    await this.saveDownloadedChapters();
    this.notifyListeners();
    
    console.log(`章节下载完成: ${chapterTitle}, 共${images.length}张图片`);
    
    // 保存到相册（仅在开发构建中可用，Expo Go不支持）
    // 如果需要此功能，请运行 npx expo run:android
    // await this.saveToGallery(chapterDir, images.length, chapterTitle);
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
      console.log(`[读取本地章节] 章节ID: ${chapterId}`);
      console.log(`  目录: ${chapterDir}`);
      
      // 检查目录是否存在
      const dirInfo = await FileSystem.getInfoAsync(chapterDir);
      console.log(`  目录存在: ${dirInfo.exists}`);
      
      if (!dirInfo.exists) {
        console.error(`  ✗ 目录不存在`);
        return null;
      }
      
      // 读取元数据
      const metaContent = await FileSystem.readAsStringAsync(metaPath);
      const meta = JSON.parse(metaContent);
      console.log(`  元数据: 共${meta.totalImages}张图片`);
      
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
          
          // 只打印前3张的信息
          if (i <= 3) {
            console.log(`  ✓ 第${i}页: ${filename} (${(fileInfo.size / 1024).toFixed(1)}KB)`);
          }
        } else {
          missingCount++;
          if (i <= 3) {
            console.log(`  ✗ 第${i}页: ${filename} 不存在或为空`);
          }
        }
      }
      
      console.log(`  成功加载${images.length}/${meta.totalImages}张图片${missingCount > 0 ? `, 缺失${missingCount}张` : ''}`);
      return images;
    } catch (error) {
      console.error(`  读取失败: ${error.message}`);
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
      // 请求相册权限
      console.log('请求相册权限...');
      const { status } = await MediaLibrary.requestPermissionsAsync();
      
      if (status !== 'granted') {
        console.log('相册权限被拒绝');
        Alert.alert('提示', '需要相册权限才能保存图片到相册');
        return;
      }
      
      console.log(`开始保存${totalImages}张图片到相册...`);
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
          const fileInfo = await FileSystem.getInfoAsync(filepath);
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
          
          if (i === 1 || i === totalImages) {
            console.log(`  第${i}页已保存到相册`);
          }
        } catch (error) {
          console.error(`保存第${i}页失败:`, error.message);
          failCount++;
        }
      }
      
      console.log(`相册保存完成: 成功${successCount}张, 失败${failCount}张`);
      
      // 提示用户
      if (successCount > 0) {
        Alert.alert(
          '保存成功',
          `${chapterTitle}\n已保存${successCount}张图片到相册"${albumName}"`
        );
      }
    } catch (error) {
      console.error('保存到相册失败:', error);
    }
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

      // 3. 如果有cookie_urls，先访问这些URL获取cookie
      let cookieHeader = '';
      if (download_config.cookie_urls && download_config.cookie_urls.length > 0) {
        console.log(`访问 ${download_config.cookie_urls.length} 个URL获取cookie...`);
        
        for (const url of download_config.cookie_urls) {
          try {
            console.log(`  访问: ${url}`);
            const cookieResponse = await fetch(url, {
              headers: download_config.headers || {},
              credentials: 'include'
            });
            
            // 从响应头中提取Set-Cookie
            const setCookieHeader = cookieResponse.headers.get('set-cookie');
            if (setCookieHeader) {
              console.log(`  获取到cookie: ${setCookieHeader.substring(0, 50)}...`);
              cookieHeader += setCookieHeader + '; ';
            }
          } catch (error) {
            console.log(`  访问失败: ${error.message}`);
          }
        }
        
        if (cookieHeader) {
          console.log(`Cookie准备完成`);
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
          // 只打印关键信息
          if (i === 0 || i === images.length - 1) {
            console.log(`下载第${image.page}页: ${image.url.substring(0, 80)}...`);
          }
          
          // 使用带cookie的headers下载
          const downloadResult = await FileSystem.downloadAsync(
            image.url,
            filepath,
            {
              headers: downloadHeaders
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
