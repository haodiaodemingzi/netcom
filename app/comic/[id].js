import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import ChapterList from '../../components/ChapterList';
import { getComicDetail, getChapters } from '../../services/api';
import { 
  isFavorite, 
  addFavorite, 
  removeFavorite,
  getCurrentSource
} from '../../services/storage';
import downloadManager from '../../services/downloadManager';

const ComicDetailScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  
  const [comic, setComic] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [favorited, setFavorited] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [currentSource, setCurrentSource] = useState('guoman8');

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const source = await getCurrentSource();
      setCurrentSource(source);
      
      const [comicData, chaptersData] = await Promise.all([
        getComicDetail(id, source),
        getChapters(id, source),
        checkFavorite(),
      ]);
      setComic(comicData);
      setChapters(chaptersData.chapters || []);
    } catch (error) {
      // 静默失败
    } finally {
      setLoading(false);
    }
  };

  const checkFavorite = async () => {
    const result = await isFavorite(id);
    setFavorited(result);
  };

  const handleFavorite = async () => {
    if (favorited) {
      await removeFavorite(id);
      setFavorited(false);
    } else {
      await addFavorite(comic);
      setFavorited(true);
    }
  };

  const handleChapterPress = (chapter) => {
    router.push(`/reader/${chapter.id}?comicId=${id}`);
  };

  const handleStartReading = () => {
    if (chapters.length > 0) {
      // 检查第一个章节是否已下载
      const firstChapter = chapters[0];
      if (downloadManager.isDownloaded(firstChapter.id)) {
        router.push(`/reader/${firstChapter.id}?comicId=${id}`);
      } else {
        Alert.alert('提示', '请先下载第一章才能开始阅读');
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200EE" />
      </View>
    );
  }

  if (!comic) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>加载失败</Text>
      </View>
    );
  }

  const renderHeader = () => (
    <View>
      <View style={styles.topSection}>
        <Image
          source={{ uri: comic.cover }}
          style={styles.cover}
          resizeMode="cover"
        />
        <View style={styles.info}>
          <Text style={styles.title}>{comic.title}</Text>
          {comic.author && (
            <Text style={styles.author}>作者: {comic.author}</Text>
          )}
          <View style={styles.tags}>
            {comic.status && (
              <Text style={styles.statusText}>
                {comic.status === 'completed' ? '完结' : '连载'}
              </Text>
            )}
            {(comic.rating != null && comic.rating > 0) && (
              <View style={styles.ratingContainer}>
                <Text style={styles.rating}>
                  {'⭐'.repeat(Math.floor(comic.rating))}
                  {comic.rating % 1 >= 0.5 ? '⭐' : ''}
                </Text>
                <Text style={styles.ratingText}>{comic.rating}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleStartReading}
        >
          <Text style={styles.primaryButtonText}>开始阅读</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.secondaryButton,
            favorited && styles.secondaryButtonActive,
          ]}
          onPress={handleFavorite}
        >
          <Text style={[
            styles.secondaryButtonText,
            favorited && styles.secondaryButtonTextActive,
          ]}>
            {favorited ? '已收藏' : '收藏'}
          </Text>
        </TouchableOpacity>
      </View>

      {comic.description && (
        <View style={styles.descSection}>
          <Text style={styles.sectionTitle}>简介</Text>
          <Text 
            style={styles.description}
            numberOfLines={showFullDesc ? undefined : 3}
          >
            {comic.description}
          </Text>
          <TouchableOpacity 
            onPress={() => setShowFullDesc(!showFullDesc)}
          >
            <Text style={styles.expandButton}>
              {showFullDesc ? '收起' : '展开'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      
      <View style={styles.separator} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
      </View>

      <ChapterList
        chapters={chapters}
        onChapterPress={handleChapterPress}
        comicId={id}
        comicTitle={comic.title}
        source={currentSource}
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
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: 44,
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 28,
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
    backgroundColor: '#e0e0e0',
  },
  info: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
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
  },
  statusText: {
    fontSize: 12,
    color: '#666',
    marginRight: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 16,
    lineHeight: 20,
  },
  ratingText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 4,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#6200EE',
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6200EE',
    alignItems: 'center',
  },
  secondaryButtonActive: {
    backgroundColor: '#6200EE',
  },
  secondaryButtonText: {
    fontSize: 16,
    color: '#6200EE',
    fontWeight: '600',
  },
  secondaryButtonTextActive: {
    color: '#fff',
  },
  descSection: {
    padding: 16,
    borderTopWidth: 8,
    borderTopColor: '#f5f5f5',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  expandButton: {
    fontSize: 14,
    color: '#6200EE',
    marginTop: 8,
  },
  separator: {
    height: 8,
    backgroundColor: '#f5f5f5',
  },
});

export default ComicDetailScreen;
