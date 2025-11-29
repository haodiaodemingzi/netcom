import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import ComicCard from '../../components/ComicCard';
import { 
  getHotComics, 
  getLatestComics,
  getAvailableSources,
  getCategories,
  getComicsByCategory
} from '../../services/api';
import { getCurrentSource, setCurrentSource } from '../../services/storage';
import downloadManager from '../../services/downloadManager';

const HomeScreen = () => {
  const router = useRouter();
  const [comics, setComics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('hot');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [currentSource, setCurrentSourceState] = useState('xmanhua');
  const [sources, setSources] = useState({});
  const [categories, setCategories] = useState([
    { id: 'hot', name: '热门' },
    { id: 'latest', name: '最新' },
  ]);
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [downloadCount, setDownloadCount] = useState(0);

  useEffect(() => {
    loadInitialData();
    
    // 监听下载状态更新下载数量
    const unsubscribe = downloadManager.subscribe((state) => {
      setDownloadCount(state.downloadedChapters.length);
    });
    
    // 初始化下载数量
    setDownloadCount(downloadManager.downloadedChapters.size);
    
    return () => unsubscribe();
  }, []);

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
      const sourcesData = await getAvailableSources();
      const savedSource = await getCurrentSource();
      
      setSources(sourcesData);
      
      // 确保有有效的数据源，默认使用xmanhua
      const validSource = savedSource && sourcesData[savedSource] ? savedSource : 'xmanhua';
      // 如果保存的数据源不存在，保存xmanhua为默认
      if (!savedSource || !sourcesData[savedSource]) {
        await setCurrentSource('xmanhua');
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
      setCurrentSourceState('xmanhua');
      setInitialized(true);
    }
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
      <Text style={styles.headerTitle}>漫画阅读器</Text>
      <View style={styles.headerButtons}>
        <TouchableOpacity 
          onPress={() => router.push('/downloads')}
          style={styles.downloadButton}
        >
          <Text style={styles.downloadButtonIcon}>📦</Text>
          {downloadCount > 0 && (
            <View style={styles.downloadBadge}>
              <Text style={styles.downloadBadgeText}>{downloadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setShowSourceMenu(!showSourceMenu)}
          style={styles.sourceButton}
        >
          <Text style={styles.sourceButtonText}>
            {sources[currentSource]?.name || '数据源'} ▼
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCategories = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.categoriesContainer}
      contentContainerStyle={styles.categoriesContent}
    >
      {categories.map((category) => (
        <TouchableOpacity
          key={category.id}
          style={[
            styles.categoryButton,
            selectedCategory === category.id && 
              styles.categoryButtonActive,
          ]}
          onPress={() => handleCategoryPress(category.id)}
        >
          <Text
            style={[
              styles.categoryText,
              selectedCategory === category.id && 
                styles.categoryTextActive,
            ]}
          >
            {category.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderItem = ({ item }) => (
    <View style={styles.cardWrapper}>
      <ComicCard comic={item} />
    </View>
  );

  const renderLoadingSkeleton = () => (
    <View style={styles.skeletonContainer}>
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <View key={item} style={styles.skeletonCard}>
          <View style={styles.skeletonImage} />
          <View style={styles.skeletonTitle} />
          <View style={styles.skeletonSubtitle} />
        </View>
      ))}
    </View>
  );

  const renderFooter = () => {
    if (!loading || comics.length === 0) return null;
    
    return (
      <View style={styles.footerLoading}>
        <ActivityIndicator size="small" color="#6200EE" />
        <Text style={styles.footerText}>加载中...</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      {renderHeader()}
      
      {showSourceMenu && (
        <View style={styles.sourceMenu}>
          {Object.entries(sources).map(([key, source]) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.sourceMenuItem,
                currentSource === key && styles.sourceMenuItemActive,
              ]}
              onPress={() => handleSourceChange(key)}
            >
              <Text style={[
                styles.sourceMenuText,
                currentSource === key && styles.sourceMenuTextActive,
              ]}>
                {source.name}
              </Text>
              {source.description && (
                <Text style={styles.sourceMenuDesc}>
                  {source.description}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
      
      {renderCategories()}
      
      {loading && comics.length === 0 && !refreshing ? (
        renderLoadingSkeleton()
      ) : (
        <FlatList
          data={comics}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          numColumns={2}
          contentContainerStyle={styles.listContent}
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
            !loading && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>暂无漫画</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  sourceButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
  },
  sourceButtonText: {
    fontSize: 14,
    color: '#666',
  },
  sourceMenu: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 8,
  },
  sourceMenuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sourceMenuItemActive: {
    backgroundColor: '#f0f0f0',
  },
  sourceMenuText: {
    fontSize: 16,
    color: '#000',
    marginBottom: 4,
  },
  sourceMenuTextActive: {
    color: '#6200EE',
    fontWeight: '600',
  },
  sourceMenuDesc: {
    fontSize: 12,
    color: '#999',
  },
  categoriesContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  categoriesContent: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    paddingBottom: 20,
    alignItems: 'center',
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 4,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  categoryButtonActive: {
    backgroundColor: '#6200EE',
  },
  categoryText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 20,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  categoryTextActive: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  listContent: {
    padding: 4,
  },
  cardWrapper: {
    width: '50%',
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
