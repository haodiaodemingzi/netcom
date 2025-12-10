/**
 * 电子书离线阅读器
 * 加载本地txt文件进行阅读，支持阅读进度记录
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  Animated,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import ebookDownloadManager from '../../services/ebookDownloadManager';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const EbookOfflineReaderScreen = () => {
  const router = useRouter();
  const { id, bookTitle = '' } = useLocalSearchParams();
  
  // 默认设置
  const defaultSettings = {
    fontSize: 17,
    lineHeight: 1.6,
    theme: 'light',
    fontBold: false,
  };

  const [fontSize, setFontSize] = useState(defaultSettings.fontSize);
  const [lineHeight, setLineHeight] = useState(defaultSettings.lineHeight);
  const [theme, setTheme] = useState(defaultSettings.theme);
  const [fontBold, setFontBold] = useState(defaultSettings.fontBold);
  
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState(null);
  
  // 分页相关状态
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [pages, setPages] = useState([]);
  
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
      paginateContent();
    }
  }, [content, fontSize, lineHeight, screenWidth, fontBold]);

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
        setLineHeight(settings.lineHeight || 1.6);
        setTheme(settings.theme || 'light');
        setFontBold(settings.fontBold || false);
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

  // 内容分页
  const paginateContent = () => {
    const contentPadding = 32;
    const headerHeight = 60;
    const footerHeight = 40;
    const availableWidth = screenWidth - contentPadding;
    const availableHeight = screenHeight - headerHeight - footerHeight - contentPadding;
    
    const charsPerLine = Math.floor(availableWidth / (fontSize * 0.6));
    const linesPerPage = Math.floor(availableHeight / (fontSize * lineHeight));
    const charsPerPage = charsPerLine * linesPerPage;
    
    const lines = content.split('\n');
    const pagesArray = [];
    let currentPageContent = '';
    let currentLineCount = 0;
    
    for (const line of lines) {
      const lineWraps = Math.ceil(line.length / charsPerLine) || 1;
      
      if (currentLineCount + lineWraps > linesPerPage) {
        if (currentPageContent.trim()) {
          pagesArray.push(currentPageContent.trim());
        }
        currentPageContent = line + '\n';
        currentLineCount = lineWraps;
      } else {
        currentPageContent += line + '\n';
        currentLineCount += lineWraps;
      }
    }
    
    if (currentPageContent.trim()) {
      pagesArray.push(currentPageContent.trim());
    }
    
    setPages(pagesArray);
    setTotalPages(pagesArray.length);
    
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* 顶部栏 */}
      <View style={[styles.header, { backgroundColor: colors.bg }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.text }]}>←</Text>
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {decodeURIComponent(bookTitle)} (离线)
          </Text>
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
      <View style={[styles.footer, { backgroundColor: colors.bg }]}>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  pageInfo: {
    fontSize: 12,
    marginLeft: 8,
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
});

export default EbookOfflineReaderScreen;
