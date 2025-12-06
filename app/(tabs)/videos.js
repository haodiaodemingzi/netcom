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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import VideoCard from '../../components/VideoCard';
import SearchBar from '../../components/SearchBar';
import {
  getSeriesList,
  getVideoCategories,
  getVideoSources,
  searchVideos,
  setCurrentVideoSource,
  getCurrentVideoSource,
} from '../../services/videoApi';
import { getSettings } from '../../services/storage';

const VideosTabScreen = () => {
  const router = useRouter();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('hot');
  const [selectedSource, setSelectedSource] = useState('thanju');
  const [sources, setSources] = useState({});
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [searchHasMore, setSearchHasMore] = useState(false);
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
    }, 1000);

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

  // 初始化加载
  useEffect(() => {
    loadInitialData();
  }, []);

  // 加载数据源
  useEffect(() => {
    loadSources();
  }, []);

  // 数据源加载完成后，加载分类
  useEffect(() => {
    if (selectedSource && Object.keys(sources).length > 0) {
      loadCategories();
    }
  }, [selectedSource, sources]);

  // 分类加载完成后，且已选择分类时，加载视频列表
  useEffect(() => {
    if (selectedCategory && selectedSource && !categoriesLoading) {
      setPage(1);
      setVideos([]);
      loadVideos(true);
    }
  }, [selectedCategory, selectedSource, categoriesLoading]);

  // 页码变化时，加载更多数据
  useEffect(() => {
    if (page > 1 && selectedCategory && selectedSource) {
      loadVideos(false);
    }
  }, [page]);

  const loadInitialData = async () => {
    const currentSource = getCurrentVideoSource();
    if (currentSource) {
      setSelectedSource(currentSource);
    }
  };

  const loadSources = async () => {
    try {
      const result = await getVideoSources();
      if (result.success) {
        const sourcesData = result.data || {};
        console.log('加载数据源成功:', sourcesData);
        setSources(sourcesData);
        // 如果没有当前源，设置默认源
        if (!sourcesData[selectedSource] && Object.keys(sourcesData).length > 0) {
          const firstSource = Object.keys(sourcesData)[0];
          console.log('设置默认数据源:', firstSource);
          setSelectedSource(firstSource);
          setCurrentVideoSource(firstSource);
        } else if (sourcesData[selectedSource]) {
          // 确保当前数据源已设置
          setCurrentVideoSource(selectedSource);
        }
      } else {
        console.error('加载数据源失败:', result.error);
      }
    } catch (error) {
      console.error('加载数据源失败:', error);
    }
  };

  const loadCategories = async (source = null) => {
    setCategoriesLoading(true);
    try {
      // 使用传入的 source 参数，如果没有则使用 selectedSource
      const sourceToUse = source || selectedSource || 'thanju';
      console.log('加载分类，使用数据源:', sourceToUse);
      const result = await getVideoCategories(sourceToUse);
      if (result.success) {
        const categoriesData = result.data || [];
        console.log('加载分类成功，数量:', categoriesData.length, categoriesData);
        setCategories(categoriesData);
        // 如果当前选中的分类不在列表中，选择第一个分类
        if (categoriesData.length > 0) {
          const currentCategoryExists = categoriesData.find(cat => cat.id === selectedCategory);
          if (!currentCategoryExists) {
            setSelectedCategory(categoriesData[0].id);
          }
        } else {
          // 如果没有分类，清空选择
          setSelectedCategory(null);
        }
      } else {
        console.error('加载分类失败:', result.error);
        // 如果加载失败，清空分类
        setCategories([]);
        setSelectedCategory(null);
      }
    } catch (error) {
      console.error('加载分类失败:', error);
      // 如果加载失败，清空分类
      setCategories([]);
      setSelectedCategory(null);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const loadVideos = async (reset = false) => {
    if (loading) return;

    try {
      setLoading(true);
      const result = await getSeriesList(selectedCategory, reset ? 1 : page, 20, selectedSource);
      
      if (result.success) {
        if (reset) {
          setVideos(result.data || []);
        } else {
          setVideos(prev => [...prev, ...(result.data || [])]);
        }
        setHasMore(result.hasMore || false);
      }
    } catch (error) {
      console.error('加载视频失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(1);
    setVideos([]);
    loadVideos(true);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
    }
  };

  const handleSearch = async (reset = true) => {
    if (!searchQuery.trim()) {
      setIsSearching(false);
      setSearchResults([]);
      setSearchPage(1);
      setSearchHasMore(false);
      return;
    }

    setIsSearching(true);
    setLoading(true);
    try {
      const currentPage = reset ? 1 : searchPage;
      const result = await searchVideos(searchQuery.trim(), currentPage, 20, selectedSource);
      if (result.success) {
        if (reset) {
          setSearchResults(result.data || []);
          setSearchPage(1);
        } else {
          setSearchResults(prev => [...prev, ...(result.data || [])]);
        }
        setSearchHasMore(result.hasMore || false);
        if (!reset) {
          setSearchPage(prev => prev + 1);
        }
      }
    } catch (error) {
      console.error('搜索失败:', error);
      if (reset) {
        setSearchResults([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearchLoadMore = () => {
    if (!loading && searchHasMore && isSearching && searchQuery.trim()) {
      handleSearch(false);
    }
  };

  const handleSourceChange = (sourceId) => {
    console.log('切换数据源:', sourceId);
    setSelectedSource(sourceId);
    setCurrentVideoSource(sourceId);
    setShowSourcePicker(false);
    setPage(1);
    setVideos([]);
    // 重置分类选择
    setSelectedCategory(null);
    // 传入新的 sourceId 确保使用正确的数据源加载分类
    loadCategories(sourceId);
  };

  const renderItem = ({ item }) => (
    <View style={[
      styles.cardWrapper,
      viewMode === 'list' && styles.cardWrapperList
    ]}>
      <VideoCard video={item} viewMode={viewMode} />
    </View>
  );

  const filteredVideos = isSearching ? searchResults : videos;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      {/* 顶部导航栏 - 一行布局 */}
      <View style={styles.header}>
        {/* 标题 - 搜索栏 - 数据源 */}
        <View style={styles.headerRow}>
          <Text style={styles.title}>视频</Text>
          
          <SearchBar
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              if (!text.trim()) {
                setIsSearching(false);
                setSearchResults([]);
                setSearchPage(1);
                setSearchHasMore(false);
              }
            }}
            onSubmitEditing={() => handleSearch(true)}
            placeholder="搜索视频..."
          />
          
          <TouchableOpacity 
            style={styles.sourceButton}
            onPress={() => setShowSourcePicker(true)}
          >
            <Text style={styles.sourceText}>
              {sources[selectedSource]?.name || '选择数据源'}
            </Text>
            <Text style={styles.sourceArrow}>▼</Text>
          </TouchableOpacity>
        </View>
        
        {/* 搜索结果信息 */}
        {searchQuery.length > 0 && isSearching && (
          <Text style={styles.infoText}>
            找到 {searchResults.length} 个视频
          </Text>
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
                onPress={() => handleSourceChange(key)}
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

      {/* 分类标签 */}
      {!isSearching && (
        <View style={styles.categoryBar}>
          {categoriesLoading ? (
            <View style={styles.categoryLoadingContainer}>
              <ActivityIndicator size="small" color="#6200EE" />
              <Text style={styles.categoryLoadingText}>加载分类中...</Text>
            </View>
          ) : (
            <View style={styles.categoryContent}>
              {(showAllCategories ? categories : categories.slice(0, 8)).map((category, index) => (
                <TouchableOpacity
                  key={`${category.id}-${index}`}
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
          )}
        </View>
      )}

      {/* 视频列表 */}
      {loading && filteredVideos.length === 0 && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6200EE" />
        </View>
      ) : (
        <FlatList
          key={viewMode}
          data={filteredVideos}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          numColumns={viewMode === 'list' ? 1 : 3}
          columnWrapperStyle={viewMode === 'list' ? null : styles.columnWrapper}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#6200EE']}
            />
          }
          onEndReached={searchQuery.trim() ? handleSearchLoadMore : handleLoadMore}
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
                  {isSearching ? '没有找到相关视频' : '暂无视频'}
                </Text>
              </View>
            ) : null
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
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
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
  categoryLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  categoryLoadingText: {
    fontSize: 14,
    color: '#666',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  empty: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
});

export default VideosTabScreen;

