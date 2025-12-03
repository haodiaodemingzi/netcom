import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BookCard from '../../components/BookCard';
import {
  ebookCategories,
  ebookSources,
  getBooksByCategory,
} from '../../mock/ebooks';

const EbookTabScreen = () => {
  const [selectedSource, setSelectedSource] = useState('localMock');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const categories = useMemo(
    () => [{ id: 'all', name: '全部' }, ...ebookCategories],
    []
  );

  const books = useMemo(
    () => getBooksByCategory(selectedCategory),
    [selectedCategory]
  );

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>电子书</Text>
        <TouchableOpacity style={styles.sourceButton}>
          <Text style={styles.sourceText}>
            {ebookSources[selectedSource]?.name || '数据源'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.categoryBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryContent}
        >
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
        </ScrollView>
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
        ListHeaderComponent={() => (
          <View style={styles.listHeader}>
            <View style={styles.mockHint}>
              <Text style={styles.mockHintTitle}>当前展示为 Mock 数据</Text>
              <Text style={styles.mockHintDesc}>
                接入真实采集源后，只需替换 API 数据源，即可无缝切换。
              </Text>
            </View>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>暂无电子书</Text>
          </View>
        )}
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
    paddingVertical: 14,
    alignItems: 'center',
  },
  categoryChip: {
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryChipActive: {
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
  listHeader: {
    width: '100%',
    paddingHorizontal: 12,
  },
  listContent: {
    paddingBottom: 24,
  },
  columnWrapper: {
    paddingHorizontal: 4,
  },
  cardWrapper: {
    width: '50%',
  },
  mockHint: {
    backgroundColor: '#EDE7F6',
    marginHorizontal: 12,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  mockHintTitle: {
    fontSize: 14,
    color: '#4527A0',
    fontWeight: '600',
  },
  mockHintDesc: {
    fontSize: 12,
    color: '#4527A0',
    marginTop: 4,
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

