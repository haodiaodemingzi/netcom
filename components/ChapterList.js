import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

const ChapterList = ({ 
  chapters, 
  onChapterPress, 
  currentChapterId,
  darkMode = false 
}) => {
  const [sortOrder, setSortOrder] = useState('asc');

  const sortedChapters = [...chapters].sort((a, b) => {
    return sortOrder === 'asc' 
      ? a.order - b.order 
      : b.order - a.order;
  });

  const toggleSort = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  const renderChapter = ({ item }) => {
    const isActive = item.id === currentChapterId;
    
    return (
      <TouchableOpacity
        style={[
          styles.chapterItem,
          darkMode && styles.chapterItemDark,
          isActive && styles.chapterItemActive,
        ]}
        onPress={() => onChapterPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.chapterInfo}>
          <Text 
            style={[
              styles.chapterTitle,
              darkMode && styles.chapterTitleDark,
              isActive && styles.chapterTitleActive,
            ]}
            numberOfLines={1}
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
        {item.isRead && (
          <View style={styles.readBadge}>
            <Text style={styles.readBadgeText}>已读</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text 
          style={[
            styles.headerTitle,
            darkMode && styles.headerTitleDark,
          ]}
        >
          章节列表 ({chapters.length})
        </Text>
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
            {sortOrder === 'asc' ? '正序 ↓' : '倒序 ↑'}
          </Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={sortedChapters}
        renderItem={renderChapter}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
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
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  headerTitleDark: {
    color: '#fff',
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#f5f5f5',
  },
  sortText: {
    fontSize: 14,
    color: '#666',
  },
  sortTextDark: {
    color: '#aaa',
  },
  chapterItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  chapterItemDark: {
    backgroundColor: '#1e1e1e',
    borderBottomColor: '#333',
  },
  chapterItemActive: {
    backgroundColor: '#e3f2fd',
  },
  chapterInfo: {
    flex: 1,
  },
  chapterTitle: {
    fontSize: 14,
    color: '#000',
    marginBottom: 4,
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
  readBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#e0e0e0',
  },
  readBadgeText: {
    fontSize: 10,
    color: '#666',
  },
});

export default ChapterList;
