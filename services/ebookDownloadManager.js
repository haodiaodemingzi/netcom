/**
 * 电子书下载管理器
 * 支持并发下载整本书到本地txt文件，离线阅读，阅读进度记录
 */
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getChapterContent, getEbookChapters } from './api';
import { getSettings } from './storage';

const EBOOK_DIR = FileSystem.documentDirectory + 'ebooks/';
const EBOOK_TEMP_DIR = FileSystem.documentDirectory + 'ebooks_temp/';
const EBOOK_PROGRESS_KEY = '@ebook_reading_progress';
const EBOOK_DOWNLOADS_KEY = '@ebook_downloads';
const EBOOK_DOWNLOAD_PROGRESS_KEY = '@ebook_download_progress'; // 下载进度持久化

class EbookDownloadManager {
  constructor() {
    this.subscribers = [];
    this.state = {
      downloadedBooks: [], // 已下载的书籍列表
      downloading: null,   // 当前正在下载的书籍
      progress: 0,         // 下载进度 0-1
      status: 'idle',      // idle | downloading | paused | completed | failed | cancelled
      currentChapter: 0,   // 当前下载的章节索引
      totalChapters: 0,    // 总章节数
      chapterTitle: '',    // 当前章节标题
    };
    this.maxConcurrent = 10; // 默认并发数
    this.isCancelled = false; // 取消标志
    this.isPaused = false;    // 暂停标志
    this.currentDownloadInfo = null; // 当前下载信息（用于继续）
    this.init();
  }

  async init() {
    // 确保目录存在
    try {
      const dirInfo = await FileSystem.getInfoAsync(EBOOK_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(EBOOK_DIR, { intermediates: true });
      }
      const tempDirInfo = await FileSystem.getInfoAsync(EBOOK_TEMP_DIR);
      if (!tempDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(EBOOK_TEMP_DIR, { intermediates: true });
      }
      // 加载已下载的书籍列表
      await this.loadDownloadedBooks();
      // 加载设置
      await this.loadSettings();
      // 加载未完成的下载进度
      await this.loadDownloadProgress();
    } catch (error) {
      console.error('初始化电子书目录失败:', error);
    }
  }

