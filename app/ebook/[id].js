import React, { useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ebookChapters, getBookById } from '../../mock/ebooks';

const EbookDetailScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const book = useMemo(() => getBookById(id), [id]);
  const chapters = useMemo(() => ebookChapters[id] || [], [id]);

  if (!book) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyText}>未找到该电子书</Text>
      </SafeAreaView>
    );
  }

  const handleRead = (chapterId) => {
    router.push(`/ebook-reader/${chapterId}?bookId=${id}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView>
        <View style={styles.topSection}>
          <Image source={{ uri: book.cover }} style={styles.cover} />
          <View style={styles.meta}>
            <Text style={styles.title}>{book.title}</Text>
            <Text style={styles.author}>{book.author}</Text>
            <Text style={styles.status}>
              {book.status === 'completed' ? '已完结' : '连载中'} · {book.wordCount}
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => handleRead(chapters[0]?.id)}
              disabled={chapters.length === 0}
            >
              <Text style={styles.primaryText}>
                {chapters.length > 0 ? '开始阅读' : '暂无章节'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>简介</Text>
          <Text style={styles.desc}>{book.description}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              目录 · {chapters.length} 章
            </Text>
            <TouchableOpacity>
              <Text style={styles.sectionLink}>全部下载</Text>
            </TouchableOpacity>
          </View>

          {chapters.map((chapter) => (
            <TouchableOpacity
              key={chapter.id}
              style={styles.chapterRow}
              onPress={() => handleRead(chapter.id)}
            >
              <View>
                <Text style={styles.chapterTitle}>{chapter.title}</Text>
                <Text style={styles.chapterMeta}>{chapter.wordCount} 字</Text>
              </View>
              <Text style={styles.readButton}>阅读</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  topSection: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  cover: {
    width: 120,
    height: 160,
    borderRadius: 8,
    marginRight: 16,
  },
  meta: {
    flex: 1,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
  },
  author: {
    fontSize: 14,
    color: '#666',
    marginVertical: 4,
  },
  status: {
    fontSize: 13,
    color: '#999',
  },
  primaryButton: {
    marginTop: 12,
    backgroundColor: '#6200EE',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: '#f0f0f0',
    borderBottomWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  sectionLink: {
    fontSize: 14,
    color: '#6200EE',
  },
  desc: {
    fontSize: 14,
    color: '#444',
    lineHeight: 22,
  },
  chapterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomColor: '#f5f5f5',
    borderBottomWidth: 1,
  },
  chapterTitle: {
    fontSize: 15,
    color: '#222',
  },
  chapterMeta: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  readButton: {
    color: '#6200EE',
    fontWeight: '600',
  },
});

export default EbookDetailScreen;

