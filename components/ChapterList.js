import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import downloadManager from '../services/downloadManager';
import { getHistory } from '../services/storage';

const ChapterList = ({ 
  chapters, 
  onChapterPress, 
  currentChapterId,
  darkMode = false,
  comicId,
  comicTitle,
  source,
  ListHeaderComponent
}) => {
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedChapters, setSelectedChapters] = useState(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [activeTab, setActiveTab] = useState('chapter');
  const [downloadState, setDownloadState] = useState(null);
  const [readingHistory, setReadingHistory] = useState(null);
  const [preparingDownloads, setPreparingDownloads] = useState(new Set());
  const [activeRange, setActiveRange] = useState('all');

  useEffect(() => {
    // 立即获取当前状态
    const currentState = downloadManager.getState();
    console.log('ChapterList 初始化时获取 downloadState:', {
      downloadedCount: currentState.downloadedChapters?.length || 0,
      queueCount: currentState.queue?.length || 0,
    });
    setDownloadState(currentState);
    
    // 订阅后续更新
    const unsubscribe = downloadManager.subscribe((state) => {
      console.log('ChapterList 收到 downloadState 更新:', {
        downloadedCount: state.downloadedChapters?.length || 0,
        queueCount: state.queue?.length || 0,
      });
      setDownloadState(state);
    });
    return unsubscribe;
  }, []);

  const loadReadingHistory = useCallback(async () => {
    if (!comicId) return;
    const history = await getHistory();
    const comicHistory = history.find(item => item.id === comicId);
    setReadingHistory(comicHistory);
  }, [comicId]);

  useEffect(() => {
    loadReadingHistory();
  }, [loadReadingHistory]);

  // 每次页面获得焦点时重新加载阅读历史
  useFocusEffect(
    useCallback(() => {
      loadReadingHistory();
    }, [loadReadingHistory])
  );

  // 提取章节编号进行数字排序
  const extractChapterNumber = (title) => {
    const match = title.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  const sortedChapters = [...chapters].sort((a, b) => {
    const numA = extractChapterNumber(a.title);
    const numB = extractChapterNumber(b.title);
    return sortOrder === 'desc' ? numB - numA : numA - numB;
  });

  // 识别章节类型并分组
  const detectChapterType = (title) => {
    // 检测是否包含卷标识
    if (/第[一二三四五六七八九十百千\d]+卷|卷[\d]+|Vol\.[\d]+|Volume[\d]+/i.test(title)) {
      return 'volume';
    }
    // 检测是否包含章节标识
    if (/第[\d]+话|第[\d]+章|话[\d]+|章[\d]+|Ch\.[\d]+|Chapter[\d]+|EP[\d]+/i.test(title)) {
      return 'chapter';
    }
    return 'chapter';
  };

  const groupChapters = (chapters) => {
    const groups = {};
    
    chapters.forEach((chapter) => {
      const type = detectChapterType(chapter.title);
      
      if (type === 'volume') {
        // 所有卷放在一个组
        if (!groups['卷']) {
          groups['卷'] = {
            type: 'volume',
            name: '卷',
            chapters: []
          };
        }
        groups['卷'].chapters.push(chapter);
      } else {
        // 所有章节放在一个组
        if (!groups['章节']) {
          groups['章节'] = {
            type: 'chapter',
            name: '章节',
            chapters: []
          };
        }
        groups['章节'].chapters.push(chapter);
      }
    });
    
    return Object.values(groups);
  };

  // 分组数据
  const groupedData = groupChapters(sortedChapters);
  const volumeChapters = groupedData.find(g => g.type === 'volume');
  const normalChapters = groupedData.find(g => g.type === 'chapter');
  
  // 根据当前标签页获取章节
  const tabChapters = activeTab === 'volume' 
    ? (volumeChapters?.chapters || [])
    : (normalChapters?.chapters || []);
  
  // 判断是否有卷分类
  const hasVolumes = volumeChapters && volumeChapters.chapters && volumeChapters.chapters.length > 0;
  
  // 生成区间列表（每100章一个区间，基于当前排序）
  const rangeSize = 100;
  const generateRanges = (chapters) => {
    if (chapters.length <= rangeSize) return [];
    const ranges = [];
    for (let i = 0; i < chapters.length; i += rangeSize) {
      const start = i + 1;
      const end = Math.min(i + rangeSize, chapters.length);
      // 使用第一个和最后一个章节的编号来显示区间
      const firstChapter = chapters[i];
      const lastChapter = chapters[Math.min(i + rangeSize - 1, chapters.length - 1)];
      const firstNum = extractChapterNumber(firstChapter.title);
      const lastNum = extractChapterNumber(lastChapter.title);
      
      ranges.push({
        id: `range-${start}-${end}`,
        label: `${firstNum}-${lastNum}`,
        start,
        end,
        count: end - start + 1
      });
    }
    return ranges;
  };
  
  const ranges = generateRanges(tabChapters);
  const hasRanges = ranges.length > 0;
  
  // 根据选择的区间筛选显示的章节
  const displayChapters = activeRange === 'all' 
    ? tabChapters
    : (() => {
        const range = ranges.find(r => r.id === activeRange);
        if (!range) return tabChapters;
        return tabChapters.slice(range.start - 1, range.end);
      })();

  const toggleSort = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    setActiveRange('all');
  };
  
  const handleRangeChange = (rangeId) => {
    setActiveRange(rangeId);
    setSelectedChapters(new Set());
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    if (selectionMode) {
      setSelectedChapters(new Set());
    }
  };

  const toggleChapterSelection = React.useCallback((chapterId) => {
    setSelectedChapters(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(chapterId)) {
        newSelected.delete(chapterId);
      } else {
        newSelected.add(chapterId);
      }
      return newSelected;
    });
  }, []);

  const selectAll = () => {
    const allChapterIds = displayChapters.map(c => c.id);
    if (selectedChapters.size === allChapterIds.length && allChapterIds.length > 0) {
      setSelectedChapters(new Set());
    } else {
      setSelectedChapters(new Set(allChapterIds));
    }
  };
  
  const selectCurrentRange = () => {
    const allChapterIds = displayChapters.map(c => c.id);
    setSelectedChapters(new Set(allChapterIds));
  };

  const handleDownloadSelected = async () => {
    if (selectedChapters.size === 0) {
      Alert.alert('提示', '请至少选择一个章节');
      return;
    }
    
    const selectedChaptersList = displayChapters.filter(c => selectedChapters.has(c.id));
    
    setPreparingDownloads(prev => new Set([...prev, ...selectedChaptersList.map(c => c.id)]));
    
    try {
      await downloadManager.downloadChapters(
        comicId,
        comicTitle,
        selectedChaptersList,
        source
      );
      
      // 下载任务已加入队列，立即清除preparing状态
      setPreparingDownloads(prev => {
        const next = new Set(prev);
        selectedChaptersList.forEach(c => next.delete(c.id));
        return next;
      });
      
      setSelectedChapters(new Set());
      setSelectionMode(false);
    } catch (error) {
      console.error('批量下载失败:', error);
      // 发生错误时也清除preparing状态
      setPreparingDownloads(prev => {
        const next = new Set(prev);
        selectedChaptersList.forEach(c => next.delete(c.id));
        return next;
      });
    }
  };

  // 缓存已下载章节的 Set，避免频繁的数组查找
  const downloadedChaptersSet = React.useMemo(() => {
    if (!downloadState?.downloadedChapters) return new Set();
    return new Set(downloadState.downloadedChapters);
  }, [downloadState?.downloadedChapters]);

  // 缓存队列中的任务 Map，避免频繁的数组查找
  const queueTasksMap = React.useMemo(() => {
    if (!downloadState?.queue) return new Map();
    const map = new Map();
    downloadState.queue.forEach(task => {
      map.set(task.chapterId, task);
    });
    return map;
  }, [downloadState?.queue]);

  const getChapterDownloadStatus = React.useCallback((chapterId) => {
    // 首先检查是否已下载完成（O(1) 查找）
    if (downloadedChaptersSet.has(chapterId)) {
      return 'completed';
    }
    
    // 检查是否在下载队列中（O(1) 查找）
    const task = queueTasksMap.get(chapterId);
    if (task) {
      return {
        status: task.status,
        progress: task.progress
      };
    }
    
    // 最后检查是否在准备中
    if (preparingDownloads.has(chapterId)) {
      return {
        status: 'pending',
        progress: 0
      };
    }
    
    return null;
  }, [downloadedChaptersSet, queueTasksMap, preparingDownloads]);

  const handleSingleDownload = React.useCallback(async (chapter) => {
    setPreparingDownloads(prev => new Set([...prev, chapter.id]));
    
    try {
      await downloadManager.downloadChapters(
        comicId,
        comicTitle,
        [chapter],
        source
      );
      
      // 下载任务已加入队列，立即清除preparing状态
      setPreparingDownloads(prev => {
        const next = new Set(prev);
        next.delete(chapter.id);
        return next;
      });
    } catch (error) {
      console.error('下载失败:', error);
      // 发生错误时也清除preparing状态
      setPreparingDownloads(prev => {
        const next = new Set(prev);
        next.delete(chapter.id);
        return next;
      });
    }
  }, [comicId, comicTitle, source]);

  // 新的直接下载方法 - 使用完整图片URL
  const handleDirectDownload = async (chapter) => {
    try {
      Alert.alert(
        '下载确认',
        `确定要直接下载 "${chapter.title}" 吗？\n\n这将下载完整的图片，可以离线阅读。`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '确定',
            onPress: async () => {
              try {
                console.log(`开始直接下载章节: ${chapter.title}`);
                
                const result = await downloadManager.downloadChapterDirect(
                  comicId,
                  comicTitle,
                  chapter,
                  source,
                  (progress) => {
                    // 显示下载进度
                    if (progress.status === 'downloading') {
                      console.log(`下载进度: ${progress.percentage}% (${progress.completed}/${progress.total})`);
                    }
                  }
                );

                if (result.alreadyDownloaded) {
                  Alert.alert('提示', `"${chapter.title}" 已经下载过了`);
                } else if (result.success) {
                  Alert.alert(
                    '下载完成',
                    `"${chapter.title}" 下载完成！\n成功: ${result.successCount} 张\n失败: ${result.failedCount} 张`
                  );
                } else {
                  Alert.alert('下载失败', '章节下载过程中出现错误');
                }
              } catch (error) {
                console.error('直接下载失败:', error);
                Alert.alert('下载失败', error.message || '下载过程中出现错误');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('下载确认失败:', error);
      Alert.alert('错误', '无法启动下载');
    }
  };

  const handleCardPress = React.useCallback((item) => {
    if (selectionMode) {
      toggleChapterSelection(item.id);
    } else {
      onChapterPress(item);
    }
  }, [selectionMode, toggleChapterSelection, onChapterPress]);

  const ChapterCard = React.memo(({ item, isSelected, isActive, hasReadingProgress, readingPage, downloadStatus, onPress, selectionMode, onSingleDownload }) => {
    
    const isDownloading = downloadStatus && typeof downloadStatus === 'object' && 
                         downloadStatus.status === 'downloading';
    const isPending = downloadStatus && typeof downloadStatus === 'object' && 
                     downloadStatus.status === 'pending';
    const isCompleted = downloadStatus === 'completed';
    const downloadProgress = isDownloading ? (downloadStatus.progress || 0) : 0;
    
    // 长按状态
    const [isLongPressed, setIsLongPressed] = React.useState(false);
    const longPressTimer = React.useRef(null);
    
    const progressAnimRef = React.useRef(null);
    if (!progressAnimRef.current) {
      progressAnimRef.current = new Animated.Value(downloadProgress);
    }
    const progressAnim = progressAnimRef.current;
    const completionAnimRef = React.useRef(null);
    if (!completionAnimRef.current) {
      completionAnimRef.current = new Animated.Value(isCompleted ? 1 : 0);
    }
    const completionAnim = completionAnimRef.current;
    const prevProgressRef = React.useRef(downloadProgress);
    const prevCompletedRef = React.useRef(isCompleted);
    const [showingCompletion, setShowingCompletion] = React.useState(false);
    
    React.useEffect(() => {
      if (isDownloading) {
        // 只在进度真正变化时才动画
        if (Math.abs(downloadProgress - prevProgressRef.current) > 0.001) {
          Animated.timing(progressAnim, {
            toValue: downloadProgress,
            duration: 200,
            useNativeDriver: false,
          }).start();
          prevProgressRef.current = downloadProgress;
        }
      }
    }, [downloadProgress, isDownloading, isPending]);
    
    React.useEffect(() => {
      // 检测到完成状态变化时触发动画
      if (isCompleted && !prevCompletedRef.current) {
        setShowingCompletion(true);
        // 进度条动画到100%
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }).start(() => {
          // 完成后触发完成徽章的弹出动画
          completionAnim.setValue(0);
          Animated.spring(completionAnim, {
            toValue: 1,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
          }).start(() => {
            // 动画完成后隐藏进度条
            setTimeout(() => setShowingCompletion(false), 100);
          });
        });
      }
      prevCompletedRef.current = isCompleted;
    }, [isCompleted]);
    
    const handlePressIn = () => {
      longPressTimer.current = setTimeout(() => {
        if (isCompleted) {
          setIsLongPressed(true);
        }
      }, 500);
    };

    const handlePressOut = () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };

    return (
      <TouchableOpacity
        style={[
          styles.chapterCard,
          darkMode && styles.chapterCardDark,
          isActive && styles.chapterCardActive,
          isSelected && styles.chapterCardSelected,
        ]}
        onPress={() => onPress(item)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.7}
      >
        {selectionMode && (
          <View style={styles.checkboxContainer}>
            <View style={[
              styles.checkbox,
              isSelected && styles.checkboxSelected
            ]}>
              {isSelected && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </View>
          </View>
        )}
        
        <View style={styles.chapterInfo}>
          <Text 
            style={[
              styles.chapterTitle,
              darkMode && styles.chapterTitleDark,
              isActive && styles.chapterTitleActive,
            ]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          {item.updateTime && (
            <Text 
              style={[
                styles.chapterTime,
                darkMode && styles.chapterTimeDark,
              ]}
            >
              {item.updateTime}
            </Text>
          )}
        </View>
        
        <View style={styles.chapterActions}>
          {hasReadingProgress && readingPage > 0 && (
            <View style={styles.readBadge}>
              <Text style={styles.readBadgeText}>P{readingPage}</Text>
            </View>
          )}
          
          {downloadStatus === 'completed' && (
            <Animated.View 
              style={[
                styles.downloadActionRow,
                {
                  opacity: completionAnim,
                  transform: [
                    {
                      scale: completionAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.8, 1],
                      }),
                    },
                  ],
                }
              ]}
            >
              <View style={styles.downloadedBadge}>
                <Text style={styles.downloadedBadgeText}>✓ 已下载</Text>
              </View>
              {isLongPressed && !selectionMode && (
                <TouchableOpacity 
                  style={styles.deleteButton}
                  onPress={async (e) => {
                    e.stopPropagation();
                    Alert.alert(
                      '删除章节',
                      `确定要删除"${item.title}"的下载数据吗？`,
                      [
                        { text: '取消', style: 'cancel' },
                        { 
                          text: '删除', 
                          style: 'destructive',
                          onPress: async () => {
                            await downloadManager.deleteChapter(item.comicId || comicId, item.id);
                            setIsLongPressed(false);
                          }
                        }
                      ]
                    );
                  }}
                >
                  <Text style={styles.deleteButtonText}>删除</Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          )}
          
          {downloadStatus?.status === 'downloading' && (
            <View style={styles.downloadActionRow}>
              <View style={styles.downloadingBadge}>
                <Text style={styles.downloadingText}>
                  {Math.round(downloadStatus.progress * 100)}%
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.pauseButton}
                onPress={(e) => {
                  e.stopPropagation();
                  downloadManager.pauseDownload(item.id);
                }}
              >
                <Text style={styles.pauseButtonText}>暂停</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {downloadStatus?.status === 'pending' && (
            <View style={styles.downloadActionRow}>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingText}>排队中</Text>
              </View>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={(e) => {
                  e.stopPropagation();
                  downloadManager.cancelDownload(item.id);
                }}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {downloadStatus?.status === 'paused' && (
            <View style={styles.downloadActionRow}>
              <View style={styles.pausedBadge}>
                <Text style={styles.pausedText}>已暂停</Text>
              </View>
              <TouchableOpacity 
                style={styles.resumeButton}
                onPress={(e) => {
                  e.stopPropagation();
                  downloadManager.resumeDownload(item.id);
                }}
              >
                <Text style={styles.resumeButtonText}>继续</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={(e) => {
                  e.stopPropagation();
                  downloadManager.cancelDownload(item.id);
                }}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {downloadStatus?.status === 'failed' && (
            <View style={styles.downloadActionRow}>
              <TouchableOpacity 
                style={styles.failedBadge}
                onPress={(e) => {
                  e.stopPropagation();
                  downloadManager.retryDownload(item.id);
                }}
              >
                <Text style={styles.failedText}>重试</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={(e) => {
                  e.stopPropagation();
                  downloadManager.cancelDownload(item.id);
                }}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {!selectionMode && !downloadStatus && (
            <TouchableOpacity 
              style={styles.downloadButton}
              activeOpacity={0.6}
              onPress={(e) => {
                e.stopPropagation();
                onSingleDownload(item);
              }}
            >
              <Text style={styles.downloadButtonText}>下载</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {(isDownloading || showingCompletion) && (
          <View style={styles.progressBarContainer}>
            <Animated.View 
              style={[
                styles.progressBar,
                { 
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%']
                  })
                }
              ]}
            />
          </View>
        )}
      </TouchableOpacity>
    );
  }, (prevProps, nextProps) => {
    // 检查影响渲染的props是否变化
    // 返回 true 表示 props 相同，不需要重新渲染
    const downloadStatusEqual = 
      prevProps.downloadStatus === nextProps.downloadStatus ||
      (prevProps.downloadStatus && nextProps.downloadStatus &&
       prevProps.downloadStatus.status === nextProps.downloadStatus.status &&
       prevProps.downloadStatus.progress === nextProps.downloadStatus.progress);
    
    return (
      prevProps.item.id === nextProps.item.id &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isActive === nextProps.isActive &&
      prevProps.hasReadingProgress === nextProps.hasReadingProgress &&
      prevProps.readingPage === nextProps.readingPage &&
      prevProps.onPress === nextProps.onPress &&
      prevProps.selectionMode === nextProps.selectionMode &&
      prevProps.onSingleDownload === nextProps.onSingleDownload &&
      downloadStatusEqual
    );
  });

  const renderListHeader = () => (
    <View>
      {ListHeaderComponent ? ListHeaderComponent() : null}
      
      <View style={styles.header}>
        {!selectionMode ? (
          <View style={styles.headerLeft}>
            <Text 
              style={[
                styles.headerTitle,
                darkMode && styles.headerTitleDark,
              ]}
            >
              章节列表 ({displayChapters.length})
            </Text>
          </View>
        ) : (
          <View style={styles.headerLeftSelection}>
            <Text style={styles.headerTitle}>
              章节列表 ({displayChapters.length})
            </Text>
            <Text style={styles.selectedCountVertical}>
              已选 {selectedChapters.size}
            </Text>
          </View>
        )}
        
        <View style={styles.headerActions}>
          {selectionMode && (
            <>
              {activeRange !== 'all' && (
                <TouchableOpacity 
                  onPress={selectCurrentRange}
                  style={[styles.headerActionButton, styles.headerRangeButton]}
                >
                  <Text style={[styles.headerActionButtonText, styles.headerRangeButtonText]}>选择区间</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                onPress={selectAll}
                style={styles.headerActionButton}
              >
                <Text style={styles.headerActionButtonText}>
                  {selectedChapters.size === displayChapters.length && displayChapters.length > 0 ? '取消全选' : '全选'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleDownloadSelected}
                style={[styles.headerActionButton, styles.headerDownloadButton]}
              >
                <Text style={[styles.headerActionButtonText, styles.headerDownloadButtonText]}>下载</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => {
                  Alert.alert(
                    '删除章节',
                    `确定要删除选中的 ${selectedChapters.size} 个章节的下载数据吗？`,
                    [
                      { text: '取消', style: 'cancel' },
                      { 
                        text: '删除', 
                        style: 'destructive',
                        onPress: async () => {
                          for (const chapterId of selectedChapters) {
                            const chapter = displayChapters.find(c => c.id === chapterId);
                            if (chapter) {
                              await downloadManager.deleteChapter(comicId, chapterId);
                            }
                          }
                          setSelectedChapters(new Set());
                          setSelectionMode(false);
                        }
                      }
                    ]
                  );
                }}
                style={[styles.headerActionButton, styles.headerDeleteButton]}
              >
                <Text style={[styles.headerActionButtonText, styles.headerDeleteButtonText]}>删除</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity 
            onPress={toggleSelectionMode}
            style={[styles.headerActionButton, selectionMode && styles.headerCancelButton]}
          >
            <Text style={styles.headerActionButtonText}>
              {selectionMode ? '取消' : '批量下载'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={toggleSort}
            style={styles.headerActionButton}
          >
            <Text style={styles.headerActionButtonText}>
              {sortOrder === 'desc' ? '倒序' : '正序'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {hasVolumes && (
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'volume' && styles.tabActive
            ]}
            onPress={() => {
              setActiveTab('volume');
              setActiveRange('all');
            }}
          >
            <Text style={[
              styles.tabText,
              activeTab === 'volume' && styles.tabTextActive
            ]}>
              卷 ({volumeChapters?.chapters?.length || 0})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'chapter' && styles.tabActive
            ]}
            onPress={() => {
              setActiveTab('chapter');
              setActiveRange('all');
            }}
          >
            <Text style={[
              styles.tabText,
              activeTab === 'chapter' && styles.tabTextActive
            ]}>
              章节 ({normalChapters?.chapters.length || 0})
            </Text>
          </TouchableOpacity>
        </View>
      )}
      
      {hasRanges && (
        <View style={styles.rangeContainer}>
          <Text style={styles.rangeTitle}>区间选择:</Text>
          <View style={styles.rangeList}>
            <TouchableOpacity
              style={[
                styles.rangeChip,
                activeRange === 'all' && styles.rangeChipActive
              ]}
              onPress={() => handleRangeChange('all')}
            >
              <Text style={[
                styles.rangeChipText,
                activeRange === 'all' && styles.rangeChipTextActive
              ]}>
                全部 ({tabChapters.length})
              </Text>
            </TouchableOpacity>
            {ranges.map((range) => (
              <TouchableOpacity
                key={range.id}
                style={[
                  styles.rangeChip,
                  activeRange === range.id && styles.rangeChipActive
                ]}
                onPress={() => handleRangeChange(range.id)}
              >
                <Text style={[
                  styles.rangeChipText,
                  activeRange === range.id && styles.rangeChipTextActive
                ]}>
                  {range.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  const renderChapterCard = React.useCallback(({ item }) => {
    const isActive = item.id === currentChapterId;
    const isSelected = selectedChapters.has(item.id);
    const downloadStatus = getChapterDownloadStatus(item.id);
    const hasReadingProgress = readingHistory?.lastChapterId === item.id;
    const readingPage = readingHistory?.lastPage || 0;
    
    return (
      <ChapterCard 
        item={item}
        isSelected={isSelected}
        isActive={isActive}
        hasReadingProgress={hasReadingProgress}
        readingPage={readingPage}
        downloadStatus={downloadStatus}
        onPress={handleCardPress}
        selectionMode={selectionMode}
        onSingleDownload={handleSingleDownload}
      />
    );
  }, [currentChapterId, selectedChapters, getChapterDownloadStatus, readingHistory, handleCardPress, selectionMode, handleSingleDownload]);

  return (
    <View style={styles.container}>
      <FlatList
        data={displayChapters}
        renderItem={renderChapterCard}
        keyExtractor={(item, index) => `${item.id}_${index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderListHeader}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={10}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLeftSelection: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  headerTitleDark: {
    color: '#fff',
  },
  selectedCount: {
    fontSize: 14,
    color: '#6200EE',
    fontWeight: '500',
    marginLeft: 12,
  },
  selectedCountVertical: {
    fontSize: 12,
    color: '#6200EE',
    fontWeight: '500',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerActionButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
  },
  headerActionButtonText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  headerDownloadButton: {
    backgroundColor: '#6200EE',
  },
  headerDownloadButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  headerCancelButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  headerRangeButton: {
    backgroundColor: '#ff9800',
  },
  headerRangeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#6200EE',
  },
  tabText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#6200EE',
    fontWeight: '600',
  },
  listContent: {
    padding: 12,
  },
  chapterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chapterCardDark: {
    backgroundColor: '#1e1e1e',
    borderColor: '#333',
  },
  chapterCardActive: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196F3',
  },
  chapterCardSelected: {
    backgroundColor: '#f3e5f5',
    borderColor: '#6200EE',
  },
  checkboxContainer: {
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  checkboxSelected: {
    backgroundColor: '#6200EE',
    borderColor: '#6200EE',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  chapterInfo: {
    flex: 1,
    marginRight: 12,
  },
  chapterTitle: {
    fontSize: 15,
    color: '#000',
    marginBottom: 6,
    lineHeight: 20,
  },
  chapterTitleDark: {
    color: '#fff',
  },
  chapterTitleActive: {
    color: '#2196F3',
    fontWeight: '600',
  },
  chapterTime: {
    fontSize: 12,
    color: '#999',
  },
  chapterTimeDark: {
    color: '#666',
  },
  chapterActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  readBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    backgroundColor: '#e8f5e9',
    marginRight: 4,
  },
  readBadgeText: {
    fontSize: 10,
    color: '#4caf50',
    fontWeight: '600',
  },
  downloadedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#e3f2fd',
    marginRight: 4,
  },
  downloadedBadgeText: {
    fontSize: 11,
    color: '#2196F3',
    fontWeight: '500',
  },
  downloadActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  downloadingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#e8f5e9',
  },
  downloadingText: {
    fontSize: 12,
    color: '#4caf50',
    fontWeight: '600',
  },
  pauseButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#ff9800',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseButtonText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  resumeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#4caf50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resumeButtonText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  pausedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#fff3e0',
  },
  pausedText: {
    fontSize: 11,
    color: '#ff9800',
    fontWeight: '500',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#f5f5f5',
    marginRight: 4,
  },
  pendingText: {
    fontSize: 11,
    color: '#999',
    fontWeight: '500',
    marginLeft: 4,
  },
  failedBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#ff9800',
    justifyContent: 'center',
    alignItems: 'center',
  },
  failedText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  arrowIcon: {
    fontSize: 24,
    color: '#ccc',
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4caf50',
  },
  downloadButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#6200EE',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#6200EE',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  downloadButtonText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  rangeContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  rangeTitle: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
    marginBottom: 8,
  },
  rangeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rangeChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  rangeChipActive: {
    backgroundColor: '#6200EE',
    borderColor: '#6200EE',
  },
  rangeChipText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  rangeChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default ChapterList;
