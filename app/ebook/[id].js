import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import ChapterList from '../../components/ChapterList';
import { getEbookDetail, getEbookChapters } from '../../services/api';

const EbookDetailScreen = () => {
  const router = useRouter();
  const { id, source = 'kanunu8' } = useLocalSearchParams();
  
  const [book, setBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookDetail();
  }, [id]);

  const loadBookDetail = async () => {
    try {
      setLoading(true);
      const [bookData, chaptersData] = await Promise.all([
        getEbookDetail(id, source),
        getEbookChapters(id, source),
      ]);
      setBook(bookData);
      setChapters(chaptersData.chapters || []);
    } catch (error) {
      console.error('加载书籍详情失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRead = (chapterId) => {
    router.push(`/ebook-reader/${chapterId}?bookId=${id}&source=${source}`);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200EE" />
      </View>
    );
  }

  if (!book) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>加载失败</Text>
      </View>
    );
  }

  const renderHeader = () => (
    <View>
      <View style={styles.topSection}>
        <View style={styles.coverPlaceholder}>
          <Text style={styles.coverText}>📖</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.title}>{book.title}</Text>
          {book.author && (
            <Text style={styles.author}>作者: {book.author}</Text>
          )}
          <View style={styles.tags}>
            <Text style={styles.statusText}>
              共 {book.totalChapters || chapters.length} 章
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => handleRead(chapters[0]?.id)}
          disabled={chapters.length === 0}
        >
          <Text style={styles.primaryButtonText}>
            {chapters.length > 0 ? '开始阅读' : '暂无章节'}
          </Text>
        </TouchableOpacity>
      </View>

      {book.description && (
        <View style={styles.descSection}>
          <Text style={styles.sectionTitle}>简介</Text>
          <Text style={styles.description}>{book.description}</Text>
        </View>
      )}
      
      <View style={styles.separator} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{book.title}</Text>
      </View>

      <ChapterList
        chapters={chapters}
        onChapterPress={handleRead}
        comicId={id}
        comicTitle={book.title}
        source={source}
        ListHeaderComponent={renderHeader}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 16,
    color: '#999',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 20,
    color: '#333',
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  topSection: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
  },
  coverPlaceholder: {
    width: 120,
    height: 160,
    borderRadius: 8,
    marginRight: 16,
    backgroundColor: '#E8EAF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverText: {
    fontSize: 48,
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  author: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  tags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 13,
    color: '#999',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: '#fff',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#6200EE',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  descSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#444',
    lineHeight: 22,
  },
  separator: {
    height: 8,
    backgroundColor: '#f5f5f5',
  },
});

export default EbookDetailScreen;

