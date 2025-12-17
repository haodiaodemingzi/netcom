import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DownloadQueue } from './download/DownloadQueue';
import { VideoDownloadTask } from './download/VideoDownloadTask';
import { VideoDownloader } from './download/VideoDownloader';
import { getEpisodeDetail, setCurrentVideoSource } from './videoApi';

const VIDEO_DOWNLOAD_DIR = `${FileSystem.documentDirectory}netcom/videos/`;

// 使用 legacy API 的辅助函数
const getInfoAsync = FileSystem.getInfoAsync.bind(FileSystem);
const makeDirectoryAsync = FileSystem.makeDirectoryAsync.bind(FileSystem);
const writeAsStringAsync = FileSystem.writeAsStringAsync.bind(FileSystem);
const deleteAsync = FileSystem.deleteAsync.bind(FileSystem);

class VideoDownloadManager {
  constructor() {
    this.downloadedEpisodes = new Map();
    this.listeners = new Set();
    this.maxConcurrent = 2; // 视频转换较耗资源，默认2个并发
    this.initialized = false;
    
    this.queue = new DownloadQueue(this.maxConcurrent);
    this.downloader = new VideoDownloader(3, 1000);
    
    this.setupQueueListeners();
    this.init();
  }

  async init() {
    try {
      await this.ensureDownloadDir();
      await this.loadDownloadedEpisodes();
      this.initialized = true;
      console.log('VideoDownloadManager 初始化完成');
      this.notifyListeners();
    } catch (error) {
      console.error('VideoDownloadManager 初始化失败:', error);
      this.initialized = true;
    }
  }

  async ensureDownloadDir() {
    const dirInfo = await getInfoAsync(VIDEO_DOWNLOAD_DIR);
    if (!dirInfo.exists) {
      await makeDirectoryAsync(VIDEO_DOWNLOAD_DIR, { intermediates: true });
    }
  }

  async loadDownloadedEpisodes() {
    try {
      const data = await AsyncStorage.getItem('downloaded_videos');
      if (data) {
        const episodes = JSON.parse(data);
        this.downloadedEpisodes = new Map(Object.entries(episodes));
        console.log('已加载已下载视频:', this.downloadedEpisodes.size);
      }
    } catch (error) {
      console.error('加载已下载视频失败:', error);
    }
  }

  async saveDownloadedEpisodes() {
    try {
      const data = Object.fromEntries(this.downloadedEpisodes);
      await AsyncStorage.setItem('downloaded_videos', JSON.stringify(data));
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
      queue: [...allTasks.pending, ...allTasks.running, ...allTasks.paused, ...allTasks.failed].map(task => task.getInfo()),
      activeDownloads: allTasks.running.map(task => task.getInfo()),
      downloadedEpisodes: Array.from(this.downloadedEpisodes.keys()),
      queueInfo: queueInfo,
    };
  }

  pauseAll() {
    const allTasks = this.queue.getAllTasks();
    const tasksToPause = [...allTasks.pending, ...allTasks.running];
    for (const task of tasksToPause) {
      if (!task || !task.id) {
        continue;
      }
      this.queue.pauseTask(task.id);
    }
  }

  resumeAll() {
    const allTasks = this.queue.getAllTasks();
    const tasksToResume = [...allTasks.paused];
    for (const task of tasksToResume) {
      if (!task || !task.episodeId) {
        continue;
      }
      this.resumeDownload(task.episodeId);
    }
  }

  retryFailed() {
    const allTasks = this.queue.getAllTasks();
    const tasksToRetry = [...allTasks.failed];
    for (const task of tasksToRetry) {
      if (!task || !task.episodeId) {
        continue;
      }
      this.retryDownload(task.episodeId);
    }
  }

