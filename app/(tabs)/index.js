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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ComicCard from '../../components/ComicCard';
import { 
  getHotComics, 
  getLatestComics,
  getAvailableSources 
} from '../../services/api';
import { getCurrentSource, setCurrentSource } from '../../services/storage';

const CATEGORIES = [
  { id: 'hot', label: '热门' },
  { id: 'latest', label: '最新' },
  { id: 'completed', label: '完结' },
  { id: 'ongoing', label: '连载' },
];

const HomeScreen = () => {
  const [comics, setComics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('hot');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [currentSource, setCurrentSourceState] = useState('mock');
  const [sources, setSources] = useState({});
  const [showSourceMenu, setShowSourceMenu] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadComics();
  }, [selectedCategory, currentSource]);

  const loadInitialData = async () => {
    try {
      const [sourcesData, savedSource] = await Promise.all([
        getAvailableSources(),
        getCurrentSource(),
      ]);
      setSources(sourcesData);
      setCurrentSourceState(savedSource);
    } catch (error) {
      console.error('加载初始数据失败:', error);
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
        data = { comics: [], hasMore: false };
      }

      if (isRefresh) {
        setComics(data.comics || []);
        setPage(1);
      } else {
        setComics([...comics, ...(data.comics || [])]);
      }

      setHasMore(data.hasMore || false);
    } catch (error) {
      console.error('加载漫画失败:', error);
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
      setPage(page + 1);
      loadComics();
    }
  };

  const handleCategoryPress = (categoryId) => {
    setSelectedCategory(categoryId);
    setPage(1);
    setComics([]);
  };

  const handleSourceChange = async (sourceId) => {
    setCurrentSourceState(sourceId);
    await setCurrentSource(sourceId);
    setPage(1);
    setComics([]);
    setShowSourceMenu(false);
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>漫画阅读器</Text>
      <TouchableOpacity 
        onPress={() => setShowSourceMenu(!showSourceMenu)}
        style={styles.sourceButton}
      >
        <Text style={styles.sourceButtonText}>
          {sources[currentSource]?.name || '数据源'} ▼
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderCategories = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.categoriesContainer}
      contentContainerStyle={styles.categoriesContent}
    >
      {CATEGORIES.map((category) => (
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
            {category.label}
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
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>暂无漫画</Text>
            </View>
          )
        }
      />
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
    paddingVertical: 12,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  categoryButtonActive: {
    backgroundColor: '#6200EE',
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
  },
  categoryTextActive: {
    color: '#fff',
    fontWeight: '600',
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
});

export default HomeScreen;
