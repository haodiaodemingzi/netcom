import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  StatusBar,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getChapterContent, saveReadingProgress } from '../../services/novelApi';
import { addNovelHistory } from '../../services/storage';
import FullScreenLoader from '../../components/FullScreenLoader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const NovelReaderScreen = () => {
  const router = useRouter();
  const { chapterId, novelId, novelTitle, cover } = useLocalSearchParams();
  const scrollViewRef = useRef(null);
  const lastSavedBucketRef = useRef(-1);
  const lastOffsetRef = useRef(0);

  const decodeParam = (value) => {
    if (typeof value !== 'string') return '';
    try {
      return decodeURIComponent(value);
    } catch (e) {
      return value;
    }
  };

  const resolvedNovelTitle = decodeParam(novelTitle);
  const resolvedCover = decodeParam(cover);

  const [chapter, setChapter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fontSize, setFontSize] = useState(16);
  const [lineHeight, setLineHeight] = useState(1.8);
  const [backgroundColor, setBackgroundColor] = useState('#fff');
  const [textColor, setTextColor] = useState('#000');
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef(null);

  useEffect(() => {
    loadChapter();
  }, [chapterId]);

  const loadChapter = async () => {
    setLoading(true);
    try {
      // 1. 先获取配置并访问 cookie_url
      try {
        const source = 'kanunu8'; // 或者从 storage 获取
        const configResponse = await fetch(
          `${process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:5000/api'}/ebooks/chapters/${chapterId}/config?source=${source}`
        );
        
        if (configResponse.ok) {
          const configData = await configResponse.json();
          if (configData.success && configData.data?.cookie_url) {
            console.log('访问入口页面获取Cookie:', configData.data.cookie_url);
            await fetch(configData.data.cookie_url, {
              method: 'GET',
              credentials: 'include',
              headers: configData.data.headers || {},
            });
            console.log('✓ Cookie 预加载完成');
          }
        }
      } catch (error) {
        console.warn('获取Cookie失败（继续加载）:', error);
      }
      
      // 2. 加载章节内容
      const result = await getChapterContent(chapterId);
      if (result.success) {
        setChapter(result.data);
      } else {
        Alert.alert('错误', '加载章节失败');
      }
    } catch (error) {
      console.error('加载章节失败:', error);
      Alert.alert('错误', '加载章节失败');
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const contentHeight = event.nativeEvent.contentSize.height;
    const scrollViewHeight = event.nativeEvent.layoutMeasurement.height;

    const safeOffsetY = Number.isFinite(offsetY) ? offsetY : 0;
    lastOffsetRef.current = safeOffsetY;

    if (!chapter || !chapter.novelId || !chapterId) {
      return;
    }

    const denominator = contentHeight - scrollViewHeight;
    if (!Number.isFinite(denominator) || denominator <= 0) {
      return;
    }

    // 计算阅读位置（字符位置）
    const scrollPercentage = safeOffsetY / denominator;
    const safePercentage = Math.min(Math.max(scrollPercentage, 0), 1);
    const contentLength = typeof chapter.content === 'string' ? chapter.content.length : 0;
    const position = Math.floor(contentLength * safePercentage);

    const bucket = Math.floor(safePercentage * 10);
    if (bucket === lastSavedBucketRef.current) {
      return;
    }
    lastSavedBucketRef.current = bucket;

    saveReadingProgress(chapter.novelId, chapterId, position);
    addNovelHistory(
      {
        id: novelId || chapter.novelId,
        title: resolvedNovelTitle || chapter.novelTitle || chapter.title,
        cover: resolvedCover || chapter.cover || '',
      },
      chapterId,
      safeOffsetY
    );
  };

  const handleBackPress = () => {
    if (!chapterId) {
      router.back();
      return;
    }

    const resolvedNovelId = novelId || chapter?.novelId;
    if (!resolvedNovelId) {
      router.back();
      return;
    }

    addNovelHistory(
      {
        id: resolvedNovelId,
        title: resolvedNovelTitle || chapter?.novelTitle || chapter?.title,
        cover: resolvedCover || chapter?.cover || '',
      },
      chapterId,
      lastOffsetRef.current
    );

    router.back();
  };

  const handleControlsPress = () => {
    setShowControls(!showControls);

    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }

    if (!showControls) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  const changeFontSize = (delta) => {
    const newSize = Math.max(12, Math.min(24, fontSize + delta));
    setFontSize(newSize);
  };

  const changeLineHeight = (delta) => {
    const newHeight = Math.max(1.2, Math.min(2.4, lineHeight + delta));
    setLineHeight(parseFloat(newHeight.toFixed(1)));
  };

  const setTheme = (theme) => {
    switch (theme) {
      case 'light':
        setBackgroundColor('#fff');
        setTextColor('#000');
        break;
      case 'dark':
        setBackgroundColor('#1a1a1a');
        setTextColor('#e0e0e0');
        break;
      case 'sepia':
        setBackgroundColor('#f5f1de');
        setTextColor('#3e3e3e');
        break;
      default:
        break;
    }
  };

  if (loading) {
    return <FullScreenLoader variant="reader" />;
  }

  if (!chapter) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>章节不存在</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={[]}>
      <StatusBar barStyle={backgroundColor === '#1a1a1a' ? 'light-content' : 'dark-content'} />

      <TouchableOpacity
        style={styles.readerContainer}
        onPress={handleControlsPress}
        activeOpacity={1}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <Text style={[styles.title, { color: textColor }]}>
              {chapter.title}
            </Text>
            <Text
              style={[
                styles.text,
                {
                  color: textColor,
                  fontSize,
                  lineHeight: fontSize * lineHeight,
                }
              ]}
            >
              {chapter.content}
            </Text>
          </View>
        </ScrollView>

        {showControls && (
          <View style={styles.controls}>
            <View style={styles.topBar}>
              <TouchableOpacity onPress={handleBackPress}>
                <Text style={[styles.backButton, { color: textColor }]}>← 返回</Text>
              </TouchableOpacity>
              <Text style={[styles.chapterTitle, { color: textColor }]}>
                {chapter.title}
              </Text>
              <View style={{ width: 40 }} />
            </View>

            <View style={styles.bottomBar}>
              <View style={styles.controlGroup}>
                <Text style={[styles.label, { color: textColor }]}>字体</Text>
                <View style={styles.buttonGroup}>
                  <TouchableOpacity
                    style={[styles.button, { borderColor: textColor }]}
                    onPress={() => changeFontSize(-2)}
                  >
                    <Text style={[styles.buttonText, { color: textColor }]}>A-</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.button, { borderColor: textColor }]}
                    onPress={() => changeFontSize(2)}
                  >
                    <Text style={[styles.buttonText, { color: textColor }]}>A+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.controlGroup}>
                <Text style={[styles.label, { color: textColor }]}>行距</Text>
                <View style={styles.buttonGroup}>
                  <TouchableOpacity
                    style={[styles.button, { borderColor: textColor }]}
                    onPress={() => changeLineHeight(-0.2)}
                  >
                    <Text style={[styles.buttonText, { color: textColor }]}>-</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.button, { borderColor: textColor }]}
                    onPress={() => changeLineHeight(0.2)}
                  >
                    <Text style={[styles.buttonText, { color: textColor }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.controlGroup}>
                <Text style={[styles.label, { color: textColor }]}>主题</Text>
                <View style={styles.buttonGroup}>
                  <TouchableOpacity
                    style={[styles.themeButton, { borderColor: textColor }]}
                    onPress={() => setTheme('light')}
                  >
                    <Text style={[styles.buttonText, { color: textColor }]}>亮</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.themeButton, { borderColor: textColor }]}
                    onPress={() => setTheme('sepia')}
                  >
                    <Text style={[styles.buttonText, { color: textColor }]}>护眼</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.themeButton, { borderColor: textColor }]}
                    onPress={() => setTheme('dark')}
                  >
                    <Text style={[styles.buttonText, { color: textColor }]}>暗</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </SafeAreaView>
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
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#999',
  },
  readerContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    minHeight: '100%',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  text: {
    textAlign: 'justify',
  },
  controls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    fontSize: 14,
    fontWeight: '600',
  },
  chapterTitle: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.2)',
  },
  controlGroup: {
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    width: 40,
    height: 32,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeButton: {
    width: 50,
    height: 32,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default NovelReaderScreen;
