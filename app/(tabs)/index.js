import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import ComicCard from '../../components/ComicCard';
import SearchBar from '../../components/SearchBar';
import FullScreenLoader from '../../components/FullScreenLoader';
import InlineSkeleton from '../../components/InlineSkeleton';
import { 
  getHotComics, 
  getLatestComics,
  getAvailableSources,
  getCategories,
  getComicsByCategory,
  searchComics,
} from '../../services/api';
import { getCurrentSource, setCurrentSource, getSettings } from '../../services/storage';
import { getInstalledSourcesByCategory } from '../../services/sourceFilter';
import downloadManager from '../../services/downloadManager';
import eventBus, { EVENTS } from '../../services/eventBus';

const HomeScreen = () => {
  const router = useRouter();
  const [comics, setComics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('hot');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [currentSource, setCurrentSourceState] = useState(null);
  const [sources, setSources] = useState({});
  const [categories, setCategories] = useState([
    { id: 'hot', name: '热门' },
    { id: 'latest', name: '最新' },
  ]);
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [downloadCount, setDownloadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [viewMode, setViewMode] = useState('card');
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [contentReady, setContentReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadInitialData();
    loadViewMode();
    
    // 监听下载状态更新下载数量
    const unsubscribe = downloadManager.subscribe((state) => {
      setDownloadCount(state.downloadedChapters.length);
    });
    
    // 初始化下载数量
    setDownloadCount(downloadManager.downloadedChapters.size);
    
    // 监听缓存清除事件
    const unsubscribeCacheClear = eventBus.on(EVENTS.CACHE_CLEARED, () => {
      // 清空当前数据，重新加载
      setComics([]);
      setPage(1);
      setHasMore(true);
      setInitialized(false);
      loadInitialData();
    });
    
    // 监听数据源变化事件
    const unsubscribeSourceChange = eventBus.on(EVENTS.SOURCE_CHANGED, () => {
      setPage(1);
      setComics([]);
      loadComics(true);
    });
    
    // 监听数据源安装/卸载事件，重新加载数据源列表
    const unsubscribeSourceInstall = eventBus.on(EVENTS.SOURCE_INSTALLED, ({ category }) => {
      if (category === 'comic') {
        loadInitialData();
      }
    });
    
    const unsubscribeSourceUninstall = eventBus.on(EVENTS.SOURCE_UNINSTALLED, () => {
      loadInitialData();
    });
    
    return () => {
      unsubscribe();
      unsubscribeCacheClear();
      unsubscribeSourceChange();
      unsubscribeSourceInstall();
      unsubscribeSourceUninstall();
    };
  }, []);

  // 页面获得焦点时只检查数据源状态，不刷新数据（已有数据时使用缓存）
  useFocusEffect(
    useCallback(() => {
      // 不再每次切换Tab都重新加载数据源
      // 用户下拉时才刷新数据
    }, [])
  );

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

  // 分类或数据源变化时，重置并加载第一页
  useEffect(() => {
    if (initialized && currentSource) {
      setPage(1);
      setComics([]);
      loadComics(true);
    }
  }, [selectedCategory, currentSource, initialized]);

  // 页码变化时，加载更多数据
  useEffect(() => {
    if (initialized && currentSource && page > 1) {
      loadComics(false);
    }
  }, [page]);

  const loadInitialData = async () => {
    try {
      const allSourcesData = await getAvailableSources();
      const savedSource = await getCurrentSource();
      
      // 只显示已安装的数据源
      const installedIds = await getInstalledSourcesByCategory('comic');
      const installedSources = {};
      
      for (const [id, source] of Object.entries(allSourcesData)) {
        if (installedIds.includes(id)) {
          installedSources[id] = source;
        }
      }
      
      setSources(installedSources);
      
      // 获取第一个可用的数据源作为默认值
      const firstAvailableSource = Object.keys(installedSources)[0];
      
      // 确保有有效的数据源
      const validSource = savedSource && installedSources[savedSource] && installedIds.includes(savedSource) 
        ? savedSource 
        : firstAvailableSource;
      
      // 如果没有保存的数据源，保存当前选择的为默认
      if (!savedSource || !installedSources[savedSource] || !installedIds.includes(savedSource)) {
        if (validSource) {
          await setCurrentSource(validSource);
        }
      }
      setCurrentSourceState(validSource);
      
      // 加载分类列表
      try {
        const categoriesData = await getCategories(validSource);
        if (categoriesData && categoriesData.categories && categoriesData.categories.length > 0) {
          // 添加热门和最新到分类列表前面
          const allCategories = [
            ...categoriesData.categories
          ];
          setCategories(allCategories);
        }
      } catch (error) {
        // 静默失败
      }
      
      setInitialized(true);
    } catch (error) {
      // 出错时尝试获取任何可用的数据源
      const fallbackSource = Object.keys(sources)[0];
      if (fallbackSource) {
        setCurrentSourceState(fallbackSource);
        await setCurrentSource(fallbackSource);
      }
      setInitialized(true);
    }
  };

  // 搜索漫画
  const handleSearch = async (query) => {
    if (!query.trim()) {
      setSearchQuery('');
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    try {
      setIsSearching(true);
      const data = await searchComics(query, 1, 50, currentSource);
      setSearchResults(data.comics || []);
    } catch (error) {
      console.error('搜索失败:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // 清除搜索
  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
  };

const loadComics = async (isRefresh = false) => {
    if (loading) return;

    setLoading(true);
    const currentPage = isRefresh ? 1 : page;

    try {
      let data;
      if (selectedCategory === 'hot') {
        data = await getHotComics(currentPage, 20, currentSource);
      } else if (selectedCategory === 'latest') {
        data = await getLatestComics(currentPage, 20, currentSource);
      } else {
        // 使用分类接口
        data = await getComicsByCategory(selectedCategory, currentPage, 20, currentSource);
      }

      if (isRefresh) {
        setComics(data.comics || []);
        setPage(1);
      } else {
        setComics([...comics, ...(data.comics || [])]);
      }

      setHasMore(data.hasMore || false);
    } catch (error) {
      setComics([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadComics(true);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      setPage(prevPage => prevPage + 1);
    }
  };

  const handleCategoryPress = (categoryId) => {
    if (categoryId === selectedCategory) return;
    setSelectedCategory(categoryId);
  };

  const handleSourceChange = async (sourceId) => {
    if (sourceId === currentSource) {
      setShowSourceMenu(false);
      return;
    }
    
    setShowSourceMenu(false);
    setCurrentSourceState(sourceId);
    await setCurrentSource(sourceId);
    
    // 重新加载该数据源的分类列表
    try {
      const categoriesData = await getCategories(sourceId);
      if (categoriesData && categoriesData.categories && categoriesData.categories.length > 0) {
        setCategories(categoriesData.categories);
        // 重置到第一个分类
        setSelectedCategory(categoriesData.categories[0]?.id || 'hot');
      } else {
        // 如果获取不到分类，使用默认分类
        setCategories([
          { id: 'hot', name: '热门' },
          { id: 'latest', name: '最新' },
        ]);
        setSelectedCategory('hot');
      }
    } catch (error) {
      console.error('获取分类失败:', error);
      // 出错时使用默认分类
      setCategories([
        { id: 'hot', name: '热门' },
        { id: 'latest', name: '最新' },
      ]);
      setSelectedCategory('hot');
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      {/* 标题 - 搜索栏 - 数据源 - 下载 */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>漫画</Text>
        
        <SearchBar
            value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            if (!text.trim()) {
              clearSearch();
            }
          }}
            onSubmitEditing={() => handleSearch(searchQuery)}
          placeholder="搜索漫画..."
          />
        
        <TouchableOpacity 
          style={styles.sourceButton}
          onPress={() => setShowSourceMenu(true)}
        >
          <Text style={styles.sourceText}>
            {sources[currentSource]?.name || '数据源'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* 搜索结果提示 */}
      {searchQuery.length > 0 && (
        <Text style={styles.infoText}>
          {isSearching ? '搜索中...' : `找到 ${searchResults.length} 本漫画`}
        </Text>
      )}
    </View>
  );

  const renderCategories = () => {
    const displayCategories = showAllCategories ? categories : categories.slice(0, 8);
    const hasMore = categories.length > 8;

    return (
      <View style={styles.categoryBar}>
        <View style={styles.categoryContent}>
          {displayCategories.map((category, index) => (
            <TouchableOpacity
              key={`${category.id || ''}-${index}`}
              style={[
                styles.categoryChip,
                selectedCategory === category.id && styles.categoryChipActive,
              ]}
              onPress={() => handleCategoryPress(category.id)}
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
          {hasMore && (
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
    );
  };

  const renderItem = ({ item }) => (
    <View style={[
      styles.cardWrapper,
      viewMode === 'list' && styles.cardWrapperList
    ]}>
      <ComicCard comic={item} viewMode={viewMode} />
    </View>
  );

  const renderLoadingSkeleton = () => (
    <FullScreenLoader variant="list" />
  );

  const renderFooter = () => {
    if (!loading || comics.length === 0) return null;
    
    return (
      <View style={styles.footerLoading}>
        <InlineSkeleton size={18} />
        <Text style={styles.footerText}>加载中...</Text>
      </View>
    );
  };

  // 显示的数据:搜索结果或分类漫画
  const displayComics = searchQuery.trim() ? searchResults : comics;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      {renderHeader()}
      
      {/* 数据源选择器Modal */}
      <Modal
        visible={showSourceMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSourceMenu(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSourceMenu(false)}
        >
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>选择数据源</Text>
              <TouchableOpacity onPress={() => setShowSourceMenu(false)}>
                <Text style={styles.pickerClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {Object.entries(sources).map(([key, source]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.pickerItem,
                  currentSource === key && styles.pickerItemActive
                ]}
                onPress={() => handleSourceChange(key)}
              >
                <Text style={[
                  styles.pickerItemText,
                  currentSource === key && styles.pickerItemTextActive
                ]}>
                  {source.name}
                </Text>
                {currentSource === key && (
                  <Text style={styles.pickerCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
      
      {!searchQuery.trim() && renderCategories()}
      
      {(loading || isSearching) && displayComics.length === 0 && !refreshing ? (
        renderLoadingSkeleton()
      ) : (
        <FlatList
          key={viewMode}
          data={displayComics}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          numColumns={viewMode === 'list' ? 1 : 3}
          columnWrapperStyle={viewMode === 'list' ? null : styles.columnWrapper}
          contentContainerStyle={[
            styles.listContent,
            viewMode === 'list' && styles.listContentList
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#6200EE']}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            !loading && !isSearching && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {searchQuery.trim() ? '未找到相关漫画' : '暂无漫画'}
                </Text>
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    minWidth: 50,
  },
  sourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    height: 38,
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
  downloadButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 18,
    position: 'relative',
  },
  downloadButtonIcon: {
    fontSize: 20,
  },
  downloadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  downloadBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
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
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 16,
    backgroundColor: '#f2f3f5',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ededed',
  },
  categoryChipActive: {
    backgroundColor: '#efe7ff',
    borderColor: '#d8c7ff',
  },
  categoryText: {
    fontSize: 12,
    color: '#666',
  },
  categoryTextActive: {
    color: '#5a2fd6',
    fontWeight: '600',
  },
  moreButton: {
    paddingHorizontal: 6,
    height: 30,
    borderRadius: 16,
    backgroundColor: 'transparent',
    justifyContent: 'center',
  },
  moreButtonText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 24,
    padding: 2,
  },
  listContentList: {
    padding: 0,
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
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  footerLoading: {
    paddingVertical: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#999',
  },
  skeletonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 4,
  },
  skeletonCard: {
    width: '50%',
    padding: 4,
  },
  skeletonImage: {
    width: '100%',
    height: 240,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    marginBottom: 8,
  },
  skeletonTitle: {
    width: '80%',
    height: 16,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 6,
  },
  skeletonSubtitle: {
    width: '60%',
    height: 14,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
  },
});

export default HomeScreen;
