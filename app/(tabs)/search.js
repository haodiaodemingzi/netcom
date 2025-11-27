import React, { useState, useEffect } from 'react';
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
import ComicCard from '../../components/ComicCard';
import { searchComics } from '../../services/api';
import {
  getSearchHistory,
  addSearchHistory,
  clearSearchHistory,
} from '../../services/storage';

const SearchScreen = () => {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const data = await getSearchHistory();
    setHistory(data);
  };

  const handleSearch = async (searchKeyword) => {
    const term = searchKeyword || keyword;
    if (!term.trim()) return;

    setLoading(true);
    try {
      const data = await searchComics(term);
      setResults(data.comics || []);
      await addSearchHistory(term);
      await loadHistory();
    } catch (error) {
      console.error('搜索失败:', error);
    } finally {
      setLoading(false);
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
});

export default SearchScreen;
