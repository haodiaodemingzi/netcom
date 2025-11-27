import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import downloadManager from '../services/downloadManager';

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

  useEffect(() => {
    const unsubscribe = downloadManager.subscribe((state) => {
      setDownloadState(state);
    });
    return unsubscribe;
  }, []);

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
  
  // 根据当前标签页获取显示的章节
  const displayChapters = activeTab === 'volume' 
    ? (volumeChapters?.chapters || [])
    : (normalChapters?.chapters || []);
  
  // 判断是否有卷分类
  const hasVolumes = volumeChapters && volumeChapters.chapters && volumeChapters.chapters.length > 0;

  const toggleSort = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    if (selectionMode) {
      setSelectedChapters(new Set());
    }
  };

  const toggleChapterSelection = (chapterId) => {
    const newSelected = new Set(selectedChapters);
    if (newSelected.has(chapterId)) {
      newSelected.delete(chapterId);
    } else {
      newSelected.add(chapterId);
    }
    setSelectedChapters(newSelected);
  };

  const selectAll = () => {
    const allChapterIds = displayChapters.map(c => c.id);
    if (selectedChapters.size === allChapterIds.length && allChapterIds.length > 0) {
      setSelectedChapters(new Set());
    } else {
      setSelectedChapters(new Set(allChapterIds));
    }
  };

  const handleDownloadSelected = async () => {
    if (selectedChapters.size === 0) {
      Alert.alert('提示', '请至少选择一个章节');
      return;
    }
    
    const selectedChaptersList = displayChapters.filter(c => selectedChapters.has(c.id));
    
    await downloadManager.downloadChapters(
      comicId,
      comicTitle,
      selectedChaptersList,
      source
    );
    
    Alert.alert('成功', `已添加 ${selectedChapters.size} 个章节到下载队列`);
    
    setSelectedChapters(new Set());
    setSelectionMode(false);
  };

  const getChapterDownloadStatus = (chapterId) => {
    if (!downloadState) return null;
    
    if (downloadState.downloadedChapters.includes(chapterId)) {
      return 'completed';
    }
    
    const task = downloadState.queue.find(t => t.chapterId === chapterId);
    if (task) {
      return {
        status: task.status,
        progress: task.progress
      };
    }
    
    return null;
  };

  const renderChapterCard = (item) => {
    const isActive = item.id === currentChapterId;
    const isSelected = selectedChapters.has(item.id);
    const downloadStatus = getChapterDownloadStatus(item.id);
    
    return (
      <TouchableOpacity
        style={[
          styles.chapterCard,
          darkMode && styles.chapterCardDark,
          isActive && styles.chapterCardActive,
          isSelected && styles.chapterCardSelected,
        ]}
        onPress={() => {
          if (selectionMode) {
            toggleChapterSelection(item.id);
          } else {
            onChapterPress(item);
          }
        }}
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
          {item.isRead && (
            <View style={styles.readBadge}>
              <Text style={styles.readBadgeText}>已读</Text>
            </View>
          )}
          
          {downloadStatus === 'completed' && (
            <View style={styles.downloadedBadge}>
              <Text style={styles.downloadedBadgeText}>✓ 已下载</Text>
            </View>
          )}
          
          {downloadStatus?.status === 'downloading' && (
            <View style={styles.downloadingBadge}>
              <ActivityIndicator size="small" color="#2196F3" />
              <Text style={styles.downloadingText}>{downloadStatus.progress}%</Text>
            </View>
          )}
          
          {downloadStatus?.status === 'pending' && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingText}>等待中</Text>
            </View>
          )}
          
          {downloadStatus?.status === 'failed' && (
            <TouchableOpacity 
              style={styles.failedBadge}
              onPress={() => downloadManager.retryFailed()}
            >
              <Text style={styles.failedText}>❗ 重试</Text>
            </TouchableOpacity>
          )}
          
          {!selectionMode && <Text style={styles.arrowIcon}>›</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  const renderListHeader = () => (
    <View>
      {ListHeaderComponent ? ListHeaderComponent() : null}
      
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text 
            style={[
              styles.headerTitle,
              darkMode && styles.headerTitleDark,
            ]}
          >
            章节列表 ({displayChapters.length})
          </Text>
          {selectionMode && (
            <Text style={styles.selectedCount}>
              已选 {selectedChapters.size}
            </Text>
          )}
        </View>
        
        <View style={styles.headerActions}>
          {selectionMode && (
            <>
              <TouchableOpacity 
                onPress={selectAll}
                style={styles.actionButton}
              >
                <Text style={styles.actionButtonText}>
                  {selectedChapters.size === displayChapters.length && displayChapters.length > 0 ? '取消全选' : '全选'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleDownloadSelected}
                style={[styles.actionButton, styles.downloadButton]}
              >
                <Text style={styles.downloadButtonText}>下载</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity 
            onPress={toggleSelectionMode}
            style={[styles.actionButton, selectionMode && styles.cancelButton]}
          >
            <Text style={[
              styles.actionButtonText,
              selectionMode && styles.cancelButtonText
            ]}>
              {selectionMode ? '取消' : '批量下载'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={toggleSort}
            style={styles.sortButton}
          >
            <Text 
              style={[
                styles.sortText,
                darkMode && styles.sortTextDark,
              ]}
            >
              {sortOrder === 'desc' ? '↓' : '↑'}
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
            onPress={() => setActiveTab('volume')}
          >
            <Text style={[
              styles.tabText,
              activeTab === 'volume' && styles.tabTextActive
            ]}>
              卷 ({volumeChapters.chapters.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'chapter' && styles.tabActive
            ]}
            onPress={() => setActiveTab('chapter')}
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
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={displayChapters}
        renderItem={({ item }) => renderChapterCard(item)}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderListHeader}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
    marginLeft: 8,
  },
  actionButtonText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  downloadButton: {
    backgroundColor: '#6200EE',
  },
  downloadButtonText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cancelButtonText: {
    color: '#666',
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
  },
  sortText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  sortTextDark: {
    color: '#aaa',
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
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#e8f5e9',
    marginRight: 4,
  },
  readBadgeText: {
    fontSize: 11,
    color: '#4caf50',
    fontWeight: '500',
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
  downloadingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#e3f2fd',
    marginRight: 4,
  },
  downloadingText: {
    fontSize: 11,
    color: '#2196F3',
    fontWeight: '500',
    marginLeft: 4,
  },
  pendingBadge: {
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
  },
  failedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#ffebee',
    marginRight: 4,
  },
  failedText: {
    fontSize: 11,
    color: '#f44336',
    fontWeight: '500',
  },
  arrowIcon: {
    fontSize: 24,
    color: '#ccc',
  },
});

export default ChapterList;
