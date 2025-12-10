import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getChapterContent, getEbookChapters } from '../../services/api';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { addHistory } from '../../services/storage';

const EbookReaderScreen = () => {
  const router = useRouter();
  const { chapterId, source = 'kanunu8', bookTitle = '', bookCover = '' } = useLocalSearchParams();
  const { bookId } = useLocalSearchParams();
  
  // 默认设置
  const defaultSettings = {
    fontSize: 17,
    lineHeight: 1.6,
    theme: 'light',
    pageAnimation: 'fade',
    fontFamily: 'system',
    fontBold: false,
  };

  const [fontSize, setFontSize] = useState(defaultSettings.fontSize);
  const [lineHeight, setLineHeight] = useState(defaultSettings.lineHeight);
  const [theme, setTheme] = useState(defaultSettings.theme);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [chapterTitle, setChapterTitle] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [pageAnimation, setPageAnimation] = useState(defaultSettings.pageAnimation);
  const [fontFamily, setFontFamily] = useState(defaultSettings.fontFamily);
  const [fontBold, setFontBold] = useState(defaultSettings.fontBold);
  
  // 分页相关状态
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [pages, setPages] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const gestureRef = useRef(null);
  const lastSavedRef = useRef({ chapterId: null, page: -1 });
  
  // 翻页动画相关 - 只使用淡入淡出
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    loadSavedSettings();
    loadInitialData();
  }, [chapterId]);

  // 离开页面时保存阅读进度
  useEffect(() => {
    return () => {
      saveReadingProgress();
    };
  }, [chapterId, currentPage, chapterTitle]);

  useEffect(() => {
    if (content) {
      paginateContent();
    }
  }, [content, fontSize, lineHeight, screenWidth, fontBold]);

  // 加载保存的设置
  const loadSavedSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem('ebookReaderSettings');
      if (saved) {
        const settings = JSON.parse(saved);
        setFontSize(settings.fontSize || 17);
        setLineHeight(settings.lineHeight || 1.6);
        setTheme(settings.theme || 'light');
        setPageAnimation(settings.pageAnimation || 'fade');
        setFontFamily(settings.fontFamily || 'system');
        setFontBold(settings.fontBold || false);
      }
    } catch (error) {
      // 加载设置失败时使用默认值
    }
  };

  // 保存阅读设置
  const saveReaderSettings = async (newSettings = {}) => {
    const settings = {
      fontSize: newSettings.fontSize !== undefined ? newSettings.fontSize : fontSize,
      lineHeight: newSettings.lineHeight !== undefined ? newSettings.lineHeight : lineHeight,
      theme: newSettings.theme !== undefined ? newSettings.theme : theme,
      pageAnimation: newSettings.pageAnimation !== undefined ? newSettings.pageAnimation : pageAnimation,
      fontFamily: newSettings.fontFamily !== undefined ? newSettings.fontFamily : fontFamily,
      fontBold: newSettings.fontBold !== undefined ? newSettings.fontBold : fontBold,
    };
    try {
      await AsyncStorage.setItem('ebookReaderSettings', JSON.stringify(settings));
    } catch (error) {
      // 保存设置失败时静默处理
    }
  };

  
  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // 加载章节列表
      if (bookId && chapters.length === 0) {
        const chaptersData = await getEbookChapters(bookId, source);
        setChapters(chaptersData.chapters || []);
        
        // 找到当前章节的索引
        const currentIndex = chaptersData.chapters?.findIndex(ch => ch.id === chapterId) || 0;
        setCurrentChapterIndex(currentIndex);
      }
      
      // 加载章节内容
      const data = await getChapterContent(chapterId, source);
      setContent(data.content || '');
      setChapterTitle(data.title || '');
      setCurrentPage(0);
    } catch (error) {
      console.error('加载章节内容失败:', error);
      setContent('加载失败,请重试');
    } finally {
      setLoading(false);
    }
  };

  const loadChapterContent = async () => {
    try {
      setLoading(true);
      const data = await getChapterContent(chapterId, source);
      setContent(data.content || '');
      setChapterTitle(data.title || '');
      setCurrentPage(0);
    } catch (error) {
      console.error('加载章节内容失败:', error);
      setContent('加载失败,请重试');
    } finally {
      setLoading(false);
    }
  };

  const saveReadingProgress = async (overridePage = null, overrideChapterId = null) => {
    if (!bookId || !chapterId) return;
    const pageToSave = overridePage !== null ? overridePage : currentPage;
    const chapterToSave = overrideChapterId || chapterId;

    // 避免重复写入相同位置
    if (
      lastSavedRef.current.chapterId === chapterToSave &&
      lastSavedRef.current.page === pageToSave
    ) {
      return;
    }

    const meta = {
      id: bookId,
      title: decodeURIComponent(bookTitle) || chapterTitle || '未知书籍',
      cover: decodeURIComponent(bookCover || ''),
      source,
    };

    try {
      await addHistory(meta, chapterToSave, pageToSave);
      lastSavedRef.current = { chapterId: chapterToSave, page: pageToSave };
    } catch (error) {
      // 静默失败即可
    }
  };

  // 分页函数
  const paginateContent = () => {
    if (!content) return;
    
    // 计算可用高度 (屏幕高度 - 顶部导航栏 - 底部进度条 - 内边距)
    const availableHeight = screenHeight - 100; // 顶部导航约60px + 底部约40px (优化后更紧凑)
    const availableWidth = screenWidth - 48; // 左右各24px内边距
    
    // 根据字体大小和行距计算每页可容纳的字符数
    const lineHeightPx = fontSize * lineHeight;
    const linesPerPage = Math.floor(availableHeight / lineHeightPx);
    const charsPerLine = Math.floor(availableWidth / fontSize * 1.8); // 中文字符宽度约为字体大小的0.9倍
    const charsPerPage = linesPerPage * charsPerLine;
    
    const contentPages = [];
    let remainingText = content;
    
    while (remainingText.length > 0) {
      const pageText = remainingText.substring(0, charsPerPage);
      contentPages.push(pageText);
      remainingText = remainingText.substring(charsPerPage);
    }
    
    setPages(contentPages);
    setTotalPages(contentPages.length);
  };

  // 翻页函数
  const goToNextPage = () => {
    if (isAnimating) return;
    
    if (currentPage < totalPages - 1) {
      animatePageTurn('next', () => {
        setCurrentPage(currentPage + 1);
      });
    } else if (currentChapterIndex < chapters.length - 1) {
      // 当前章节读完,加载下一章
      saveReadingProgress(totalPages - 1, chapterId);
      loadNextChapter();
    }
  };

  const goToPrevPage = () => {
    if (isAnimating) return;
    
    if (currentPage > 0) {
      animatePageTurn('prev', () => {
        setCurrentPage(currentPage - 1);
      });
    } else if (currentChapterIndex > 0) {
      // 加载上一章
      saveReadingProgress(0, chapterId);
      loadPrevChapter();
    }
  };

  // 翻页动画 - 固定使用淡入淡出效果
  const animatePageTurn = (direction, callback) => {
    setIsAnimating(true);
    
    // 先执行回调更新内容,然后执行动画
    callback();
    
    // 淡入淡出动画
    fadeAnim.setValue(1);
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setIsAnimating(false);
      });
    });
  };

  // 当前页变更时保存进度
  useEffect(() => {
    saveReadingProgress();
  }, [currentPage]);

  const loadNextChapter = () => {
    if (currentChapterIndex < chapters.length - 1) {
      const nextChapter = chapters[currentChapterIndex + 1];
      router.replace(`/ebook-reader/${nextChapter.id}?bookId=${bookId}&source=${source}`);
    }
  };

  const loadPrevChapter = () => {
    if (currentChapterIndex > 0) {
      const prevChapter = chapters[currentChapterIndex - 1];
      router.replace(`/ebook-reader/${prevChapter.id}?bookId=${bookId}&source=${source}`);
    }
  };

  const toggleTheme = (newTheme) => {
    setTheme(newTheme);
    saveReaderSettings({ theme: newTheme });
  };

  const increaseFont = () => {
    const newSize = Math.min(fontSize + 1, 24);
    setFontSize(newSize);
    saveReaderSettings({ fontSize: newSize });
  };
  const decreaseFont = () => {
    const newSize = Math.max(fontSize - 1, 12);
    setFontSize(newSize);
    saveReaderSettings({ fontSize: newSize });
  };

  const increaseLineHeight = () => {
    const newHeight = Math.min(lineHeight + 0.1, 2.5);
    setLineHeight(newHeight);
    saveReaderSettings({ lineHeight: newHeight });
  };
  const decreaseLineHeight = () => {
    const newHeight = Math.max(lineHeight - 0.1, 1.2);
    setLineHeight(newHeight);
    saveReaderSettings({ lineHeight: newHeight });
  };

  const setFontFamilyWithSave = (font) => {
    setFontFamily(font);
    saveReaderSettings({ fontFamily: font });
  };

  const toggleFontBold = () => {
    const newBold = !fontBold;
    setFontBold(newBold);
    saveReaderSettings({ fontBold: newBold });
  };

  // 手势处理
  const handleGestureEvent = (event) => {
    const { translationX } = event.nativeEvent;
    
    if (translationX > 50) {
      // 向右滑动 - 上一页
      goToPrevPage();
    } else if (translationX < -50) {
      // 向左滑动 - 下一页
      goToNextPage();
    }
  };

  const handleGestureStateChange = (event) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX } = event.nativeEvent;
      
      if (translationX > 50) {
        goToPrevPage();
      } else if (translationX < -50) {
        goToNextPage();
      }
    }
  };

  // 中间点击显示设置
  const handleCenterTap = () => {
    setShowSettings(!showSettings);
  };

  const getThemeColors = () => {
    switch (theme) {
      case 'dark':
        return {
          background: '#1a1a1a',
          text: '#e0e0e0',
          header: '#2a2a2a',
          headerText: '#ffffff',
        };
      case 'sepia':
        return {
          background: '#f4f1e8',
          text: '#5c4b37',
          header: '#e8dcc0',
          headerText: '#5c4b37',
        };
      default:
        return {
          background: '#ffffff',
          text: '#333333',
          header: '#f8f8f8',
          headerText: '#333333',
        };
    }
  };

  const colors = getThemeColors();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* 顶部导航栏 */}
      <View style={[styles.topNav, { backgroundColor: colors.header, paddingTop: 44 }]} >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.headerText }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.chapterTitle, { color: colors.headerText }]} numberOfLines={1}>
          {chapterTitle || '章节加载中...'}
        </Text>
        <View style={styles.pageInfo}>
          <Text style={[styles.pageText, { color: colors.headerText }]}>
            {currentPage + 1}/{totalPages}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6200EE" />
          <Text style={[styles.loadingText, { color: colors.text }]}>加载章节内容中...</Text>
        </View>
      ) : (
        <PanGestureHandler
          ref={gestureRef}
          onGestureEvent={handleGestureEvent}
          onHandlerStateChange={handleGestureStateChange}
        >
          <View style={styles.contentContainer}>
            {/* 左侧点击区域 - 上一页 */}
            <TouchableOpacity 
              style={styles.leftTapArea} 
              onPress={goToPrevPage}
              activeOpacity={0.8}
            />
            
            {/* 中间点击区域 - 显示设置 */}
            <TouchableOpacity 
              style={styles.centerTapArea} 
              onPress={handleCenterTap}
              activeOpacity={0.8}
            />
            
            {/* 右侧点击区域 - 下一页 */}
            <TouchableOpacity 
              style={styles.rightTapArea} 
              onPress={goToNextPage}
              activeOpacity={0.8}
            />
            
            {/* 内容显示区域 */}
            <Animated.View 
              style={[
                styles.contentArea,
                {
                  opacity: fadeAnim,
                }
              ]}
            >
              <Text style={[
                styles.pageContent, 
                { 
                  fontSize, 
                  lineHeight: fontSize * lineHeight, 
                  color: colors.text,
                  fontFamily: fontFamily === 'serif' ? 'serif' : 
                           fontFamily === 'monospace' ? 'monospace' : 'System',
                  fontWeight: fontBold ? 'bold' : '400',
                }
              ]}>
                {pages[currentPage] || ''}
              </Text>
            </Animated.View>
          </View>
        </PanGestureHandler>
      )}

      {/* 底部进度条和设置面板 */}
      <View style={styles.bottomContainer}>
        {/* 透明进度条 */}
        <View style={styles.bottomProgress}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${((currentPage + 1) / totalPages) * 100}%` }]} />
          </View>
          <Text style={[styles.progressText, { color: colors.text }]}>
            {Math.round(((currentPage + 1) / totalPages) * 100)}%
          </Text>
        </View>
        
        {/* 设置面板 */}
        {showSettings && (
          <View style={[styles.bottomSettings, { backgroundColor: colors.header }]}>
            {/* 字体大小调节 */}
            <View style={styles.settingGroup}>
              <Text style={[styles.settingLabel, { color: colors.headerText }]}>字体大小</Text>
              <View style={styles.settingButtons}>
                <TouchableOpacity onPress={decreaseFont} style={[styles.settingButton, { backgroundColor: colors.background }]}>
                  <Text style={[styles.settingButtonText, { color: colors.text }]}>A-</Text>
                </TouchableOpacity>
                <Text style={[styles.settingValue, { color: colors.headerText }]}>{fontSize}</Text>
                <TouchableOpacity onPress={increaseFont} style={[styles.settingButton, { backgroundColor: colors.background }]}>
                  <Text style={[styles.settingButtonText, { color: colors.text }]}>A+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 行距调节 */}
            <View style={styles.settingGroup}>
              <Text style={[styles.settingLabel, { color: colors.headerText }]}>行距</Text>
              <View style={styles.settingButtons}>
                <TouchableOpacity onPress={decreaseLineHeight} style={[styles.settingButton, { backgroundColor: colors.background }]}>
                  <Text style={[styles.settingButtonText, { color: colors.text }]}>-</Text>
                </TouchableOpacity>
                <Text style={[styles.settingValue, { color: colors.headerText }]}>{lineHeight.toFixed(1)}</Text>
                <TouchableOpacity onPress={increaseLineHeight} style={[styles.settingButton, { backgroundColor: colors.background }]}>
                  <Text style={[styles.settingButtonText, { color: colors.text }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 字体选择 */}
            <View style={styles.settingGroup}>
              <Text style={[styles.settingLabel, { color: colors.headerText }]}>字体样式</Text>
              <View style={styles.fontButtons}>
                {[
                  { key: 'system', label: '默认' },
                  { key: 'serif', label: '衬线' },
                  { key: 'monospace', label: '等宽' }
                ].map(font => (
                  <TouchableOpacity 
                    key={font.key}
                    onPress={() => setFontFamilyWithSave(font.key)} 
                    style={[
                      styles.fontButton, 
                      fontFamily === font.key && styles.fontButtonActive, 
                      { backgroundColor: fontFamily === font.key ? '#6200EE' : colors.background }
                    ]}
                  >
                    <Text style={[
                      styles.fontButtonText, 
                      { 
                        color: fontFamily === font.key ? '#fff' : colors.text,
                        fontFamily: font.key === 'serif' ? 'serif' : 
                                   font.key === 'monospace' ? 'monospace' : 'System'
                      }
                    ]}>
                      {font.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 字体加粗 */}
            <View style={styles.settingGroup}>
              <Text style={[styles.settingLabel, { color: colors.headerText }]}>字体加粗</Text>
              <TouchableOpacity 
                onPress={toggleFontBold}
                style={[
                  styles.boldButton,
                  fontBold && styles.boldButtonActive,
                  { backgroundColor: fontBold ? '#6200EE' : colors.background }
                ]}
              >
                <Text style={[
                  styles.boldButtonText,
                  { 
                    color: fontBold ? '#fff' : colors.text,
                    fontWeight: fontBold ? 'bold' : '400'
                  }
                ]}>
                  {fontBold ? '粗体' : '常规'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 主题切换 */}
            <View style={styles.settingGroup}>
              <Text style={[styles.settingLabel, { color: colors.headerText }]}>主题</Text>
              <View style={styles.themeButtons}>
                <TouchableOpacity 
                  onPress={() => toggleTheme('light')} 
                  style={[styles.themeButton, theme === 'light' && styles.themeButtonActive, { backgroundColor: theme === 'light' ? '#6200EE' : colors.background }]}
                >
                  <Text style={[styles.themeButtonText, { color: theme === 'light' ? '#fff' : colors.text }]}>白天</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => toggleTheme('sepia')} 
                  style={[styles.themeButton, theme === 'sepia' && styles.themeButtonActive, { backgroundColor: theme === 'sepia' ? '#6200EE' : colors.background }]}
                >
                  <Text style={[styles.themeButtonText, { color: theme === 'sepia' ? '#fff' : colors.text }]}>护眼</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => toggleTheme('dark')} 
                  style={[styles.themeButton, theme === 'dark' && styles.themeButtonActive, { backgroundColor: theme === 'dark' ? '#6200EE' : colors.background }]}
                >
                  <Text style={[styles.themeButtonText, { color: theme === 'dark' ? '#fff' : colors.text }]}>夜间</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  backText: {
    fontSize: 18,
    fontWeight: '600',
  },
  chapterTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  pageInfo: {
    marginLeft: 12,
  },
  pageText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  contentContainer: {
    flex: 1,
    position: 'relative',
  },
  leftTapArea: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '25%',
    zIndex: 1,
  },
  centerTapArea: {
    position: 'absolute',
    left: '25%',
    top: 0,
    bottom: 0,
    width: '50%',
    zIndex: 1,
  },
  rightTapArea: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '25%',
    zIndex: 1,
  },
  contentArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40, // 为底部进度条留出空间,优化后更紧凑
  },
  pageContent: {
    textAlign: 'justify',
    fontWeight: '400',
    includeFontPadding: false,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  bottomProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: 'transparent',
  },
  bottomSettings: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(224, 224, 224, 0.3)',
  },
  settingGroup: {
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  settingButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingButton: {
    width: 40,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  settingButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  settingValue: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 40,
    textAlign: 'center',
  },
  themeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  themeButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  themeButtonActive: {
    borderColor: '#6200EE',
  },
  themeButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  animationButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  animationButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  animationButtonActive: {
    borderColor: '#6200EE',
  },
  animationButtonText: {
    fontSize: 11,
    fontWeight: '500',
  },
  fontButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  fontButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  fontButtonActive: {
    borderColor: '#6200EE',
  },
  fontButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  boldButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  boldButtonActive: {
    borderColor: '#6200EE',
  },
  boldButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressBar: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(224, 224, 224, 0.3)',
    borderRadius: 1,
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'rgba(98, 0, 238, 0.8)',
    borderRadius: 1,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '500',
    minWidth: 35,
    color: 'rgba(51, 51, 51, 0.8)',
  },
});

export default EbookReaderScreen;

