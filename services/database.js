import * as SQLite from 'expo-sqlite';

const DB_NAME = 'comic_reader.db';

class Database {
  constructor() {
    this.db = null;
  }

  async init() {
    try {
      this.db = await SQLite.openDatabaseAsync(DB_NAME);
      await this.createTables();
      console.log('数据库初始化完成');
    } catch (error) {
      console.error('数据库初始化失败:', error);
      throw error;
    }
  }

  async createTables() {
    try {
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS downloaded_chapters (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          chapterId TEXT UNIQUE NOT NULL,
          comicId TEXT NOT NULL,
          comicTitle TEXT NOT NULL,
          chapterTitle TEXT NOT NULL,
          totalImages INTEGER NOT NULL,
          downloadedAt TEXT NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_chapterId ON downloaded_chapters(chapterId);
        CREATE INDEX IF NOT EXISTS idx_comicId ON downloaded_chapters(comicId);
      `);
      console.log('数据表创建成功');
    } catch (error) {
      console.error('创建数据表失败:', error);
      throw error;
    }
  }

  async addDownloadedChapter(chapterData) {
    try {
      const { chapterId, comicId, comicTitle, chapterTitle, totalImages, downloadedAt } = chapterData;
      
      await this.db.runAsync(
        `INSERT OR REPLACE INTO downloaded_chapters 
         (chapterId, comicId, comicTitle, chapterTitle, totalImages, downloadedAt) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [chapterId, comicId, comicTitle, chapterTitle, totalImages, downloadedAt]
      );
      
      console.log(`章节${chapterId}已添加到数据库`);
    } catch (error) {
      console.error('添加下载章节失败:', error);
      throw error;
    }
  }

  async getAllDownloadedChapters() {
    try {
      const result = await this.db.getAllAsync(
        'SELECT chapterId FROM downloaded_chapters ORDER BY downloadedAt DESC'
      );
      console.log(`从数据库获取${result.length}个已下载章节`);
      return result.map(row => row.chapterId);
    } catch (error) {
      console.error('获取已下载章节失败:', error);
      return [];
    }
  }

  async getDownloadedChapterInfo(chapterId) {
    try {
      const result = await this.db.getFirstAsync(
        'SELECT * FROM downloaded_chapters WHERE chapterId = ?',
        [chapterId]
      );
      return result || null;
    } catch (error) {
      console.error('获取章节信息失败:', error);
      return null;
    }
  }

  async deleteDownloadedChapter(chapterId) {
    try {
      await this.db.runAsync(
        'DELETE FROM downloaded_chapters WHERE chapterId = ?',
        [chapterId]
      );
      console.log(`章节${chapterId}已从数据库删除`);
    } catch (error) {
      console.error('删除下载章节失败:', error);
      throw error;
    }
  }

  async isChapterDownloaded(chapterId) {
    try {
      const result = await this.db.getFirstAsync(
        'SELECT 1 FROM downloaded_chapters WHERE chapterId = ? LIMIT 1',
        [chapterId]
      );
      return !!result;
    } catch (error) {
      console.error('检查章节下载状态失败:', error);
      return false;
    }
  }

  async getDownloadedChaptersCount() {
    try {
      const result = await this.db.getFirstAsync(
        'SELECT COUNT(*) as count FROM downloaded_chapters'
      );
      return result?.count || 0;
    } catch (error) {
      console.error('获取下载章节数失败:', error);
      return 0;
    }
  }

  async clearAllDownloadedChapters() {
    try {
      await this.db.runAsync('DELETE FROM downloaded_chapters');
      console.log('已清空所有下载记录');
    } catch (error) {
      console.error('清空下载记录失败:', error);
      throw error;
    }
  }
}

const database = new Database();

export default database;
