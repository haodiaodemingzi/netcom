import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import BookCard from '../../components/BookCard';
import SearchBar from '../../components/SearchBar';
import {
  getEbookCategories,
  getEbooksByCategory,
  getEbookSources,
} from '../../services/api';
import { getSettings } from '../../services/storage';
import { getInstalledSourcesByCategory } from '../../services/sourceFilter';

const EbookTabScreen = () => {
  const [selectedSource, setSelectedSource] = useState('kanunu8');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [books, setBooks] = useState([]);
  const [sources, setSources] = useState({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [viewMode, setViewMode] = useState('card');

  // 加载设置
  useEffect(() => {
    loadViewMode();
  }, []);

  // 监听设置变化
  useEffect(() => {
    const interval = setInterval(() => {
      loadViewMode();
    }, 1000); // 每秒检查一次设置变化

    return () => clearInterval(interval);
  }, []);

  const loadViewMode = async () => {
    try {
      const settings = await getSettings();
      if (settings.viewMode) {
        setViewMode(settings.viewMode);
      }
    } catch (error) {
      console.error('加载视图模式设置失败:', error);
    }
  };

  // 加载数据源列表
  useEffect(() => {
    loadSources();
  }, []);

  // 页面获得焦点时只同步数据源（安装/卸载后更新），不刷新数据
  useFocusEffect(
    useCallback(() => {
      // 只检查数据源安装状态，不重新加载数据
      // 用户下拉时才刷新
    }, [])
  );

  // 加载分类列表
  useEffect(() => {
    if (selectedSource) {
      loadCategories();
    }
  }, [selectedSource]);

  // 加载书籍列表
  useEffect(() => {
    if (selectedCategory) {
      loadBooks(true);
    }
  }, [selectedCategory]);

  // 不支持元数据搜索，直接使用当前列表
  const filteredBooks = books;

  const loadSources = async () => {
    try {
      const allSourcesData = await getEbookSources();
      const allSources = allSourcesData.sources || {};
      
      // 只显示已安装的数据源
      const installedIds = await getInstalledSourcesByCategory('ebook');
      const installedSources = {};
      
      for (const [id, source] of Object.entries(allSources)) {
        if (installedIds.includes(id)) {
          installedSources[id] = source;
        }
      }
      
      setSources(installedSources);
    } catch (error) {
      console.error('加载数据源失败:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await getEbookCategories(selectedSource);
      // 过滤掉作家相关分类
      const filteredCategories = ( data.categories?.filter(cat => 
        cat.type !== 'writer' && 
        !cat.id.startsWith('writer_') &&
        cat.group && !cat.group.includes('作家')
      ) || []);
      
      setCategories(filteredCategories);
      // 默认选择第一个非作家分类
      if (filteredCategories.length > 0) {
        setSelectedCategory(filteredCategories[0].id);
      }
    } catch (error) {
      console.error('加载分类失败:', error);
      setCategories([]);
    }
  };

  const loadBooks = async (reset = false) => {
    if (loading) return;
    
    try {
      setLoading(true);
      const currentPage = reset ? 1 : page;
      const data = await getEbooksByCategory(
        selectedCategory,
        currentPage,
        20,
        selectedSource
      );
      
      if (reset) {
        setBooks(data.books || []);
        setPage(1);
      } else {
        setBooks(prev => [...prev, ...(data.books || [])]);
      }
      
      setHasMore(data.hasMore || false);
      if (!reset) {
        setPage(prev => prev + 1);
      }
    } catch (error) {
      console.error('加载书籍失败:', error);
      if (reset) {
        setBooks([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadBooks(true);
    setRefreshing(false);
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      loadBooks(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 顶部导航栏 - 一行布局 */}
      <View style={styles.header}>
        {/* 标题 - 搜索栏 - 数据源 */}
        <View style={styles.headerRow}>
          <Text style={styles.title}>电子书</Text>
          
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={"当前数据源不支持搜索"}
            editable={true}
          />
          
          <TouchableOpacity 
            style={styles.sourceButton}
            onPress={() => setShowSourcePicker(true)}
          >
            <Text style={styles.sourceText}>
              {sources[selectedSource]?.name || '努努书坊'}
            </Text>
            <Text style={styles.sourceArrow}>▼</Text>
          </TouchableOpacity>
        </View>
        {searchQuery.trim().length > 0 && (
          <Text style={styles.infoText}>当前数据源不支持搜索</Text>
        )}
      </View>

      {/* 数据源选择器 */}
      <Modal
        visible={showSourcePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSourcePicker(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSourcePicker(false)}
        >
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>选择数据源</Text>
              <TouchableOpacity onPress={() => setShowSourcePicker(false)}>
                <Text style={styles.pickerClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {Object.entries(sources).map(([key, source]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.pickerItem,
                  selectedSource === key && styles.pickerItemActive
                ]}
                onPress={() => {
                  setSelectedSource(key);
                  setShowSourcePicker(false);
                }}
              >
                <Text style={[
                  styles.pickerItemText,
                  selectedSource === key && styles.pickerItemTextActive
                ]}>
                  {source.name}
                </Text>
                {selectedSource === key && (
                  <Text style={styles.pickerCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <View style={styles.categoryBar}>
        <View style={styles.categoryContent}>
          {(showAllCategories ? categories : categories.slice(0, 8)).map((category, index) => (
            <TouchableOpacity
              key={`${category.id || ''}-${index}`}
              style={[
                styles.categoryChip,
                selectedCategory === category.id && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(category.id)}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === category.id && styles.categoryTextActive,
                ]}
              >
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
          {categories.length > 8 && (
            <TouchableOpacity
              style={styles.moreButton}
              onPress={() => setShowAllCategories(!showAllCategories)}
            >
              <Text style={styles.moreButtonText}>
                {showAllCategories ? '收起' : '更多'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        key={viewMode}
        data={filteredBooks}
        keyExtractor={(item, index) => `${item.id || ''}-${index}`}
        renderItem={({ item }) => (
          <View style={[
            styles.cardWrapper,
            viewMode === 'list' && styles.cardWrapperList
          ]}>
            <BookCard book={item} viewMode={viewMode} />
          </View>
        )}
        numColumns={viewMode === 'list' ? 1 : 3}
        columnWrapperStyle={viewMode === 'list' ? null : styles.columnWrapper}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#6200EE']}
          />
        }
        onEndReached={searchQuery.trim() ? null : handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={() =>
          loading && !refreshing ? (
            <View style={styles.loadingFooter}>
              <ActivityIndicator size="small" color="#6200EE" />
            </View>
          ) : null
        }
        contentContainerStyle={[
          styles.listContent,
          viewMode === 'list' && styles.listContentList
        ]}
        ListEmptyComponent={() =>
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {searchQuery.trim() ? '未找到相关书籍' : '暂无电子书'}
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  header: {
    backgroundColor: '#fff',
    borderBottomColor: '#e0e0e0',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    minWidth: 60,
  },
  sourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    height: 38,
    minWidth: 90,
  },
  sourceText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
    marginRight: 4,
  },
  sourceArrow: {
    fontSize: 10,
    color: '#999',
  },
  infoText: {
    fontSize: 10,
    color: '#999',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '80%',
    maxWidth: 300,
    maxHeight: '70%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  pickerClose: {
    fontSize: 24,
    color: '#999',
    fontWeight: '300',
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pickerItemActive: {
    backgroundColor: '#f8f9fa',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#333',
  },
  pickerItemTextActive: {
    color: '#6200EE',
    fontWeight: '600',
  },
  pickerCheck: {
    fontSize: 18,
    color: '#6200EE',
    fontWeight: 'bold',
  },
  categoryBar: {
    backgroundColor: '#fff',
    borderBottomColor: '#e0e0e0',
    borderBottomWidth: 1,
  },
  categoryContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    minWidth: '22%',
    maxWidth: '48%',
    paddingHorizontal: 8,
    height: 34,
    borderRadius: 4,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  categoryChipActive: {
    backgroundColor: '#6200EE',
    borderColor: '#6200EE',
  },
  categoryText: {
    fontSize: 13,
    color: '#666',
  },
  categoryTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  moreButton: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    minWidth: '22%',
    maxWidth: '48%',
    paddingHorizontal: 8,
    height: 34,
    borderRadius: 4,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6200EE',
  },
  moreButtonText: {
    fontSize: 13,
    color: '#6200EE',
    fontWeight: '600',
  },
  listHeader: {
    width: '100%',
    paddingHorizontal: 12,
  },
  listContent: {
    paddingBottom: 24,
    padding: 2,
  },
  columnWrapper: {
    paddingHorizontal: 0,
  },
  cardWrapper: {
    width: '33.333%',
    padding: 2,
  },
  cardWrapperList: {
    width: '100%',
    paddingHorizontal: 0,
    paddingVertical: 0,
    marginBottom: 0,
  },
  listContentList: {
    padding: 0,
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  empty: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
  },
});

export default EbookTabScreen;

