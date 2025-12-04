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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BookCard from '../../components/BookCard';
import {
  getEbookCategories,
  getEbooksByCategory,
  getEbookSources,
} from '../../services/api';

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

  // 加载数据源列表
  useEffect(() => {
    loadSources();
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
      <View style={styles.header}>
        <Text style={styles.title}>电子书</Text>
        <TouchableOpacity style={styles.sourceButton}>
          <Text style={styles.sourceText}>
            {sources[selectedSource]?.name || '努努书坊'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.categoryBar}>
        <View style={styles.categoryContent}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
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
        data={books}
        keyExtractor={(item) => item.id}
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
        onEndReached={handleLoadMore}
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
              <Text style={styles.emptyText}>暂无电子书</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomColor: '#e0e0e0',
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
  },
  sourceButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  sourceText: {
    fontSize: 13,
    color: '#666',
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

