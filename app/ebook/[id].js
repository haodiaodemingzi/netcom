import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import ChapterList from '../../components/ChapterList';
import { getEbookDetail, getEbookChapters } from '../../services/api';
import ebookDownloadManager from '../../services/ebookDownloadManager';

const EbookDetailScreen = () => {
  const router = useRouter();
  const { id, source = 'kanunu8' } = useLocalSearchParams();
  
  const [book, setBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [downloadState, setDownloadState] = useState(null); // 下载状态

  // 订阅下载管理器状态
  useEffect(() => {
    const unsubscribe = ebookDownloadManager.subscribe((state) => {
      // 只关注当前书籍的下载状态
      if (state.downloading?.id === id) {
        setDownloadState(state);
      } else if (state.status === 'paused') {
        // 暂停状态时检查是否是当前书籍
        const pendingInfo = ebookDownloadManager.getPendingDownloadInfo();
        if (pendingInfo?.bookId === id) {
          setDownloadState(state);
        } else {
          setDownloadState(null);
        }
      } else if (state.status === 'completed' || state.status === 'cancelled' || state.status === 'idle') {
        setDownloadState(null);
        checkDownloadStatus();
      }
    });
    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    loadBookDetail();
    checkDownloadStatus();
  }, [id]);

  const loadBookDetail = async () => {
    try {
      setLoading(true);
      const [bookData, chaptersData] = await Promise.all([
        getEbookDetail(id, source),
        getEbookChapters(id, source),
      ]);
      setBook(bookData);
      setChapters(chaptersData.chapters || []);
    } catch (error) {
      console.error('加载书籍详情失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkDownloadStatus = async () => {
    const downloaded = await ebookDownloadManager.isBookDownloaded(id);
    setIsDownloaded(downloaded);
  };

  const handleDownloadBook = async () => {
    if (!book) return;
    
    try {
      const result = await ebookDownloadManager.downloadBook(
        id,
        book.title,
        book.author,
        source,
        null, // 进度通过订阅获取
        false
      );
      
      if (result?.success) {
        setIsDownloaded(true);
        Alert.alert('下载完成', `《${book.title}》已保存到本地，可以离线阅读了！`);
      }
    } catch (error) {
      if (error.message !== '下载已取消') {
        Alert.alert('下载失败', error.message || '请稍后重试');
      }
    }
  };

  const handlePauseDownload = () => {
    ebookDownloadManager.pauseDownload();
  };

  const handleResumeDownload = async () => {
    try {
      const result = await ebookDownloadManager.resumeDownload();
      if (result?.success) {
        setIsDownloaded(true);
        Alert.alert('下载完成', `《${book.title}》已保存到本地，可以离线阅读了！`);
      }
    } catch (error) {
      if (error.message !== '下载已取消') {
        Alert.alert('下载失败', error.message || '请稍后重试');
      }
    }
  };

  const handleCancelDownload = () => {
    Alert.alert(
      '取消下载',
      '确定要取消下载吗？已下载的进度将丢失。',
      [
        { text: '继续下载', style: 'cancel' },
        {
          text: '取消',
          style: 'destructive',
          onPress: () => ebookDownloadManager.cancelDownload(),
        },
      ]
    );
  };

  const handleOfflineRead = async () => {
    if (!book) return;
    
    const downloaded = await ebookDownloadManager.isBookDownloaded(id);
    if (!downloaded) {
      Alert.alert('提示', '请先下载整本书籍');
      return;
    }
    
    // 跳转到离线阅读器
    router.push(`/ebook-offline-reader/${id}?bookTitle=${encodeURIComponent(book.title)}`);
  };

  const handleDeleteDownload = () => {
    Alert.alert(
      '删除下载',
      `确定要删除《${book.title}》的离线文件吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            await ebookDownloadManager.deleteBook(id);
            setIsDownloaded(false);
            Alert.alert('已删除', '离线文件已删除');
          },
        },
      ]
    );
  };

  const handleRead = (chapter) => {
    // 处理传递的可能是对象或字符串的情况
    const chapterId = typeof chapter === 'object' ? chapter.id : chapter;
    // 将书籍元数据一并传递，用于阅读记录
    const bookTitle = encodeURIComponent(book.title || '');
    const bookCover = encodeURIComponent(book.cover || '');
    router.push(`/ebook-reader/${chapterId}?bookId=${id}&source=${source}&bookTitle=${bookTitle}&bookCover=${bookCover}`);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200EE" />
      </View>
    );
  }

  if (!book) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>加载失败</Text>
      </View>
    );
  }

  const renderHeader = () => (
    <View>
      <View style={styles.topSection}>
        <View style={styles.coverPlaceholder}>
          <Text style={styles.coverText}>📖</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.title}>{book.title}</Text>
          {book.author && (
            <Text style={styles.author}>作者: {book.author}</Text>
          )}
          <View style={styles.tags}>
            <Text style={styles.statusText}>
              共 {book.totalChapters || chapters.length} 章
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => handleRead(chapters[0]?.id)}
          disabled={chapters.length === 0}
        >
          <Text style={styles.primaryButtonText}>
            {chapters.length > 0 ? '开始阅读' : '暂无章节'}
          </Text>
        </TouchableOpacity>
        
        {isDownloaded ? (
          <>
            <TouchableOpacity
              style={styles.offlineButton}
              onPress={handleOfflineRead}
            >
              <Text style={styles.offlineButtonText}>离线阅读</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDeleteDownload}
            >
              <Text style={styles.deleteButtonText}>删除</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.downloadButton}
            onPress={handleDownloadBook}
            disabled={chapters.length === 0 || downloadState?.status === 'downloading' || downloadState?.status === 'paused'}
          >
            <Text style={styles.downloadButtonText}>下载整本</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 页面内下载进度条 */}
      {(downloadState?.status === 'downloading' || downloadState?.status === 'paused') && (
        <View style={styles.downloadProgressContainer}>
          <View style={styles.downloadProgressHeader}>
            <Text style={styles.downloadProgressTitle}>
              {downloadState.status === 'paused' ? '下载已暂停' : '正在下载...'}
            </Text>
            <Text style={styles.downloadProgressPercent}>
              {Math.round(downloadState.progress * 100)}%
            </Text>
          </View>
          
          <View style={styles.progressBarContainer}>
            <View 
              style={[
                styles.progressBar, 
                { width: `${downloadState.progress * 100}%` },
                downloadState.status === 'paused' && styles.progressBarPaused
              ]} 
            />
          </View>
          
          <View style={styles.downloadProgressInfo}>
            <Text style={styles.downloadChapterInfo}>
              {downloadState.currentChapter} / {downloadState.totalChapters} 章
            </Text>
            {downloadState.chapterTitle && (
              <Text style={styles.downloadChapterTitle} numberOfLines={1}>
                {downloadState.chapterTitle}
              </Text>
            )}
          </View>
          
          <View style={styles.downloadActions}>
            {downloadState.status === 'downloading' ? (
              <TouchableOpacity
                style={styles.pauseButton}
                onPress={handlePauseDownload}
              >
                <Text style={styles.pauseButtonText}>暂停</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.resumeButton}
                onPress={handleResumeDownload}
              >
                <Text style={styles.resumeButtonText}>继续</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.cancelDownloadButton}
              onPress={handleCancelDownload}
            >
              <Text style={styles.cancelDownloadButtonText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {book.description && (
        <View style={styles.descSection}>
          <Text style={styles.sectionTitle}>简介</Text>
          <Text style={styles.description}>{book.description}</Text>
        </View>
      )}
      
      <View style={styles.separator} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{book.title}</Text>
      </View>

      <ChapterList
        chapters={chapters}
        onChapterPress={handleRead}
        comicId={id}
        comicTitle={book.title}
        source={source}
        ListHeaderComponent={renderHeader}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 16,
    color: '#999',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 20,
    color: '#333',
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  topSection: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
  },
  coverPlaceholder: {
    width: 120,
    height: 160,
    borderRadius: 8,
    marginRight: 16,
    backgroundColor: '#E8EAF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverText: {
    fontSize: 48,
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  author: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  tags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 13,
    color: '#999',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: '#fff',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#6200EE',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  descSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#444',
    lineHeight: 22,
  },
  separator: {
    height: 8,
    backgroundColor: '#f5f5f5',
  },
  downloadButton: {
    flex: 1,
    backgroundColor: '#03DAC6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  downloadButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  offlineButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  offlineButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#ff4444',
    fontSize: 14,
    fontWeight: '600',
  },
  // 下载进度条样式
  downloadProgressContainer: {
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  downloadProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  downloadProgressTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  downloadProgressPercent: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6200EE',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#6200EE',
    borderRadius: 4,
  },
  progressBarPaused: {
    backgroundColor: '#FFC107',
  },
  downloadProgressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  downloadChapterInfo: {
    fontSize: 13,
    color: '#666',
  },
  downloadChapterTitle: {
    flex: 1,
    fontSize: 12,
    color: '#999',
    marginLeft: 12,
    textAlign: 'right',
  },
  downloadActions: {
    flexDirection: 'row',
    gap: 12,
  },
  pauseButton: {
    flex: 1,
    backgroundColor: '#FFC107',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  pauseButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  resumeButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  resumeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelDownloadButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelDownloadButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default EbookDetailScreen;

