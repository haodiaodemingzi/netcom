import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getNovelDetail, getNovelChapters } from '../../services/novelApi';

const NovelDetailScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [novel, setNovel] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const novelResult = await getNovelDetail(id);
      const chaptersResult = await getNovelChapters(id);

      if (novelResult.success) {
        setNovel(novelResult.data);
      }
      if (chaptersResult.success) {
        setChapters(chaptersResult.data);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
      Alert.alert('错误', '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleChapterPress = (chapter) => {
    if (!chapter || !chapter.id) return;
    const safeNovelId = novel?.id || id;
    const safeTitle = encodeURIComponent(novel?.title || '');
    const safeCover = encodeURIComponent(novel?.cover || '');
    router.push(`/novel-reader/${chapter.id}?novelId=${safeNovelId}&novelTitle=${safeTitle}&cover=${safeCover}`);
  };

  const renderChapterCard = ({ item }) => (
    <TouchableOpacity
      style={styles.chapterCard}
      onPress={() => handleChapterPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.chapterInfo}>
        <Text style={styles.chapterTitle}>{item.title}</Text>
        <Text style={styles.chapterPreview} numberOfLines={1}>
          {item.content.substring(0, 50)}...
        </Text>
      </View>
      <Text style={styles.chapterArrow}>›</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200EE" />
      </View>
    );
  }

  if (!novel) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>小说不存在</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← 返回</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Image
          source={{ uri: novel.cover }}
          style={styles.cover}
        />

        <View style={styles.info}>
          <Text style={styles.title}>{novel.title}</Text>
          
          <View style={styles.meta}>
            <Text style={styles.author}>作者: {novel.author}</Text>
            <Text style={styles.rating}>⭐ {novel.rating}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.chapters}>{novel.chapters} 章</Text>
            <Text style={[
              styles.status,
              novel.status === '完结' ? styles.completed : styles.ongoing
            ]}>
              {novel.status}
            </Text>
          </View>

          <Text style={styles.description}>{novel.description}</Text>

          <View style={styles.divider} />

          <Text style={styles.chaptersTitle}>章节列表 ({chapters.length})</Text>
        </View>

        <FlatList
          data={chapters}
          renderItem={renderChapterCard}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          contentContainerStyle={styles.chaptersList}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    fontSize: 16,
    color: '#6200EE',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#999',
  },
  cover: {
    width: '100%',
    height: 300,
    backgroundColor: '#e0e0e0',
  },
  info: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 8,
  },
  author: {
    fontSize: 14,
    color: '#666',
  },
  rating: {
    fontSize: 14,
    color: '#ff9800',
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  chapters: {
    fontSize: 12,
    color: '#999',
  },
  status: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  completed: {
    backgroundColor: '#e8f5e9',
    color: '#4caf50',
  },
  ongoing: {
    backgroundColor: '#fff3e0',
    color: '#ff9800',
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 16,
  },
  chaptersTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  chaptersList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  chapterCard: {
    flexDirection: 'row',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  chapterInfo: {
    flex: 1,
  },
  chapterTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  chapterPreview: {
    fontSize: 12,
    color: '#999',
  },
  chapterArrow: {
    fontSize: 20,
    color: '#ccc',
    marginLeft: 8,
  },
});

export default NovelDetailScreen;
