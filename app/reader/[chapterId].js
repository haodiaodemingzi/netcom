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
import * as FileSystem from 'expo-file-system/legacy';
import ImageViewer from '../../components/ImageViewer';
import { getChapterImages, getChapters } from '../../services/api';
import { getSettings, addHistory, getCurrentSource, getHistory } from '../../services/storage';
import downloadManager from '../../services/downloadManager';
import { API_BASE_URL } from '../../utils/constants';

const DOWNLOAD_DIR = `${FileSystem.documentDirectory}netcom/downloads/`;

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
  
  // 下载状态
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedCount, setDownloadedCount] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState(''); // 下载状态文字

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
        // 延迟一下确保FlatList渲染完成
        setTimeout(() => {
          try {
            flatListRef.current?.scrollToIndex({
              index,
              animated: false,
              viewPosition: 0.5,
            });
          } catch (error) {
            console.warn('scrollToIndex失败，使用scrollToOffset:', error);
            // 降级处理：使用scrollToOffset
            if (settings.scrollMode === 'horizontal') {
              flatListRef.current?.scrollToOffset({
                offset: SCREEN_WIDTH * index,
                animated: false,
              });
            }
          }
          setCurrentPage(restorePageNumber);
        }, 100);
      }
      
      isRestoringProgress.current = false;
      setShouldRestoreProgress(false);
      setRestorePageNumber(null);
    }
  }, [shouldRestoreProgress, images.length, restorePageNumber, settings.scrollMode]);

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
    console.log('========== 在线阅读开始 ==========');
    console.log('章节ID:', chapterId);
    console.log('漫画ID:', comicId);
    setLoading(true);
    try {
      const source = await getCurrentSource();
      console.log('数据源:', source);
      setCurrentSource(source);
      
      const settingsData = await getSettings();
      setSettings(settingsData);
      
      // 先检查本地是否已完整下载
      const isDownloaded = downloadManager.isDownloaded(chapterId);
      console.log(`章节${chapterId}本地下载状态:`, isDownloaded);
      
      if (isDownloaded) {
        console.log('✔ 已下载，加载本地图片');
        await loadLocalImages();
        return;
      }
      
      // 未下载，先下载整章到本地
      console.log('✗ 未下载，开始下载整章图片...');
      setLoading(false);
      setIsDownloading(true);
      setDownloadStatus('正在获取章节信息...');
      
      // 获取章节信息
      const chapterInfo = allChapters.find(c => c.id === chapterId);
      const chapterTitle = chapterInfo?.title || `章节 ${chapterId}`;
      console.log('章节标题:', chapterTitle);
      
      // 获取漫画信息
      const comicTitle = comicInfo?.comicTitle || '未知漫画';
      console.log('漫画标题:', comicTitle);
      
      // 调用下载管理器下载整章
      console.log('开始调用 downloadChapterAndWait...');
      const success = await downloadChapterAndWait(comicId, comicTitle, chapterTitle, chapterId, source);
      
      if (success) {
        // 下载完成，加载本地图片
        console.log('✔ 下载完成，加载本地图片');
        setIsDownloading(false);
        setLoading(true);
        await loadLocalImages();
      } else {
        console.log('✗ 下载失败');
        setIsDownloading(false);
        setDownloadStatus('下载失败');
        Alert.alert('下载失败', '无法下载章节图片，请检查网络后重试');
      }
      
    } catch (error) {
      console.error('加载章节失败:', error);
      setIsDownloading(false);
      Alert.alert('加载失败', error.message || '请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 加载本地图片
  const loadLocalImages = async () => {
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
          setRestorePageNumber(comicHistory.lastPage);
          setShouldRestoreProgress(true);
        }
        
        setLoading(false);
        return;
      }
    }
    
    console.log('⚠ 本地图片加载失败');
    setLoading(false);
  };

  // 下载整章并等待完成
  const downloadChapterAndWait = async (comicId, comicTitle, chapterTitle, chapterId, source) => {
    console.log('---------- downloadChapterAndWait 开始 ----------');
    console.log('参数: comicId=', comicId, ', chapterId=', chapterId, ', source=', source);
    return new Promise(async (resolve) => {
      try {
        setDownloadStatus('正在获取章节信息...');
        
        // 获取章节下载信息
        const apiUrl = `${API_BASE_URL}/chapters/${chapterId}/download-info?source=${source}`;
        console.log('[1] 请求下载信息API:', apiUrl);
        
        // 设置超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.log('[1] API请求超时!');
          controller.abort();
        }, 15000); // 15秒超时
        
        console.log('[1] 开始 fetch...');
        const response = await fetch(apiUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        console.log('[1] fetch 完成, status:', response.status);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('[1] API响应:', data.success ? '成功' : '失败');
        if (!data.success) {
          throw new Error(data.message || '获取章节信息失败');
        }
        
        const { images: imageList, download_config } = data.data;
        const total = imageList.length;
        console.log('[1] 获取到图片数:', total);
        console.log('[1] 下载配置:', JSON.stringify(download_config));
        
        setTotalImages(total);
        setDownloadedCount(0);
        setDownloadProgress(0);
        setDownloadStatus(`正在下载 0/${total} 张图片...`);
        
        // 先获取 Cookie
        if (download_config?.cookie_url) {
          console.log('[2] 开始获取Cookie, cookie_url:', download_config.cookie_url);
          try {
            setDownloadStatus('正在获取认证信息...');
            const cookieResponse = await downloadManager.apiClient.get('/get-cookies', {
              params: { 
                source: source,
                cookie_url: download_config.cookie_url
              }
            });
            console.log('[2] Cookie获取结果:', cookieResponse.data?.success ? '成功' : '失败');
            
            // 缓存 Cookie 到 downloadManager
            if (cookieResponse.data?.success && cookieResponse.data?.cookies) {
              const cookies = cookieResponse.data.cookies;
              console.log('[2] Cookies:', cookies.substring(0, 50) + '...');
              downloadManager.cachedCookies.set(source, cookies);
              downloadManager.cookiesExpireTime.set(source, Date.now() + 5 * 60 * 1000);
              console.log('[2] Cookie已缓存到 downloadManager');
            }
          } catch (error) {
            console.warn('[2] 获取Cookie失败:', error.message);
          }
        } else {
          console.log('[2] 无cookie_url，跳过Cookie获取');
        }
        
        setDownloadStatus(`正在下载 0/${total} 张图片...`);
        
        // 并发下载所有图片
        const maxConcurrent = 15; // 并发数
        console.log('[3] 开始并发下载图片, 并发数:', maxConcurrent);
        console.log('[3] 第一张图片URL:', imageList[0]?.url);
        let completed = 0;
        let failed = 0;
        
        // 确保目录存在
        const chapterDir = `${DOWNLOAD_DIR}${comicId}/${chapterId}/`;
        await FileSystem.makeDirectoryAsync(chapterDir, { intermediates: true }).catch(() => {});
        
        // 直接下载图片（不再调用API获取URL）
        const downloadImageDirect = async (imageInfo, index) => {
          const page = imageInfo.page || (index + 1);
          const imageUrl = imageInfo.url;
          const filename = `${String(page).padStart(3, '0')}.jpg`;
          const filepath = `${chapterDir}${filename}`;
          
          // 检查是否已下载
          const fileInfo = await FileSystem.getInfoAsync(filepath);
          if (fileInfo.exists && fileInfo.size > 0) {
            return true; // 已存在，跳过
          }
          
          // 获取 Cookie
          const cookies = downloadManager.cachedCookies.get(source) || '';
          
          const downloadHeaders = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
            'Referer': download_config?.referer || 'https://xmanhua.com/',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9'
          };
          if (cookies) {
            downloadHeaders['Cookie'] = cookies;
          }
          
          await FileSystem.downloadAsync(imageUrl, filepath, { headers: downloadHeaders });
          return true;
        };
        
        // 并发下载控制器 - 使用信号量模式
        const downloadAllWithConcurrency = async () => {
          const queue = [...imageList.map((item, index) => ({ item, index }))];
          const workers = [];
          
          const worker = async () => {
            while (queue.length > 0) {
              const task = queue.shift();
              if (!task) break;
              
              const { item: imageInfo, index } = task;
              try {
                await downloadImageDirect(imageInfo, index);
                completed++;
              } catch (error) {
                console.error(`下载第${index + 1}张失败:`, error.message);
                failed++;
              }
              
              const progress = (completed + failed) / total;
              setDownloadProgress(progress);
              setDownloadedCount(completed);
            }
          };
          
          // 启动 maxConcurrent 个 worker 并行执行
          for (let i = 0; i < maxConcurrent; i++) {
            workers.push(worker());
          }
          
          await Promise.all(workers);
        };
        
        await downloadAllWithConcurrency();
        
        console.log('[4] 下载完成: 成功=', completed, ', 失败=', failed);
        
        // 如果大部分图片下载成功，标记为已下载
        if (completed > 0 && failed < total * 0.5) {
          // 保存章节下载记录
          const chapterData = {
            comicId: comicId,
            comicTitle: comicTitle,
            chapterId: chapterId,
            chapterTitle: chapterTitle,
            totalImages: total,
            downloadedAt: new Date().toISOString()
          };
          
          // 保存 meta.json 文件到章节目录
          const chapterDir = `${DOWNLOAD_DIR}${comicId}/${chapterId}/`;
          const metaPath = `${chapterDir}meta.json`;
          try {
            await FileSystem.writeAsStringAsync(
              metaPath,
              JSON.stringify(chapterData, null, 2)
            );
            console.log('[4] meta.json已保存:', metaPath);
          } catch (error) {
            console.error('[4] 保存meta.json失败:', error.message);
          }
          
          downloadManager.downloadedChapters.set(chapterId, chapterData);
          await downloadManager.saveDownloadedChapters();
          
          setDownloadStatus('下载完成!');
          resolve(true);
        } else {
          setDownloadStatus('下载失败');
          resolve(false);
        }
        
      } catch (error) {
        console.error('下载章节失败:', error);
        setDownloadStatus(`下载失败: ${error.message}`);
        resolve(false);
      }
    });
  };

  const handleScrollToIndexFailed = useCallback((info) => {
    console.warn('scrollToIndexFailed:', info);
    // 降级处理：先滚动到数据范围内，然后重试
    const wait = new Promise(resolve => setTimeout(resolve, 100));
    wait.then(() => {
      if (info.index < images.length) {
        flatListRef.current?.scrollToIndex({
          index: info.index,
          animated: false,
          viewPosition: 0.5,
        });
      }
    });
  }, [images.length]);

  const handlePageChange = useCallback((page) => {
    console.log(`handlePageChange: page=${page}, images.length=${images.length}`);
    const index = page - 1;
    if (index >= 0 && index < images.length) {
      console.log(`滚动到第${page}页 (index=${index})`);
      try {
        flatListRef.current?.scrollToIndex({
          index,
          animated: false,
          viewPosition: 0.5,
        });
      } catch (error) {
        console.warn('scrollToIndex失败:', error);
      }
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
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  // 下载进度界面
  if (isDownloading) {
    return (
      <View style={styles.downloadContainer}>
        <StatusBar hidden />
        
        {/* 中间显示加载中 */}
        <View style={styles.downloadContent}>
          <ActivityIndicator size="large" color="#6200EE" />
          <Text style={styles.downloadStatusText}>正在加载...</Text>
        </View>
        
        {/* 底部进度条 */}
        {totalImages > 0 && (
          <View style={styles.bottomProgressContainer}>
            <View style={styles.bottomProgressInfo}>
              <Text style={styles.bottomProgressText}>
                {downloadedCount}/{totalImages} ({Math.round(downloadProgress * 100)}%)
              </Text>
            </View>
            <View style={styles.bottomProgressBar}>
              <View 
                style={[
                  styles.bottomProgressFill, 
                  { width: `${downloadProgress * 100}%` }
                ]} 
              />
            </View>
          </View>
        )}
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
        onScrollToIndexFailed={handleScrollToIndexFailed}
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
  // 下载进度相关样式
  downloadContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  downloadContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadStatusText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 20,
    textAlign: 'center',
  },
  bottomProgressContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 20,
  },
  bottomProgressInfo: {
    marginBottom: 8,
  },
  bottomProgressText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  bottomProgressBar: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  bottomProgressFill: {
    height: '100%',
    backgroundColor: '#6200EE',
    borderRadius: 3,
  },
  cancelButton: {
    marginTop: 30,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fff',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default ReaderScreen;
