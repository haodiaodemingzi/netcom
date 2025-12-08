import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import ComicCard from '../../components/ComicCard';
import { searchComics, getAvailableSources } from '../../services/api';
import {
  getSearchHistory,
  addSearchHistory,
  clearSearchHistory,
  getCurrentSource,
  setCurrentSource,
} from '../../services/storage';

const SearchScreen = () => {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentSource, setCurrentSource] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const lastSourceRef = useRef(null);
  const lastKeywordRef = useRef('');

  useEffect(() => {
    loadHistory();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAndCheckSource();
    }, [])
  );

  const loadHistory = async () => {
    const data = await getSearchHistory();
    setHistory(data);
  };

  const loadAndCheckSource = async () => {
    try {
      let source = await getCurrentSource();
      
      // 如果没有保存的数据源，从API获取第一个可用的
      if (!source) {
        const sourcesData = await getAvailableSources();
        source = Object.keys(sourcesData)[0];
        if (source) {
          await setCurrentSource(source);
        }
      }
      
      // 检查数据源是否变化
      const sourceChanged = lastSourceRef.current && lastSourceRef.current !== source;
      
      // 如果数据源变化了，且有搜索关键词，重新搜索
      if (sourceChanged && lastKeywordRef.current) {
        // 使用ref中存储的关键词重新搜索
        const searchTerm = lastKeywordRef.current;
        
        // 先更新状态和ref
        setCurrentSource(source);
        lastSourceRef.current = source;
        
        setLoading(true);
        setPage(1);
        try {
          const data = await searchComics(searchTerm, 1, 20, source);
          setResults(data.comics || []);
          setHasMore(data.hasMore || false);
        } catch (error) {
          console.error('重新搜索失败:', error);
        } finally {
          setLoading(false);
        }
      } else {
        // 没有变化或没有关键词，只更新状态
        setCurrentSource(source);
        lastSourceRef.current = source;
      }
    } catch (error) {
      console.error('加载数据源失败:', error);
    }
  };

  const handleSearch = async (searchKeyword) => {
    const term = searchKeyword || keyword;
    if (!term.trim()) return;

    setLoading(true);
    setPage(1);
    lastKeywordRef.current = term; // 记录搜索关键词
    
    try {
      // 确保有数据源
      let searchSource = currentSource;
      if (!searchSource) {
        searchSource = await getCurrentSource();
        if (!searchSource) {
          const sourcesData = await getAvailableSources();
          searchSource = Object.keys(sourcesData)[0];
        }
        setCurrentSource(searchSource);
        lastSourceRef.current = searchSource;
      }
      
      const data = await searchComics(term, 1, 20, searchSource);
      setResults(data.comics || []);
      setHasMore(data.hasMore || false);
      await addSearchHistory(term);
      await loadHistory();
    } catch (error) {
      console.error('搜索失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!hasMore || loadingMore || !keyword.trim() || !currentSource) return;

    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const data = await searchComics(keyword, nextPage, 20, currentSource);
      setResults(prev => [...prev, ...(data.comics || [])]);
      setHasMore(data.hasMore || false);
      setPage(nextPage);
    } catch (error) {
      console.error('加载更多失败:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleHistoryPress = (item) => {
    setKeyword(item);
    handleSearch(item);
  };

  const handleClearHistory = async () => {
    await clearSearchHistory();
    setHistory([]);
  };

  const renderItem = ({ item }) => (
    <View style={styles.cardWrapper}>
      <ComicCard comic={item} />
    </View>
  );

  const renderHistory = () => {
    if (results.length > 0 || keyword) return null;

    return (
      <View style={styles.historyContainer}>
        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>搜索历史</Text>
          {history.length > 0 && (
            <TouchableOpacity onPress={handleClearHistory}>
              <Text style={styles.clearButton}>清除</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.historyList}>
          {history.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.historyItem}
              onPress={() => handleHistoryPress(item)}
            >
              <Text style={styles.historyText}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="搜索漫画..."
          value={keyword}
          onChangeText={setKeyword}
          onSubmitEditing={() => handleSearch()}
          returnKeyType="search"
        />
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => handleSearch()}
        >
          <Text style={styles.searchButtonText}>搜索</Text>
        </TouchableOpacity>
      </View>

      {renderHistory()}

      {results.length > 0 && (
        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <Text style={styles.footerText}>加载中...</Text>
              </View>
            ) : null
          }
        />
      )}

      {!loading && results.length === 0 && keyword && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>未找到相关漫画</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchBar: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    fontSize: 14,
  },
  searchButton: {
    marginLeft: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
    backgroundColor: '#6200EE',
    borderRadius: 20,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  historyContainer: {
    padding: 16,
    backgroundColor: '#fff',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  clearButton: {
    fontSize: 14,
    color: '#6200EE',
  },
  historyList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  historyItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
  },
  historyText: {
    fontSize: 14,
    color: '#666',
  },
  listContent: {
    padding: 4,
  },
  cardWrapper: {
    width: '50%',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#999',
  },
});

export default SearchScreen;
