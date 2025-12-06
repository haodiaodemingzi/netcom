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
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import VideoCard from '../../components/VideoCard';
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
  const [selectedCategory, setSelectedCategory] = useState('hot');
  const [selectedSource, setSelectedSource] = useState('source1');
  const [sources, setSources] = useState({});
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
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

  // 加载数据源和分类
  useEffect(() => {
    loadSources();
    loadCategories();
  }, []);

  // 分类或数据源变化时，重置并加载第一页
  useEffect(() => {
    if (selectedCategory && selectedSource) {
      setPage(1);
      setVideos([]);
      loadVideos(true);
    }
  }, [selectedCategory, selectedSource]);

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
        setSources(result.data || {});
        // 如果没有当前源，设置默认源
        if (!result.data[selectedSource] && Object.keys(result.data).length > 0) {
          const firstSource = Object.keys(result.data)[0];
          setSelectedSource(firstSource);
          setCurrentVideoSource(firstSource);
        }
      }
    } catch (error) {
      console.error('加载数据源失败:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const result = await getVideoCategories(selectedSource);
      if (result.success) {
        setCategories(result.data || []);
      }
    } catch (error) {
      console.error('加载分类失败:', error);
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

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setLoading(true);
    try {
      const result = await searchVideos(searchQuery.trim(), 1, 20, selectedSource);
      if (result.success) {
        setSearchResults(result.data || []);
      }
    } catch (error) {
      console.error('搜索失败:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSourceChange = (sourceId) => {
    setSelectedSource(sourceId);
    setCurrentVideoSource(sourceId);
    setShowSourcePicker(false);
    setPage(1);
    setVideos([]);
    loadCategories();
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
          
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="搜索..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity 
                style={styles.clearButton}
                onPress={() => {
                  setSearchQuery('');
                  setIsSearching(false);
                  setSearchResults([]);
                }}
              >
                <Text style={styles.clearButtonText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          
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
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    height: 38,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    paddingRight: 40,
  },
  clearButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
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

