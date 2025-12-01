import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Text,
  Alert,
  BackHandler,
  Pressable,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import ImageViewer from '../../components/ImageViewer';
import { getChapterImages, getChapters } from '../../services/api';
import { getSettings, addHistory, getCurrentSource, getHistory } from '../../services/storage';
import downloadManager from '../../services/downloadManager';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ReaderScreen = () => {
  const router = useRouter();
  const { chapterId, comicId } = useLocalSearchParams();
  const flatListRef = useRef(null);
  const hasShownNextChapterPrompt = useRef(false);
  const isRestoringProgress = useRef(false);
  const lastSavedPage = useRef(1);
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const [images, setImages] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [shouldRestoreProgress, setShouldRestoreProgress] = useState(false);
  const [restorePageNumber, setRestorePageNumber] = useState(null);
  const [settings, setSettings] = useState({
    readingMode: 'single',
    imageFitMode: 'width',
    backgroundColor: 'black',
  });
  const [currentSource, setCurrentSource] = useState(null);
  const [allChapters, setAllChapters] = useState([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(-1);
  const [comicInfo, setComicInfo] = useState(null);

  useEffect(() => {
    loadChapterList();
  }, [comicId]);

  // 处理Android返回键和页面卸载时保存阅读进度
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', async () => {
      // 保存阅读进度
      if (comicInfo && comicInfo.comicId && currentPage !== lastSavedPage.current) {
        console.log(`返回时保存阅读进度: 漫画=${comicInfo.comicId}, 章节=${chapterId}, 页码=${currentPage}`);
        await addHistory(
          {
            id: comicInfo.comicId,
            title: comicInfo.comicTitle,
            cover: comicInfo.cover || '',
          },
          chapterId,
          currentPage
        );
        lastSavedPage.current = currentPage;
        console.log(`阅读进度已保存`);
      }
      router.back();
      return true; // 阻止默认行为
    });

    return () => backHandler.remove();
  }, [router, comicInfo, chapterId, currentPage]);

  useEffect(() => {
    if (allChapters.length > 0) {
      loadData();
      hasShownNextChapterPrompt.current = false;
    }
  }, [chapterId, allChapters]);

  // 监听图片加载完成，恢复阅读进度
  useEffect(() => {
    if (shouldRestoreProgress && images.length > 0 && restorePageNumber) {
      console.log(`图片加载完成，恢复进度到第${restorePageNumber}页，总图片数=${images.length}`);
      isRestoringProgress.current = true;
      
      const index = restorePageNumber - 1;
      if (index >= 0 && index < images.length) {
        console.log(`滚动到第${restorePageNumber}页 (index=${index})`);
        flatListRef.current?.scrollToIndex({
          index,
          animated: false,
          viewPosition: 0.5,
        });
        setCurrentPage(restorePageNumber);
      }
      
      isRestoringProgress.current = false;
      setShouldRestoreProgress(false);
      setRestorePageNumber(null);
    }
  }, [shouldRestoreProgress, images.length, restorePageNumber]);

  const loadChapterList = async () => {
    if (!comicId) {
      return;
    }

    try {
      const source = await getCurrentSource();
      const chaptersData = await getChapters(comicId, source);
      const chapters = chaptersData.chapters || [];
      setAllChapters(chapters);
      
      const index = chapters.findIndex(c => c.id === chapterId);
      setCurrentChapterIndex(index);
    } catch (error) {
      // 静默失败
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const source = await getCurrentSource();
      setCurrentSource(source);
      
      const settingsData = await getSettings();
      setSettings(settingsData);
      
      // 先检查本地是否已完整下载
      const isDownloaded = downloadManager.isDownloaded(chapterId);
      console.log(`章节${chapterId}下载状态:`, isDownloaded);
      
      if (isDownloaded) {
        // 已下载完整章节，直接加载本地图片
        const downloadedInfo = Array.from(downloadManager.downloadedChapters.values())
          .find(info => info.chapterId === chapterId);
        
        console.log('已下载章节信息:', downloadedInfo);
        
        if (downloadedInfo) {
          // 确保 comicInfo 有完整的字段
          const comicInfoData = {
            comicId: downloadedInfo.comicId,
            comicTitle: downloadedInfo.comicTitle,
            cover: downloadedInfo.cover || '',
            chapterId: downloadedInfo.chapterId,
            chapterTitle: downloadedInfo.chapterTitle,
            totalImages: downloadedInfo.totalImages,
          };
          setComicInfo(comicInfoData);
          
          const localImages = await downloadManager.getLocalChapterImages(
            downloadedInfo.comicId,
            chapterId
          );
          
          console.log('获取到的本地图片数:', localImages?.length);
          
          if (localImages && localImages.length > 0) {
            console.log('✓ 使用本地图片');
            setImages(localImages);
            
            // 恢复阅读进度（强制刷新缓存）
            const history = await getHistory(true);
            const comicHistory = history.find(h => h.id === downloadedInfo.comicId);
            if (comicHistory && comicHistory.lastChapterId === chapterId && comicHistory.lastPage) {
              console.log(`恢复阅读进度: 页码=${comicHistory.lastPage}`);
              // 设置标志，等待图片加载完成后再恢复进度
              setRestorePageNumber(comicHistory.lastPage);
              setShouldRestoreProgress(true);
            }
            
            setLoading(false);
            return;
          } else {
            console.log('⚠ 本地图片加载失败，切换到在线模式');
          }
        }
      }
      
      // 未下载或本地损坏，在线预览模式
      // 获取章节总页数
      const chapterInfo = await getChapterImages(chapterId, source);
      const totalPages = chapterInfo.total || 0;
      
      if (totalPages === 0) {
        console.error('无法获取章节信息');
        setLoading(false);
        return;
      }
      
      // 初始化图片占位符数组
      const placeholders = Array.from({ length: totalPages }, (_, i) => ({
        page: i + 1,
        url: null,
        isLoading: false,
        isLocal: false
      }));
      setImages(placeholders);
      
      setComicInfo({
        comicId,
        comicTitle: chapterInfo.title || '在线预览',
        totalPages
      });
      
      // 恢复阅读进度（在线模式，强制刷新缓存）
      const history = await getHistory(true);
      const comicHistory = history.find(h => h.id === comicId);
      if (comicHistory && comicHistory.lastChapterId === chapterId && comicHistory.lastPage) {
        console.log(`恢复阅读进度: 页码=${comicHistory.lastPage}`);
        // 设置标志，等待图片加载完成后再恢复进度
        setRestorePageNumber(comicHistory.lastPage);
        setShouldRestoreProgress(true);
      }
      
    } catch (error) {
      console.error('加载章节失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = useCallback((page) => {
    console.log(`handlePageChange: page=${page}, images.length=${images.length}`);
    const index = page - 1;
    if (index >= 0 && index < images.length) {
      console.log(`滚动到第${page}页 (index=${index})`);
      flatListRef.current?.scrollToIndex({
        index,
        animated: false,
        viewPosition: 0.5,
      });
      setCurrentPage(page);
      
      // 立即加载当前页和周围的页面
      loadImageForPage(index);
      if (index + 1 < images.length) {
        loadImageForPage(index + 1);
      }
      if (index + 2 < images.length) {
        loadImageForPage(index + 2);
      }
      if (index - 1 >= 0) {
        loadImageForPage(index - 1);
      }
      if (index - 2 >= 0) {
        loadImageForPage(index - 2);
      }
    } else {
      console.log(`handlePageChange 失败: page=${page}, images.length=${images.length}`);
    }
  }, [images]);

  const loadImageForPage = async (pageIndex) => {
    if (!comicInfo) return;
    const page = pageIndex + 1;
    
    if (images[pageIndex]?.url) return;
    
    setImages(prev => {
      const updated = [...prev];
      updated[pageIndex] = { ...updated[pageIndex], isLoading: true };
      return updated;
    });
    
    try {
      const imageData = await downloadManager.getOrDownloadImage(
        comicInfo.comicId || comicId,
        chapterId,
        page,
        currentSource
      );
      
      setImages(prev => {
        const updated = [...prev];
        updated[pageIndex] = {
          page,
          url: imageData.url,
          isLocal: true,
          isLoading: false
        };
        return updated;
      });
    } catch (error) {
      console.error(`加载第${page}页失败:`, error);
      setImages(prev => {
        const updated = [...prev];
        updated[pageIndex] = { ...updated[pageIndex], isLoading: false };
        return updated;
      });
    }
  };

  const handleViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const currentIndex = viewableItems[0].index;
      const page = currentIndex + 1;
      setCurrentPage(page);
      
      // 加载当前页
      loadImageForPage(currentIndex);
      
      // 预加载后2页
      if (currentIndex + 1 < images.length) {
        loadImageForPage(currentIndex + 1);
      }
      if (currentIndex + 2 < images.length) {
        loadImageForPage(currentIndex + 2);
      }
      
      // 预加载前2页
      if (currentIndex - 1 >= 0) {
        loadImageForPage(currentIndex - 1);
      }
      if (currentIndex - 2 >= 0) {
        loadImageForPage(currentIndex - 2);
      }
      
      // 如果是最后一页且存在下一章且还没显示过提示
      if (page === images.length && 
          currentChapterIndex >= 0 && 
          currentChapterIndex < allChapters.length && 
          !hasShownNextChapterPrompt.current) {
        const currentChapter = allChapters[currentChapterIndex];
        const currentNumber = extractChapterNumber(currentChapter.title);
        
        // 找到章节编号比当前大的章节
        const nextChapter = allChapters.find(chapter => {
          const chapterNumber = extractChapterNumber(chapter.title);
          return chapterNumber === currentNumber + 1;
        });
        
        if (nextChapter) {
          hasShownNextChapterPrompt.current = true;
          setTimeout(() => {
            Alert.alert(
              '章节已读完',
              `是否继续阅读下一章：${nextChapter.title}？`,
              [
                { text: '取消', style: 'cancel' },
                { 
                  text: '继续阅读',
                  onPress: () => {
                    router.replace(`/reader/${nextChapter.id}?comicId=${comicId}`);
                    setCurrentPage(1);
                  }
                }
              ]
            );
          }, 500);
        }
      }
    }
  }, [images.length, currentChapterIndex, allChapters, comicId, router, chapterId]);


  // 提取章节编号
  const extractChapterNumber = (title) => {
    const match = title.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  const handlePrevChapter = () => {
    if (currentChapterIndex >= 0 && currentChapterIndex < allChapters.length) {
      const currentChapter = allChapters[currentChapterIndex];
      const currentNumber = extractChapterNumber(currentChapter.title);
      
      // 找到章节编号比当前小的章节
      const prevChapter = allChapters.find(chapter => {
        const chapterNumber = extractChapterNumber(chapter.title);
        return chapterNumber === currentNumber - 1;
      });
      
      if (prevChapter) {
        router.replace(`/reader/${prevChapter.id}?comicId=${comicId}`);
        setCurrentPage(1);
      }
    }
  };

  const handleNextChapter = () => {
    if (currentChapterIndex >= 0 && currentChapterIndex < allChapters.length) {
      const currentChapter = allChapters[currentChapterIndex];
      const currentNumber = extractChapterNumber(currentChapter.title);
      
      // 找到章节编号比当前大的章节
      const nextChapter = allChapters.find(chapter => {
        const chapterNumber = extractChapterNumber(chapter.title);
        return chapterNumber === currentNumber + 1;
      });
      
      if (nextChapter) {
        router.replace(`/reader/${nextChapter.id}?comicId=${comicId}`);
        setCurrentPage(1);
      }
    }
  };

  const getCurrentChapterTitle = () => {
    if (currentChapterIndex >= 0 && currentChapterIndex < allChapters.length) {
      return allChapters[currentChapterIndex].title;
    }
    return `第 ${chapterId} 章`;
  };

  const renderItem = ({ item, index }) => {
    const isHorizontal = settings.scrollMode === 'horizontal';
    const containerStyle = isHorizontal 
      ? styles.imageContainer 
      : styles.imageContainerVertical;
    
    if (!item.url) {
      return (
        <View style={containerStyle}>
          <View style={isHorizontal ? styles.loadingWrapper : styles.loadingWrapperVertical}>
            {item.isLoading ? (
              <>
                <ActivityIndicator size="large" color="#6200EE" />
                <Text style={styles.loadingText}>加载中...</Text>
              </>
            ) : (
              <Text style={styles.loadingText}>滑动到此页自动加载</Text>
            )}
          </View>
        </View>
      );
    }
    
    return (
      <View style={containerStyle}>
        <ImageViewer
          imageUrl={item.url}
          fitMode={isHorizontal ? settings.imageFitMode : 'width'}
        />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200EE" />
      </View>
    );
  }

  const isHorizontal = settings.scrollMode === 'horizontal';

  return (
    <View 
      style={[
        styles.container,
        { backgroundColor: settings.backgroundColor },
      ]}
    >
      <StatusBar hidden />
      
      <FlatList
        ref={flatListRef}
        data={images}
        renderItem={renderItem}
        keyExtractor={(item, index) => index.toString()}
        horizontal={isHorizontal}
        pagingEnabled={isHorizontal}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={isHorizontal ? (data, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        }) : undefined}
      />
      
      {/* 进度显示 */}
      <View style={styles.progressBar}>
        <View style={styles.progressInfo}>
          <Text style={styles.progressText}>
            {getCurrentChapterTitle()} · 第 {currentPage} / {images.length} 页
          </Text>
        </View>
        <View 
          style={[
            styles.progressFill,
            { width: `${(currentPage / images.length) * 100}%` }
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  imageContainerVertical: {
    width: SCREEN_WIDTH,
  },
  imageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingWrapperVertical: {
    width: SCREEN_WIDTH,
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
  },
  progressBar: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  progressInfo: {
    marginBottom: 6,
  },
  progressText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  progressFill: {
    height: 3,
    backgroundColor: '#6200EE',
    borderRadius: 1.5,
  },
});

export default ReaderScreen;