  async downloadEpisode(seriesId, seriesTitle, episode, source, onProgress) {
    // 检查是否已下载
    if (this.downloadedEpisodes.has(episode.id)) {
      if (onProgress) {
        onProgress({ status: 'already_downloaded' });
      }
      return { success: true, alreadyDownloaded: true };
    }

    try {
      // 获取剧集详情以获取m3u8 URL
      console.log(`获取剧集详情: ${episode.id}, source: ${source}`);
      // 设置当前数据源确保获取正确的视频URL
      if (source) {
        setCurrentVideoSource(source);
      }
      const episodeDetail = await getEpisodeDetail(episode.id);
      
      if (!episodeDetail.success || !episodeDetail.data || !episodeDetail.data.videoUrl) {
        throw new Error('无法获取视频URL');
      }

      const videoUrl = episodeDetail.data.videoUrl;
      console.log(`视频URL: ${videoUrl}`);

      // 检查视频类型
      const isM3u8 = videoUrl.includes('.m3u8') || videoUrl.includes('m3u8');
      const isMp4 = videoUrl.includes('.mp4') || videoUrl.includes('mp4');
      
      if (!isM3u8 && !isMp4) {
        throw new Error('不支持的视频格式，仅支持 m3u8 和 mp4');
      }

      // 创建下载任务
      const task = new VideoDownloadTask(
        episode.id,
        seriesId,
        seriesTitle,
        episode.title || `第${episode.episodeNumber || ''}集`,
        videoUrl,
        source
      );

      if (onProgress) {
        task.onProgress = (t) => {
          onProgress({
            status: t.status,
            progress: t.progress,
            currentTime: t.currentTime,
            duration: t.duration,
          });
        };
      }

      this.queue.addTask(task);
      console.log(`剧集 ${episode.title} 已添加到下载队列`);

      return { success: true };
    } catch (error) {
      console.error('下载剧集失败:', error);
      if (onProgress) {
        onProgress({ status: 'failed', error: error.message });
      }
      return { success: false, error: error.message };
    }
  }

  async batchDownloadEpisodes(seriesId, seriesTitle, episodes, source) {
    let addedCount = 0;

    for (const episode of episodes) {
      if (this.downloadedEpisodes.has(episode.id)) {
        console.log(`剧集${episode.title}已下载，跳过`);
        continue;
      }

      try {
        const result = await this.downloadEpisode(seriesId, seriesTitle, episode, source);
        if (result.success) {
          addedCount++;
        }
      } catch (error) {
        console.error(`添加剧集${episode.id}到下载队列失败:`, error);
      }
    }

    console.log(`已添加${addedCount}个剧集到下载队列`);
    return addedCount;
  }

  async handleTaskStart(task) {
    console.log(`开始执行下载任务: ${task.episodeTitle}`);
    this.downloader.downloadTask(task, VIDEO_DOWNLOAD_DIR).catch(error => {
      console.error(`下载任务执行失败: ${task.episodeTitle}`, error);
    });
  }

  async handleTaskComplete(task) {
    const episodeData = {
      seriesId: task.seriesId,
      seriesTitle: task.seriesTitle,
      episodeId: task.episodeId,
      episodeTitle: task.episodeTitle,
      source: task.source,
      outputPath: task.outputPath,
      downloadedAt: new Date().toISOString()
    };
    
    // 保存 meta.json 文件到剧集目录
    const seriesDir = `${VIDEO_DOWNLOAD_DIR}${task.seriesId}/`;
    const metaPath = `${seriesDir}${task.episodeId}.json`;
    try {
      await writeAsStringAsync(
        metaPath,
        JSON.stringify(episodeData, null, 2)
      );
      console.log(`meta.json已保存: ${metaPath}`);
    } catch (error) {
      console.error('保存meta.json失败:', error);
    }
    
    this.downloadedEpisodes.set(task.episodeId, episodeData);
    console.log(`剧集${task.episodeId}已添加到已下载列表`);
    await this.saveDownloadedEpisodes();
    console.log(`已下载剧集已保存到 AsyncStorage`);
  }

  handleTaskFail(task, error) {
    console.error(`下载失败: ${task.episodeTitle}`, error);
  }

  isDownloaded(episodeId) {
    return this.downloadedEpisodes.has(episodeId);
  }

  getDownloadStatus(episodeId) {
    if (this.downloadedEpisodes.has(episodeId)) {
      return 'completed';
    }
    
    const allTasks = this.queue.getAllTasks();
    const allTasksList = [
      ...allTasks.pending,
      ...allTasks.running,
      ...allTasks.failed
    ];
    
    const task = allTasksList.find(t => t.episodeId === episodeId);
    if (task) {
      return {
        status: task.status,
        progress: task.progress,
        error: task.error, // 确保返回错误信息
      };
    }
    return null;
  }

  pauseDownload(episodeId) {
    const allTasks = this.queue.getAllTasks();
    const task = [...allTasks.pending, ...allTasks.running].find(t => t.episodeId === episodeId);
    if (task) {
      return this.queue.pauseTask(task.id);
    }
    return false;
  }