  async loadSettings() {
    try {
      const settings = await getSettings();
      if (settings.maxConcurrentDownloads) {
        this.maxConcurrent = settings.maxConcurrentDownloads;
        console.log(`电子书下载并发数设置为: ${this.maxConcurrent}`);
      }
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  }

  // 加载未完成的下载进度
  async loadDownloadProgress() {
    try {
      const data = await AsyncStorage.getItem(EBOOK_DOWNLOAD_PROGRESS_KEY);
      if (data) {
        const progress = JSON.parse(data);
        if (progress && progress.bookId) {
          this.currentDownloadInfo = progress;
          this.updateState({
            downloading: { id: progress.bookId, title: progress.bookTitle },
            progress: progress.completedChapters / progress.totalChapters,
            status: 'paused',
            currentChapter: progress.completedChapters,
            totalChapters: progress.totalChapters,
            chapterTitle: progress.lastChapterTitle || '',
          });
        }
      }
    } catch (error) {
      console.error('加载下载进度失败:', error);
    }
  }

  // 保存下载进度
  async saveDownloadProgress(info) {
    try {
      await AsyncStorage.setItem(EBOOK_DOWNLOAD_PROGRESS_KEY, JSON.stringify(info));
    } catch (error) {
      console.error('保存下载进度失败:', error);
    }
  }

  // 清除下载进度
  async clearDownloadProgress() {
    try {
      await AsyncStorage.removeItem(EBOOK_DOWNLOAD_PROGRESS_KEY);
      this.currentDownloadInfo = null;
    } catch (error) {
      console.error('清除下载进度失败:', error);
    }
  }

  // 订阅状态变化
  subscribe(callback) {
    this.subscribers.push(callback);
    callback(this.state);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  // 通知订阅者
  notify() {
    this.subscribers.forEach(cb => cb(this.state));
  }

  // 更新状态
  updateState(updates) {
    this.state = { ...this.state, ...updates };
    this.notify();
  }

  // 加载已下载的书籍列表
  async loadDownloadedBooks() {
    try {
      const data = await AsyncStorage.getItem(EBOOK_DOWNLOADS_KEY);
      if (data) {
        this.state.downloadedBooks = JSON.parse(data);
      }
    } catch (error) {
      console.error('加载下载列表失败:', error);
    }
  }

  // 保存已下载的书籍列表
  async saveDownloadedBooks() {
    try {
      await AsyncStorage.setItem(EBOOK_DOWNLOADS_KEY, JSON.stringify(this.state.downloadedBooks));
    } catch (error) {
      console.error('保存下载列表失败:', error);
    }
  }

  // 检查书籍是否已下载
  async isBookDownloaded(bookId) {
    const filePath = EBOOK_DIR + `${bookId}.txt`;
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      return fileInfo.exists;
    } catch {
      return false;
    }
  }

  // 获取已下载的书籍信息
  getDownloadedBook(bookId) {
    return this.state.downloadedBooks.find(b => b.id === bookId);
  }

  /**
   * 并发控制器 - 限制同时执行的任务数，支持暂停
   */
  async downloadWithConcurrency(items, concurrency, handler, onItemComplete, startIndex = 0) {
    const results = new Array(items.length);
    let completedCount = startIndex;
    let activeCount = 0;
    let currentIndex = startIndex;
    
    return new Promise((resolve) => {
      const processNext = async () => {
        if (this.isCancelled) {
          resolve({ results, stoppedAt: currentIndex, reason: 'cancelled' });
          return;
        }
        
        if (this.isPaused) {
          resolve({ results, stoppedAt: currentIndex, reason: 'paused' });
          return;
        }
        
        while (activeCount < concurrency && currentIndex < items.length) {
          if (this.isCancelled || this.isPaused) break;
          
          const index = currentIndex++;
          const item = items[index];
          activeCount++;
          
          handler(item, index)
            .then(result => {
              results[index] = result;
              completedCount++;
              activeCount--;
              
              if (onItemComplete) {
                onItemComplete(completedCount, items.length, item, result);
              }
              
              if (this.isPaused || this.isCancelled) {
                if (activeCount === 0) {
                  resolve({ results, stoppedAt: currentIndex, reason: this.isCancelled ? 'cancelled' : 'paused' });
                }
                return;
              }
              
              if (completedCount === items.length) {
                resolve({ results, stoppedAt: items.length, reason: 'completed' });
              } else {
                processNext();
              }
            })
            .catch(error => {
              results[index] = { error, failed: true };
              completedCount++;
              activeCount--;
              
              if (onItemComplete) {
                onItemComplete(completedCount, items.length, item, { error, failed: true });
              }
              
              if (this.isPaused || this.isCancelled) {
                if (activeCount === 0) {
                  resolve({ results, stoppedAt: currentIndex, reason: this.isCancelled ? 'cancelled' : 'paused' });
                }
                return;
              }
              
              if (completedCount === items.length) {
                resolve({ results, stoppedAt: items.length, reason: 'completed' });
              } else {
                processNext();
              }
            });
        }
      };
      
      processNext();
    });
  }

  /**
   * 下载整本书 - 并发版本，支持暂停继续
   * @param {string} bookId - 书籍ID
   * @param {string} bookTitle - 书籍标题
   * @param {string} author - 作者
   * @param {string} source - 数据源
   * @param {Function} onProgress - 进度回调
   * @param {boolean} resume - 是否继续下载
   */
  async downloadBook(bookId, bookTitle, author, source, onProgress, resume = false) {
    if (this.state.status === 'downloading') {
      throw new Error('已有下载任务进行中');
    }

    // 重新加载设置获取最新并发数
    await this.loadSettings();
    
    this.isCancelled = false;
    this.isPaused = false;
    const tempBookDir = EBOOK_TEMP_DIR + `${bookId}/`;
    
    // 检查是否有未完成的下载
    let startIndex = 0;
    if (resume && this.currentDownloadInfo && this.currentDownloadInfo.bookId === bookId) {
      startIndex = this.currentDownloadInfo.completedChapters;
      console.log(`继续下载《${bookTitle}》，从第 ${startIndex + 1} 章开始`);
    }

    try {
      this.updateState({
        downloading: { id: bookId, title: bookTitle },
        progress: startIndex / (this.currentDownloadInfo?.totalChapters || 1),
        status: 'downloading',
        currentChapter: startIndex,
        totalChapters: this.currentDownloadInfo?.totalChapters || 0,
        chapterTitle: '',
      });

      // 创建临时目录
      const tempDirInfo = await FileSystem.getInfoAsync(tempBookDir);
      if (!tempDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(tempBookDir, { intermediates: true });
      }

      // 获取章节列表
      const chaptersData = await getEbookChapters(bookId, source);
      const chapters = chaptersData.chapters || [];
      
      if (chapters.length === 0) {
        throw new Error('没有可下载的章节');
      }

      // 更新总章节数
      this.updateState({ totalChapters: chapters.length });

      console.log(`开始并发下载《${bookTitle}》，共 ${chapters.length} 章，从第 ${startIndex + 1} 章开始，并发数: ${this.maxConcurrent}`);
      
      // 并发下载每个章节到小文件
      const downloadChapter = async (chapter, index) => {
        if (this.isCancelled) {
          return { skipped: true };
        }
        
        const chapterFilePath = tempBookDir + `chapter_${String(index).padStart(5, '0')}.txt`;
        
        try {
          const chapterData = await getChapterContent(chapter.id, source);
          const chapterTitle = chapterData.title || chapter.title || `第${index + 1}章`;
          const chapterContent = chapterData.content || '';
          
          // 写入小文件
          const fileContent = `
${'─'.repeat(30)}
${chapterTitle}
${'─'.repeat(30)}

${chapterContent}
`;
          await FileSystem.writeAsStringAsync(chapterFilePath, fileContent, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          
          return { success: true, title: chapterTitle, path: chapterFilePath };
        } catch (error) {
          console.error(`下载章节 ${chapter.title} 失败:`, error);
          const failContent = `\n[章节 ${chapter.title} 加载失败]\n`;
          await FileSystem.writeAsStringAsync(chapterFilePath, failContent, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          return { success: false, title: chapter.title, path: chapterFilePath, error };
        }
      };

      // 执行并发下载
      const downloadResult = await this.downloadWithConcurrency(
        chapters,
        this.maxConcurrent,
        downloadChapter,
        (completed, total, chapter, result) => {
          const progress = completed / total;
          this.updateState({ 
            progress,
            currentChapter: completed,
            chapterTitle: result?.title || chapter.title,
          });
          
          // 保存下载进度
          this.saveDownloadProgress({
            bookId,
            bookTitle,
            author,
            source,
            completedChapters: completed,
            totalChapters: total,
            lastChapterTitle: result?.title || chapter.title,
          });
          
          if (onProgress) {
            onProgress({
              current: completed,
              total: total,
              percentage: Math.round(progress * 100),
              chapterTitle: result?.title || chapter.title,
            });
          }
        },
        startIndex
      );

      // 检查是否暂停
      if (downloadResult.reason === 'paused') {
        console.log(`《${bookTitle}》下载已暂停，已完成 ${downloadResult.stoppedAt} 章`);
        return { success: false, paused: true, completedChapters: downloadResult.stoppedAt };
      }

      // 检查是否取消
      if (downloadResult.reason === 'cancelled' || this.isCancelled) {
        await FileSystem.deleteAsync(tempBookDir, { idempotent: true });
        await this.clearDownloadProgress();
        this.updateState({
          downloading: null,
          progress: 0,
          status: 'cancelled',
          currentChapter: 0,
          totalChapters: 0,
          chapterTitle: '',
        });
        throw new Error('下载已取消');
      }

      // 合并所有小文件为大文件
      console.log('开始合并章节文件...');
      let content = `${bookTitle}\n`;
      if (author) {
        content += `作者：${author}\n`;
      }
      content += `\n${'='.repeat(50)}\n\n`;

      // 按顺序读取并合并
      for (let i = 0; i < chapters.length; i++) {
        const chapterFilePath = tempBookDir + `chapter_${String(i).padStart(5, '0')}.txt`;
        try {
          const chapterContent = await FileSystem.readAsStringAsync(chapterFilePath, {
            encoding: FileSystem.EncodingType.UTF8,
          });
          content += chapterContent;
        } catch (error) {
          console.error(`读取章节文件失败:`, error);
          content += `\n[章节 ${i + 1} 读取失败]\n`;
        }
      }

      // 保存到最终文件
      const filePath = EBOOK_DIR + `${bookId}.txt`;
      await FileSystem.writeAsStringAsync(filePath, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // 清理临时目录
      await FileSystem.deleteAsync(tempBookDir, { idempotent: true });

      // 更新已下载列表
      const bookInfo = {
        id: bookId,
        title: bookTitle,
        author: author || '',
        source,
        totalChapters: chapters.length,
        downloadedAt: Date.now(),
        filePath,
        fileSize: content.length,
      };

      this.state.downloadedBooks = this.state.downloadedBooks.filter(b => b.id !== bookId);
      this.state.downloadedBooks.unshift(bookInfo);
      await this.saveDownloadedBooks();

      // 清除下载进度
      await this.clearDownloadProgress();

      this.updateState({
        downloadedBooks: [...this.state.downloadedBooks],
        downloading: null,
        progress: 1,
        status: 'completed',
        currentChapter: chapters.length,
        totalChapters: chapters.length,
        chapterTitle: '',
      });

      console.log(`《${bookTitle}》下载完成！`);
      return { success: true, filePath, bookInfo };

    } catch (error) {
      console.error('下载书籍失败:', error);
      try {
        await FileSystem.deleteAsync(tempBookDir, { idempotent: true });
      } catch {}
      
      if (!this.isCancelled) {
        this.updateState({
          downloading: null,
          progress: 0,
          status: 'failed',
        });
      }
      throw error;
    }
  }

  /**
   * 读取本地书籍内容
   * @param {string} bookId - 书籍ID
   */
  async readBook(bookId) {
    const filePath = EBOOK_DIR + `${bookId}.txt`;
    try {
      const content = await FileSystem.readAsStringAsync(filePath, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      return content;
    } catch (error) {
      console.error('读取书籍失败:', error);
      throw new Error('书籍文件不存在或已损坏');
    }
  }

  /**
   * 删除已下载的书籍
   * @param {string} bookId - 书籍ID
   */
  async deleteBook(bookId) {
    const filePath = EBOOK_DIR + `${bookId}.txt`;
    try {
      await FileSystem.deleteAsync(filePath, { idempotent: true });
      
      // 更新列表
      this.state.downloadedBooks = this.state.downloadedBooks.filter(b => b.id !== bookId);
      await this.saveDownloadedBooks();
      
      // 同时删除阅读进度
      await this.deleteReadingProgress(bookId);

      this.updateState({
        downloadedBooks: [...this.state.downloadedBooks],
      });

      return true;
    } catch (error) {
      console.error('删除书籍失败:', error);
      throw error;
    }
  }

  /**
   * 保存阅读进度
   * @param {string} bookId - 书籍ID
   * @param {object} progress - 进度信息
   */
  async saveReadingProgress(bookId, progress) {
    try {
      const data = await AsyncStorage.getItem(EBOOK_PROGRESS_KEY);
      const allProgress = data ? JSON.parse(data) : {};
      
      allProgress[bookId] = {
        ...progress,
        updatedAt: Date.now(),
      };
      
      await AsyncStorage.setItem(EBOOK_PROGRESS_KEY, JSON.stringify(allProgress));
      return true;
    } catch (error) {
      console.error('保存阅读进度失败:', error);
      return false;
    }
  }

  /**
   * 获取阅读进度
   * @param {string} bookId - 书籍ID
   */
  async getReadingProgress(bookId) {
    try {
      const data = await AsyncStorage.getItem(EBOOK_PROGRESS_KEY);
      if (!data) return null;
      
      const allProgress = JSON.parse(data);
      return allProgress[bookId] || null;
    } catch (error) {
      console.error('获取阅读进度失败:', error);
      return null;
    }
  }

  /**
   * 删除阅读进度
   * @param {string} bookId - 书籍ID
   */
  async deleteReadingProgress(bookId) {
    try {
      const data = await AsyncStorage.getItem(EBOOK_PROGRESS_KEY);
      if (!data) return;
      
      const allProgress = JSON.parse(data);
      delete allProgress[bookId];
      
      await AsyncStorage.setItem(EBOOK_PROGRESS_KEY, JSON.stringify(allProgress));
    } catch (error) {
      console.error('删除阅读进度失败:', error);
    }
  }

  /**
   * 获取所有已下载书籍
   */
  getDownloadedBooks() {
    return this.state.downloadedBooks;
  }

  /**
   * 获取当前状态
   */
  getState() {
    return this.state;
  }

  /**
   * 取消下载
   */
  async cancelDownload() {
    this.isCancelled = true;
    this.isPaused = false;
    await this.clearDownloadProgress();
    this.updateState({
      downloading: null,
      progress: 0,
      status: 'cancelled',
      currentChapter: 0,
      totalChapters: 0,
      chapterTitle: '',
    });
    console.log('下载已取消');
  }

  /**
   * 暂停下载
   */
  pauseDownload() {
    if (this.state.status === 'downloading') {
      this.isPaused = true;
      this.updateState({
        status: 'paused',
      });
      console.log('下载已暂停');
    }
  }

  /**
   * 继续下载
   */
  async resumeDownload(onProgress) {
    if (this.state.status !== 'paused' || !this.currentDownloadInfo) {
      console.log('没有可继续的下载任务');
      return;
    }

    const { bookId, bookTitle, author, source } = this.currentDownloadInfo;
    console.log(`继续下载《${bookTitle}》`);
    
    return this.downloadBook(bookId, bookTitle, author, source, onProgress, true);
  }

  /**
   * 检查是否有未完成的下载
   */
  hasPendingDownload() {
    return this.state.status === 'paused' && this.currentDownloadInfo !== null;
  }

  /**
   * 获取待继续的下载信息
   */
  getPendingDownloadInfo() {
    return this.currentDownloadInfo;
  }
}

// 导出单例
const ebookDownloadManager = new EbookDownloadManager();
export default ebookDownloadManager;
