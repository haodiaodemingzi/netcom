import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';

const ChapterList = ({ 
  chapters, 
  onChapterPress, 
  currentChapterId,
  darkMode = false,
  onDownloadChapters
}) => {
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedChapters, setSelectedChapters] = useState(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  const sortedChapters = [...chapters].sort((a, b) => {
    return sortOrder === 'asc' 
      ? a.order - b.order 
      : b.order - a.order;
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

  const chapterGroups = groupChapters(sortedChapters);

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
    const allChapterIds = sortedChapters.map(c => c.id);
    if (selectedChapters.size === allChapterIds.length) {
      setSelectedChapters(new Set());
    } else {
      setSelectedChapters(new Set(allChapterIds));
    }
  };

  const handleDownloadSelected = () => {
    if (selectedChapters.size === 0) {
      Alert.alert('提示', '请至少选择一个章节');
      return;
    }
    
    const selectedChaptersList = sortedChapters.filter(c => selectedChapters.has(c.id));
    
    if (onDownloadChapters) {
      onDownloadChapters(selectedChaptersList);
    } else {
      Alert.alert('提示', `已选择 ${selectedChapters.size} 个章节`);
    }
    
    setSelectedChapters(new Set());
    setSelectionMode(false);
  };

  const toggleGroupSelection = (group) => {
    const groupChapterIds = group.chapters.map(c => c.id);
    const allSelected = groupChapterIds.every(id => selectedChapters.has(id));
    
    const newSelected = new Set(selectedChapters);
    
    if (allSelected) {
      groupChapterIds.forEach(id => newSelected.delete(id));
    } else {
      groupChapterIds.forEach(id => newSelected.add(id));
    }
    
    setSelectedChapters(newSelected);
  };

  const renderGroup = ({ item: group }) => {
    const groupChapterIds = group.chapters.map(c => c.id);
    const selectedInGroup = groupChapterIds.filter(id => selectedChapters.has(id)).length;
    const allSelected = selectedInGroup === groupChapterIds.length;
    
    return (
      <View style={styles.groupContainer}>
        <View style={styles.groupHeader}>
          <View style={styles.groupHeaderLeft}>
            <Text style={styles.groupTitle}>{group.name}</Text>
            <Text style={styles.groupCount}>({group.chapters.length})</Text>
          </View>
          {selectionMode && (
            <TouchableOpacity
              style={styles.groupSelectButton}
              onPress={() => toggleGroupSelection(group)}
            >
              <Text style={styles.groupSelectText}>
                {allSelected ? '取消' : '全选'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {group.chapters.map((chapter) => (
          <View key={chapter.id}>
            {renderChapterCard(chapter)}
          </View>
        ))}
      </View>
    );
  };

  const renderChapterCard = (item) => {
    const isActive = item.id === currentChapterId;
    const isSelected = selectedChapters.has(item.id);
    
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
          <Text style={styles.arrowIcon}>›</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text 
            style={[
              styles.headerTitle,
              darkMode && styles.headerTitleDark,
            ]}
          >
            章节列表 ({chapters.length})
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
                  {selectedChapters.size === sortedChapters.length && sortedChapters.length > 0 ? '取消全选' : '全选'}
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
              {sortOrder === 'asc' ? '↓' : '↑'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <FlatList
        data={chapterGroups}
        renderItem={renderGroup}
        keyExtractor={(item, index) => `group-${index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
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
    gap: 12,
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
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
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
  listContent: {
    padding: 12,
  },
  groupContainer: {
    marginBottom: 16,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  groupCount: {
    fontSize: 13,
    color: '#999',
    marginLeft: 6,
  },
  groupSelectButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#6200EE',
    borderRadius: 4,
  },
  groupSelectText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
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
    gap: 8,
  },
  readBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#e8f5e9',
  },
  readBadgeText: {
    fontSize: 11,
    color: '#4caf50',
    fontWeight: '500',
  },
  arrowIcon: {
    fontSize: 24,
    color: '#ccc',
  },
});

export default ChapterList;
