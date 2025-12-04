import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Linking,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BookCard from '../../components/BookCard';
import {
  getEbookCategories,
  getEbooksByCategory,
  getEbookSources,
  getAllBooksMetadata,
  getMetadataStatus,
} from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const [allBooksMetadata, setAllBooksMetadata] = useState([]);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);

  // 加载数据源列表和元数据
  useEffect(() => {
    loadSources();
    loadMetadataInBackground();
    
    // 启动定时刷新
    const intervalId = scheduleMetadataRefresh();
    
    // 清理定时器
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

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

  // 检查缓存是否需要刷新
  const shouldRefreshCache = async (cachedData) => {
    if (!cachedData || !cachedData.last_updated) {
      return true;
    }
    
    const now = Date.now();
    const lastUpdated = cachedData.last_updated * 1000; // 后端返回的是秒
    const hoursSinceUpdate = (now - lastUpdated) / (1000 * 60 * 60);
    
    // 24小时后刷新
    return hoursSinceUpdate > 24;
  };

  // 后台加载所有书籍元数据
  const loadMetadataInBackground = async () => {
    try {
      // 先从缓存加载
      const cached = await AsyncStorage.getItem('allBooksMetadata');
      let cachedData = null;
      
      if (cached) {
        cachedData = JSON.parse(cached);
        setAllBooksMetadata(cachedData.books || []);
        console.log(`从缓存加载${cachedData.books?.length || 0}本书籍元数据`);
        
        // 检查是否需要刷新
        const needRefresh = await shouldRefreshCache(cachedData);
        if (!needRefresh) {
          console.log('缓存数据仍然新鲜,无需刷新');
          return;
        }
      }
      
      // 后台静默更新,不阻塞UI
      setTimeout(async () => {
        try {
          console.log('触发后台元数据加载...');
          setMetadataLoading(true);
          
          // 触发后台加载(立即返回)
          const response = await getAllBooksMetadata(selectedSource, cachedData ? true : false);
          
          console.log(`后台响应: ${response.message}, 当前${response.total}本书`);
          
          // 如果有数据,立即更新
          if (response.books && response.books.length > 0) {
            const saveData = {
              ...response,
              last_updated: response.last_updated || Date.now() / 1000,
              cached_at: new Date().toISOString()
            };
            
            setAllBooksMetadata(response.books);
            await AsyncStorage.setItem('allBooksMetadata', JSON.stringify(saveData));
            console.log(`元数据已更新: ${response.books.length}本书籍`);
          }
          
          // 如果正在加载,定期检查状态
          if (response.is_loading) {
            console.log('后台正在加载元数据,启动定期检查...');
            setTimeout(() => checkMetadataStatus(), 10000);
          }
          
          setMetadataLoading(response.is_loading);
        } catch (error) {
          console.error('触发元数据加载失败:', error);
          setMetadataLoading(false);
        }
      }, 1000); // 延迟1秒启动,让主界面先加载
      
    } catch (error) {
      console.error('加载缓存失败:', error);
    }
  };

  // 检查元数据加载状态
  const checkMetadataStatus = async () => {
    try {
      const status = await getMetadataStatus();
      
      console.log(`状态检查: ${status.total}本书, 加载中: ${status.is_loading}`);
      
      if (!status.is_loading && status.total > 0) {
        // 加载完成,获取最新数据
        const response = await getAllBooksMetadata(selectedSource);
        if (response.books && response.books.length > 0) {
          const saveData = {
            ...response,
            last_updated: response.last_updated || Date.now() / 1000,
            cached_at: new Date().toISOString()
          };
          
          setAllBooksMetadata(response.books);
          await AsyncStorage.setItem('allBooksMetadata', JSON.stringify(saveData));
          console.log(`✅ 元数据加载完成: ${response.books.length}本书籍`);
          setMetadataLoading(false);
        }
      } else if (status.is_loading) {
        // 还在加载,15秒后再检查
        console.log('⏳ 后台仍在加载,15秒后再次检查...');
        setTimeout(() => checkMetadataStatus(), 15000);
      } else {
        // 未加载且无数据,停止检查
        setMetadataLoading(false);
      }
    } catch (error) {
      console.error('检查元数据状态失败:', error);
      setMetadataLoading(false);
    }
  };

  // 定时刷新元数据 (每24小时)
  const scheduleMetadataRefresh = () => {
    // 每小时检查一次是否需要刷新
    const checkAndRefresh = async () => {
      try {
        const cached = await AsyncStorage.getItem('allBooksMetadata');
        if (cached) {
          const cachedData = JSON.parse(cached);
          const needRefresh = await shouldRefreshCache(cachedData);
          
          if (needRefresh) {
            console.log('定时刷新元数据...');
            await loadMetadataInBackground();
          }
        }
      } catch (error) {
        console.error('定时刷新检查失败:', error);
      }
    };

    // 立即检查一次
    checkAndRefresh();
    
    // 设置定时器,每小时检查一次
    const intervalId = setInterval(checkAndRefresh, 60 * 60 * 1000);
    
    return intervalId;
  };

  // 获取缓存时间信息
  const [cacheInfo, setCacheInfo] = useState('');
  
  const updateCacheInfo = async () => {
    try {
      const cached = await AsyncStorage.getItem('allBooksMetadata');
      if (cached) {
        const data = JSON.parse(cached);
        if (data.cached_at) {
          const cacheTime = new Date(data.cached_at);
          const now = new Date();
          const hoursAgo = Math.floor((now - cacheTime) / (1000 * 60 * 60));
          
          let info = '';
          if (hoursAgo < 1) {
            info = '刚刚更新';
          } else if (hoursAgo < 24) {
            info = `${hoursAgo}小时前更新`;
          } else {
            info = `${Math.floor(hoursAgo / 24)}天前更新`;
          }
          
          setCacheInfo(info);
        }
      }
    } catch (error) {
      console.error('获取缓存信息失败:', error);
    }
  };

  // 定时更新缓存信息显示
  useEffect(() => {
    updateCacheInfo();
    const intervalId = setInterval(updateCacheInfo, 5 * 60 * 1000); // 每5分钟更新一次
    
    return () => clearInterval(intervalId);
  }, [allBooksMetadata.length]);

  // 搜索过滤书籍 - 优先搜索全部元数据
  const filteredBooks = useMemo(() => {
    if (!searchQuery.trim()) {
      return books;
    }
    
    const query = searchQuery.toLowerCase().trim();
    
    // 如果有全部元数据,在全部数据中搜索
    if (allBooksMetadata.length > 0) {
      const filtered = allBooksMetadata.filter(book => 
        book.title?.toLowerCase().includes(query) ||
        book.author?.toLowerCase().includes(query)
      );
      
      // 调试: 检查重复ID
      const ids = filtered.map(book => book.id);
      const uniqueIds = [...new Set(ids)];
      if (ids.length !== uniqueIds.length) {
        console.warn(`发现重复ID: 总数${ids.length}, 唯一数${uniqueIds.length}`);
      }
      
      return filtered;
    }
    
    // 否则只在当前列表中搜索
    return books.filter(book => 
      book.title?.toLowerCase().includes(query) ||
      book.author?.toLowerCase().includes(query)
    );
  }, [searchQuery, books, allBooksMetadata]);

  const loadSources = async () => {
    try {
      const data = await getEbookSources();
      setSources(data.sources || {});
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
          
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder={allBooksMetadata.length > 0 
                ? `搜索${allBooksMetadata.length}本...` 
                : "搜索..."}
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity 
                style={styles.clearButton}
                onPress={() => setSearchQuery('')}
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
              {sources[selectedSource]?.name || '努努书坊'}
            </Text>
            <Text style={styles.sourceArrow}>▼</Text>
          </TouchableOpacity>
        </View>
        
        {/* 缓存信息或搜索结果 */}
        {searchQuery.length > 0 ? (
          <Text style={styles.infoText}>
            找到 {filteredBooks.length} 本{allBooksMetadata.length > 0 && ' (全站)'}
          </Text>
        ) : allBooksMetadata.length > 0 && cacheInfo ? (
          <Text style={styles.infoText}>
            数据库: {allBooksMetadata.length}本 | {cacheInfo}
          </Text>
        ) : null}
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
          {categories.map((category, index) => (
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
        </View>
      </View>

      <FlatList
        data={filteredBooks}
        keyExtractor={(item, index) => `${item.id || ''}-${index}`}
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <BookCard book={item} />
          </View>
        )}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
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
        contentContainerStyle={styles.listContent}
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
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 38,
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
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    paddingRight: 40,
  },
  googleButton: {
    position: 'absolute',
    right: 50,
    height: 32,
    paddingHorizontal: 12,
    backgroundColor: '#4285F4',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
    gap: 6,
  },
  categoryChip: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryChipActive: {
    backgroundColor: '#6200EE',
  },
  categoryText: {
    fontSize: 12,
    color: '#666',
  },
  categoryTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  listHeader: {
    width: '100%',
    paddingHorizontal: 12,
  },
  listContent: {
    paddingBottom: 24,
  },
  columnWrapper: {
    paddingHorizontal: 2,
  },
  cardWrapper: {
    width: '50%',
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