  resumeDownload(episodeId) {
    const allTasks = this.queue.getAllTasks();
    const task = allTasks.paused.find(t => t.episodeId === episodeId);
    if (task) {
      // 注意：FFmpegKit不支持真正的暂停/继续，需要重新开始
      // 这里我们取消旧任务，创建新任务
      this.queue.removeTask(task.id);
      // 重新创建任务
      const newTask = new VideoDownloadTask(
        task.episodeId,
        task.seriesId,
        task.seriesTitle,
        task.episodeTitle,
        task.videoUrl,
        task.source
      );
      newTask.setOutputPath(task.outputPath);
      this.queue.addTask(newTask);
      return true;
    }
    return false;
  }

  cancelDownload(episodeId) {
    const allTasks = this.queue.getAllTasks();
    const task = [...allTasks.pending, ...allTasks.running, ...allTasks.paused].find(t => t.episodeId === episodeId);
    if (task) {
      return this.queue.removeTask(task.id);
    }
    return false;
  }

  retryDownload(episodeId) {
    const allTasks = this.queue.getAllTasks();
    const task = allTasks.failed.find(t => t.episodeId === episodeId);
    if (task) {
      // 重新创建任务
      const newTask = new VideoDownloadTask(
        task.episodeId,
        task.seriesId,
        task.seriesTitle,
        task.episodeTitle,
        task.videoUrl,
        task.source
      );
      this.queue.addTask(newTask);
      this.queue.removeTask(task.id);
      return true;
    }
    return false;
  }

  async deleteEpisode(seriesId, episodeId) {
    try {
      const episodeData = this.downloadedEpisodes.get(episodeId);
      if (!episodeData) {
        return false;
      }
      
      this.downloadedEpisodes.delete(episodeId);
      
      // 删除本地文件
      const filePath = `${VIDEO_DOWNLOAD_DIR}${seriesId}/${episodeId}.mp4`;
      const metaPath = `${VIDEO_DOWNLOAD_DIR}${seriesId}/${episodeId}.json`;
      
      const fileInfo = await getInfoAsync(filePath);
      if (fileInfo.exists) {
        await deleteAsync(filePath, { idempotent: true });
        console.log(`已删除视频文件: ${filePath}`);
      }
      
      const metaInfo = await getInfoAsync(metaPath);
      if (metaInfo.exists) {
        await deleteAsync(metaPath, { idempotent: true });
        console.log(`已删除meta文件: ${metaPath}`);
      }
      
      await this.saveDownloadedEpisodes();
      this.notifyListeners();
      
      return true;
    } catch (error) {
      console.error('删除剧集失败:', error);
      return false;
    }
  }

  getLocalVideoPath(seriesId, episodeId) {
    return `${VIDEO_DOWNLOAD_DIR}${seriesId}/${episodeId}.mp4`;
  }

  async checkLocalVideoExists(seriesId, episodeId) {
    try {
      const localPath = this.getLocalVideoPath(seriesId, episodeId);
      const fileInfo = await getInfoAsync(localPath);
      return fileInfo.exists && fileInfo.size > 0;
    } catch (error) {
      console.error('检查本地视频文件失败:', error);
      return false;
    }
  }

  async getLocalVideoUri(seriesId, episodeId) {
    // 如果提供了 seriesId，直接检查
    if (seriesId) {
      const exists = await this.checkLocalVideoExists(seriesId, episodeId);
      if (exists) {
        return this.getLocalVideoPath(seriesId, episodeId);
      }
    }
    
    // 如果没有 seriesId 或找不到，尝试从已下载的记录中查找
    const episodeData = this.downloadedEpisodes.get(episodeId);
    if (episodeData && episodeData.seriesId) {
      const exists = await this.checkLocalVideoExists(episodeData.seriesId, episodeId);
      if (exists) {
        return this.getLocalVideoPath(episodeData.seriesId, episodeId);
      }
    }
    
    return null;
  }

  // 清理所有下载的视频文件和记录
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
      this.downloadedEpisodes.clear();
      await this.saveDownloadedEpisodes();
      
      // 删除下载目录
      const dirInfo = await getInfoAsync(VIDEO_DOWNLOAD_DIR);
      if (dirInfo.exists) {
        await deleteAsync(VIDEO_DOWNLOAD_DIR, { idempotent: true });
        console.log('已删除视频下载目录');
      }
      
      // 重新创建空目录
      await this.ensureDownloadDir();
      
      // 通知监听器
      this.notifyListeners();
      
      return true;
    } catch (error) {
      console.error('清理视频下载失败:', error);
      return false;
    }
  }
}

const videoDownloadManager = new VideoDownloadManager();
export default videoDownloadManager;

