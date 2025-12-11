/**
 * 电子书离线阅读器
 * 加载本地txt文件进行阅读，支持阅读进度记录，目录解析跳转
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  Animated,
  ScrollView,
  FlatList,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import ebookDownloadManager from '../../services/ebookDownloadManager';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const EbookOfflineReaderScreen = () => {
  const router = useRouter();
  const { id, bookTitle = '' } = useLocalSearchParams();
  const insets = useSafeAreaInsets(); // 获取安全区边距
  
  // 默认设置
  const defaultSettings = {
    fontSize: 17,
    lineHeight: 1.8, // 增大默认行高
    theme: 'light',
    fontBold: false,
    paragraphSpacing: 1.5, // 段落间距倍数
  };

  const [fontSize, setFontSize] = useState(defaultSettings.fontSize);
  const [lineHeight, setLineHeight] = useState(defaultSettings.lineHeight);
  const [theme, setTheme] = useState(defaultSettings.theme);
  const [fontBold, setFontBold] = useState(defaultSettings.fontBold);
  const [paragraphSpacing, setParagraphSpacing] = useState(defaultSettings.paragraphSpacing);
  
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false); // 目录显示状态
  const [error, setError] = useState(null);
  
  // 分页相关状态
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [pages, setPages] = useState([]);
  
  // 目录相关
  const [chapters, setChapters] = useState([]); // 解析出的章节目录
  const [chapterPageMap, setChapterPageMap] = useState({}); // 章节对应的页码
  
  const gestureRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [isAnimating, setIsAnimating] = useState(false);
  const progressSaveTimeout = useRef(null);

  useEffect(() => {
    loadSavedSettings();
    loadOfflineContent();
    return () => {
      // 离开时保存进度
      saveProgress();
    };
  }, [id]);

  useEffect(() => {
    if (content) {
      parseChapters(); // 解析目录
    }
  }, [content]);

  // 当章节解析完成或设置变化时重新分页
  useEffect(() => {
    if (content) {
      paginateContent();
    }
  }, [content, fontSize, lineHeight, screenWidth, fontBold, paragraphSpacing, chapters]);

  // 当页码变化时保存进度(防抖)
  useEffect(() => {
    if (progressSaveTimeout.current) {
      clearTimeout(progressSaveTimeout.current);
    }
    progressSaveTimeout.current = setTimeout(() => {
      saveProgress();
    }, 1000);
  }, [currentPage]);

  // 加载保存的设置
  const loadSavedSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem('ebookReaderSettings');
      if (saved) {
        const settings = JSON.parse(saved);
        setFontSize(settings.fontSize || 17);
        setLineHeight(settings.lineHeight || 1.8);
        setTheme(settings.theme || 'light');
        setFontBold(settings.fontBold || false);
        setParagraphSpacing(settings.paragraphSpacing || 1.5);
      }
    } catch (error) {
      // 使用默认值
    }
  };

  // 保存阅读设置
  const saveReaderSettings = async (newSettings = {}) => {
    const settings = {
      fontSize: newSettings.fontSize !== undefined ? newSettings.fontSize : fontSize,
      lineHeight: newSettings.lineHeight !== undefined ? newSettings.lineHeight : lineHeight,
      theme: newSettings.theme !== undefined ? newSettings.theme : theme,
      fontBold: newSettings.fontBold !== undefined ? newSettings.fontBold : fontBold,
      paragraphSpacing: newSettings.paragraphSpacing !== undefined ? newSettings.paragraphSpacing : paragraphSpacing,
    };
    try {
      await AsyncStorage.setItem('ebookReaderSettings', JSON.stringify(settings));
    } catch (error) {
      // 静默处理
    }
  };

  // 加载离线内容
  const loadOfflineContent = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const text = await ebookDownloadManager.readBook(id);
      setContent(text);
      
      // 恢复阅读进度
      const progress = await ebookDownloadManager.getReadingProgress(id);
      if (progress && progress.page !== undefined) {
        // 延迟设置页码，等待分页完成
        setTimeout(() => {
          setCurrentPage(progress.page);
        }, 100);
      }
    } catch (error) {
      console.error('加载离线内容失败:', error);
      setError(error.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 保存阅读进度
  const saveProgress = async () => {
    if (!id || totalPages === 0) return;
    
    try {
      await ebookDownloadManager.saveReadingProgress(id, {
        page: currentPage,
        totalPages,
        percentage: Math.round((currentPage + 1) / totalPages * 100),
      });
    } catch (error) {
      console.error('保存进度失败:', error);
    }
  };

  // 解析章节目录
  const parseChapters = () => {
    const lines = content.split('\n');
    const chapterList = [];
    const seenTitles = new Set(); // 用于去重
    
    let currentIndex = 0;
    let lastSeparatorLine = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 跳过空行
      if (!line) {
        currentIndex += lines[i].length + 1;
        continue;
      }
      
      // 检查是否是分隔线（至少10个─字符）
      if (/^─{10,}$/.test(line)) {
        lastSeparatorLine = i;
        currentIndex += lines[i].length + 1;
        continue;
      }
      
      // 如果上一行是分隔线，当前行可能是章节标题
      if (lastSeparatorLine === i - 1 && line.length < 60 && line.length > 0) {
        // 检查下一行是否也是分隔线（确认这是章节标题）
        const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
        if (/^─{10,}$/.test(nextLine)) {
          // 去重
          if (!seenTitles.has(line)) {
            seenTitles.add(line);
            chapterList.push({
              id: `chapter_${chapterList.length}`,
              title: line,
              lineIndex: i,
              charIndex: currentIndex,
            });
          }
        }
      }
      
      // 也检查常见的章节标题格式
      if (!seenTitles.has(line) && line.length < 50) {
        if (
          /^第[\d一二三四五六七八九十百千万]+[章节回卷集篇部]/.test(line) ||
          /^Chapter\s*\d+/i.test(line)
        ) {
          seenTitles.add(line);
          chapterList.push({
            id: `chapter_${chapterList.length}`,
            title: line,
            lineIndex: i,
            charIndex: currentIndex,
          });
        }
      }
      
      currentIndex += lines[i].length + 1;
    }
    
    setChapters(chapterList);
    console.log(`解析出 ${chapterList.length} 个章节`);
  };

  // 内容分页
  const paginateContent = () => {
    const contentPadding = 32;
    const headerHeight = 60 + insets.top; // 加上安全区高度
    const footerHeight = 40 + insets.bottom;
    const availableWidth = screenWidth - contentPadding;
    const availableHeight = screenHeight - headerHeight - footerHeight - contentPadding;
    
    const charsPerLine = Math.floor(availableWidth / (fontSize * 0.55));
    const linesPerPage = Math.floor(availableHeight / (fontSize * lineHeight));
    
    const lines = content.split('\n');
    const pagesArray = [];
    let currentPageContent = '';
    let currentLineCount = 0;
    let charCount = 0;
    const pageCharMap = {}; // 字符位置到页码的映射
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // 计算该行占用的行数
      let lineWraps = Math.ceil(trimmedLine.length / charsPerLine) || 1;
      
      // 如果是空行或长段落后的空行，增加间距
      const isEmptyLine = !trimmedLine;
      const isParagraphEnd = isEmptyLine && i > 0 && lines[i - 1].trim().length > 100;
      
      if (isParagraphEnd) {
        lineWraps = Math.ceil(paragraphSpacing); // 长段落后多空一些
      }
      
      // 检查是否需要分页
      if (currentLineCount + lineWraps > linesPerPage && currentPageContent.trim()) {
        pagesArray.push(currentPageContent.trim());
        currentPageContent = '';
        currentLineCount = 0;
      }
      
      // 记录该位置对应的页码
      pageCharMap[charCount] = pagesArray.length;
      
      // 添加内容
      if (!isEmptyLine) {
        currentPageContent += trimmedLine + '\n';
        currentLineCount += lineWraps;
      } else if (isParagraphEnd) {
        currentPageContent += '\n'; // 段落间距
        currentLineCount += lineWraps;
      } else {
        currentPageContent += '\n';
        currentLineCount += 1;
      }
      
      charCount += line.length + 1;
    }
    
    if (currentPageContent.trim()) {
      pagesArray.push(currentPageContent.trim());
    }
    
    setPages(pagesArray);
    setTotalPages(pagesArray.length);
    
    // 建立章节到页码的映射
    const chapterPages = {};
    chapters.forEach((chapter) => {
      // 找到最接近的页码
      let targetPage = 0;
      for (const [charPos, pageNum] of Object.entries(pageCharMap)) {
        if (parseInt(charPos) <= chapter.charIndex) {
          targetPage = pageNum;
        } else {
          break;
        }
      }
      chapterPages[chapter.id] = targetPage;
    });
    setChapterPageMap(chapterPages);
    
    // 确保当前页不超出范围
    if (currentPage >= pagesArray.length) {
      setCurrentPage(Math.max(0, pagesArray.length - 1));
    }
  };

  // 翻页动画
  const animatePageChange = (direction, callback) => {
    if (isAnimating) return;
    setIsAnimating(true);
    
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsAnimating(false);
    });
    
    callback();
  };

  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      animatePageChange('next', () => setCurrentPage(prev => prev + 1));
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 0) {
      animatePageChange('prev', () => setCurrentPage(prev => prev - 1));
    }
  };

  const handleCenterTap = () => {
    setShowSettings(!showSettings);
  };

  // 跳转到指定章节
  const goToChapter = (chapter) => {
    const targetPage = chapterPageMap[chapter.id];
    if (targetPage !== undefined) {
      setCurrentPage(targetPage);
      setShowToc(false);
    }
  };

  // 获取当前章节名称
  const getCurrentChapterTitle = useMemo(() => {
    if (chapters.length === 0) return '';
    
    let currentChapter = chapters[0];
    for (const chapter of chapters) {
      const chapterPage = chapterPageMap[chapter.id];
      if (chapterPage !== undefined && chapterPage <= currentPage) {
        currentChapter = chapter;
      } else {
        break;
      }
    }
    return currentChapter?.title || '';
  }, [currentPage, chapters, chapterPageMap]);

  // 手势处理
  const handleGestureEvent = () => {};
  
  const handleGestureStateChange = ({ nativeEvent }) => {
    if (nativeEvent.state === State.END) {
      const { translationX, velocityX } = nativeEvent;
      
      if (translationX > 50 || velocityX > 500) {
        goToPrevPage();
      } else if (translationX < -50 || velocityX < -500) {
        goToNextPage();
      }
    }
  };

  // 主题配置
  const themes = {
    light: { bg: '#FFFFFF', text: '#333333', secondary: '#666666' },
    sepia: { bg: '#F5E6D3', text: '#5B4636', secondary: '#7B6656' },
    dark: { bg: '#1A1A1A', text: '#E0E0E0', secondary: '#999999' },
    green: { bg: '#C7EDCC', text: '#2D4A2D', secondary: '#4A6A4A' },
  };
  
  const colors = themes[theme] || themes.light;

  const toggleTheme = (newTheme) => {
    setTheme(newTheme);
    saveReaderSettings({ theme: newTheme });
  };

  const increaseFont = () => {
    const newSize = Math.min(fontSize + 1, 28);
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

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
            <Text style={styles.retryButtonText}>返回</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['left', 'right']}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* 顶部栏 - 加上安全区边距 */}
      <View style={[styles.header, { backgroundColor: colors.bg, paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.text }]}>←</Text>
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {decodeURIComponent(bookTitle)}
          </Text>
          {getCurrentChapterTitle ? (
            <Text style={[styles.chapterTitle, { color: colors.secondary }]} numberOfLines={1}>
              {getCurrentChapterTitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setShowToc(true)} style={styles.tocButton}>
            <Text style={[styles.tocButtonText, { color: colors.text }]}>目录{chapters.length > 0 ? `(${chapters.length})` : ''}</Text>
          </TouchableOpacity>
          <Text style={[styles.pageInfo, { color: colors.secondary }]}>
            {currentPage + 1}/{totalPages}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6200EE" />
          <Text style={[styles.loadingText, { color: colors.text }]}>加载中...</Text>
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
                { opacity: fadeAnim }
              ]}
              pointerEvents="none"
            >
              <Text
                style={[
                  styles.contentText,
                  {
                    fontSize,
                    lineHeight: fontSize * lineHeight,
                    color: colors.text,
                    fontWeight: fontBold ? 'bold' : 'normal',
                  },
                ]}
              >
                {pages[currentPage] || ''}
              </Text>
            </Animated.View>
          </View>
        </PanGestureHandler>
      )}

      {/* 底部进度条 */}
      <View style={[styles.footer, { backgroundColor: colors.bg, paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${((currentPage + 1) / totalPages) * 100}%` }
            ]} 
          />
        </View>
        <Text style={[styles.progressText, { color: colors.secondary }]}>
          {Math.round((currentPage + 1) / totalPages * 100)}%
        </Text>
      </View>

      {/* 设置面板 */}
      {showSettings && (
        <View style={[styles.settingsPanel, { backgroundColor: colors.bg }]}>
          <View style={styles.settingsRow}>
            <Text style={[styles.settingsLabel, { color: colors.text }]}>字体大小</Text>
            <View style={styles.settingsControls}>
              <TouchableOpacity onPress={decreaseFont} style={styles.settingsButton}>
                <Text style={styles.settingsButtonText}>A-</Text>
              </TouchableOpacity>
              <Text style={[styles.settingsValue, { color: colors.text }]}>{fontSize}</Text>
              <TouchableOpacity onPress={increaseFont} style={styles.settingsButton}>
                <Text style={styles.settingsButtonText}>A+</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.settingsRow}>
            <Text style={[styles.settingsLabel, { color: colors.text }]}>行间距</Text>
            <View style={styles.settingsControls}>
              <TouchableOpacity onPress={decreaseLineHeight} style={styles.settingsButton}>
                <Text style={styles.settingsButtonText}>-</Text>
              </TouchableOpacity>
              <Text style={[styles.settingsValue, { color: colors.text }]}>{lineHeight.toFixed(1)}</Text>
              <TouchableOpacity onPress={increaseLineHeight} style={styles.settingsButton}>
                <Text style={styles.settingsButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.settingsRow}>
            <Text style={[styles.settingsLabel, { color: colors.text }]}>主题</Text>
            <View style={styles.themeButtons}>
              {Object.entries(themes).map(([key, value]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.themeButton,
                    { backgroundColor: value.bg, borderColor: value.text },
                    theme === key && styles.themeButtonActive,
                  ]}
                  onPress={() => toggleTheme(key)}
                >
                  <Text style={[styles.themeButtonText, { color: value.text }]}>
                    {key === 'light' ? '白' : key === 'sepia' ? '黄' : key === 'dark' ? '黑' : '绿'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.closeSettingsButton}
            onPress={() => setShowSettings(false)}
          >
            <Text style={styles.closeSettingsText}>关闭</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 目录弹窗 */}
      <Modal
        visible={showToc}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowToc(false)}
      >
        <View style={styles.tocModalOverlay}>
          <View style={[styles.tocModal, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
            <View style={styles.tocHeader}>
              <Text style={[styles.tocTitle, { color: colors.text }]}>目录</Text>
              <TouchableOpacity onPress={() => setShowToc(false)} style={styles.tocCloseButton}>
                <Text style={[styles.tocCloseText, { color: colors.text }]}>×</Text>
              </TouchableOpacity>
            </View>
            {chapters.length > 0 ? (
              <FlatList
                data={chapters}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => {
                  const isCurrentChapter = getCurrentChapterTitle === item.title;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.tocItem,
                        isCurrentChapter && styles.tocItemActive,
                      ]}
                      onPress={() => goToChapter(item)}
                    >
                      <Text 
                        style={[
                          styles.tocItemText, 
                          { color: colors.text },
                          isCurrentChapter && styles.tocItemTextActive,
                        ]} 
                        numberOfLines={2}
                      >
                        {item.title}
                      </Text>
                      <Text style={[styles.tocItemPage, { color: colors.secondary }]}>
                        {(chapterPageMap[item.id] || 0) + 1}页
                      </Text>
                    </TouchableOpacity>
                  );
                }}
                ItemSeparatorComponent={() => <View style={styles.tocSeparator} />}
                contentContainerStyle={styles.tocList}
                showsVerticalScrollIndicator={true}
              />
            ) : (
              <View style={styles.tocEmptyContainer}>
                <Text style={[styles.tocEmptyText, { color: colors.secondary }]}>
                  未解析到章节目录
                </Text>
                <Text style={[styles.tocEmptyHint, { color: colors.secondary }]}>
                  本书可能没有标准的章节格式
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: '600',
  },
  titleContainer: {
    flex: 1,
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  chapterTitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tocButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
  },
  tocButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  pageInfo: {
    fontSize: 12,
    minWidth: 50,
    textAlign: 'right',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#6200EE',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
    zIndex: 10,
  },
  centerTapArea: {
    position: 'absolute',
    left: '25%',
    top: 0,
    bottom: 0,
    width: '50%',
    zIndex: 10,
  },
  rightTapArea: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '25%',
    zIndex: 10,
  },
  contentArea: {
    flex: 1,
    padding: 16,
  },
  contentText: {
    textAlign: 'justify',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
  progressBar: {
    flex: 1,
    height: 3,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginRight: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6200EE',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    minWidth: 40,
    textAlign: 'right',
  },
  settingsPanel: {
    position: 'absolute',
    bottom: 50,
    left: 16,
    right: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  settingsLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  settingsControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#6200EE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  settingsValue: {
    fontSize: 14,
    minWidth: 30,
    textAlign: 'center',
  },
  themeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  themeButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeButtonActive: {
    borderWidth: 2,
    borderColor: '#6200EE',
  },
  themeButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  closeSettingsButton: {
    marginTop: 8,
    paddingVertical: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
  },
  closeSettingsText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  // 目录样式
  tocModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  tocModal: {
    flex: 1,
    marginTop: 50,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  tocHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  tocTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  tocCloseButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tocCloseText: {
    fontSize: 28,
    fontWeight: '300',
  },
  tocList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tocItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  tocItemActive: {
    backgroundColor: 'rgba(98, 0, 238, 0.1)',
  },
  tocItemText: {
    flex: 1,
    fontSize: 15,
    marginRight: 12,
  },
  tocItemTextActive: {
    color: '#6200EE',
    fontWeight: '600',
  },
  tocItemPage: {
    fontSize: 12,
  },
  tocSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 12,
  },
  tocEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  tocEmptyText: {
    fontSize: 16,
    marginBottom: 8,
  },
  tocEmptyHint: {
    fontSize: 13,
    textAlign: 'center',
  },
});

export default EbookOfflineReaderScreen;
