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
import { getSettings, addHistory, getCurrentSource } from '../../services/storage';
import downloadManager from '../../services/downloadManager';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ReaderScreen = () => {
  const router = useRouter();
  const { chapterId, comicId } = useLocalSearchParams();
  const flatListRef = useRef(null);
  const hasShownNextChapterPrompt = useRef(false);
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const [images, setImages] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    readingMode: 'single',
    imageFitMode: 'width',
    backgroundColor: 'black',
  });
  const [currentSource, setCurrentSource] = useState('guoman8');
  const [allChapters, setAllChapters] = useState([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(-1);

  useEffect(() => {
    loadChapterList();
  }, [comicId]);

  // 处理Android返回键
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      router.back();
      return true; // 阻止默认行为
    });

    return () => backHandler.remove();
  }, [router]);

  useEffect(() => {
    if (allChapters.length > 0) {
      loadData();
      hasShownNextChapterPrompt.current = false;
    }
  }, [chapterId, allChapters]);

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
      
      // 检查章节是否已下载
      const isDownloaded = downloadManager.isDownloaded(chapterId);
      
      if (!isDownloaded) {
        // 未下载的章节不允许阅读
        setLoading(false);
        Alert.alert(
          '提示',
          '该章节未下载，无法阅读',
          [
            {
              text: '确定',
              onPress: () => router.back()
            }
          ]
        );
        return;
      }
      
      // 加载本地已下载的章节
      const downloadedInfo = Array.from(downloadManager.downloadedChapters.values())
        .find(info => info.chapterId === chapterId);
      
      if (downloadedInfo) {
        const localImages = await downloadManager.getLocalChapterImages(
          downloadedInfo.comicId,
          chapterId
        );
        
        if (localImages && localImages.length > 0) {
          setImages(localImages);
        } else {
          Alert.alert(
            '错误',
            '章节文件损坏，请重新下载',
            [
              {
                text: '确定',
                onPress: () => router.back()
              }
            ]
          );
        }
      }
    } catch (error) {
      Alert.alert(
        '错误',
        '加载章节失败: ' + error.message,
        [
          {
            text: '确定',
            onPress: () => router.back()
          }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page) => {
    const index = page - 1;
    if (index >= 0 && index < images.length) {
      flatListRef.current?.scrollToIndex({
        index,
        animated: true,
      });
      setCurrentPage(page);
    }
  };

  const handleViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const page = viewableItems[0].index + 1;
      setCurrentPage(page);
      
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
        
        if (nextChapter && downloadManager.isDownloaded(nextChapter.id)) {
          hasShownNextChapterPrompt.current = true;
          // 显示提示，询问是否跳转下一章
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
  }, [images.length, currentChapterIndex, allChapters, comicId, router]);


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
        if (downloadManager.isDownloaded(prevChapter.id)) {
          router.replace(`/reader/${prevChapter.id}?comicId=${comicId}`);
          setCurrentPage(1);
        } else {
          Alert.alert('提示', '上一章未下载，无法阅读');
        }
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
        if (downloadManager.isDownloaded(nextChapter.id)) {
          router.replace(`/reader/${nextChapter.id}?comicId=${comicId}`);
          setCurrentPage(1);
        } else {
          Alert.alert('提示', '下一章未下载，无法阅读');
        }
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
    return (
      <View style={styles.imageContainer}>
        <ImageViewer
          imageUrl={item.url}
          fitMode={settings.imageFitMode}
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
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(data, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />
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
  imageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ReaderScreen;
