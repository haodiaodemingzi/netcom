import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import ComicCard from '../components/ComicCard';
import VideoCard from '../components/VideoCard';
import BookCard from '../components/BookCard';
import { getHistory, clearHistory } from '../services/storage';

const HistoryScreen = () => {
  const router = useRouter();
  const navigation = useNavigation();
  const [history, setHistory] = useState([]);
  const viewMode = 'list';

  useEffect(() => {
    loadHistory();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadHistory();
    }, [])
  );

  useFocusEffect(
    React.useCallback(() => {
      let handled = false;
      const unsubscribe = navigation.addListener('beforeRemove', (e) => {
        if (handled) return;
        handled = true;
        e.preventDefault();
        router.replace('/(tabs)/profile');
      });
      return unsubscribe;
    }, [navigation, router])
  );

  const loadHistory = async () => {
    const data = await getHistory();
    setHistory(Array.isArray(data) ? data : []);
  };

  const handleClearHistory = () => {
    Alert.alert(
      '清除历史',
      '确定要清除所有阅读历史吗?',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'destructive',
          onPress: async () => {
            await clearHistory();
            loadHistory();
          },
        },
      ]
    );
  };

  const handlePress = (item) => {
    if (!item || !item.id) return;
    const type = item.type || 'comic';
    if (type === 'video') {
      router.push(`/series/${item.id}`);
      return;
    }
    if (type === 'ebook') {
      const source = item.source || 'kanunu8';
      router.push(`/ebook/${item.id}?source=${source}`);
      return;
    }
    if (type === 'novel') {
      router.push(`/novel/${item.id}`);
      return;
    }
    router.push(`/comic/${item.id}`);
  };

  const renderProgressText = (item) => {
    if (!item) return '';
    const type = item.type || 'comic';
    if (type === 'video') {
      const ep = item.lastEpisodeId || '';
      const pos = Number.isFinite(item.lastPositionSeconds) ? item.lastPositionSeconds : null;
      const dur = Number.isFinite(item.lastDurationSeconds) ? item.lastDurationSeconds : null;
      if (!ep && (pos == null || dur == null)) return '';
      if (pos != null && dur != null) {
        return `上次观看: ${ep || '未知剧集'} ${pos}s/${dur}s`;
      }
      return `上次观看: ${ep || '未知剧集'}`;
    }
    if (type === 'novel') {
      const ch = item.lastChapterId || '';
      const offset = Number.isFinite(item.scrollOffset) ? Math.floor(item.scrollOffset) : null;
      if (!ch && offset == null) return '';
      if (offset != null) {
        return `上次阅读: ${ch || '未知章节'} 位置 ${offset}`;
      }
      return `上次阅读: ${ch || '未知章节'}`;
    }
    if (type === 'ebook') {
      const ch = item.lastChapterId || '';
      const page = Number.isFinite(item.lastPage) ? item.lastPage : null;
      if (!ch && page == null) return '';
      if (page != null) {
        return `上次阅读: ${ch || '未知章节'} 第 ${page} 页`;
      }
      return `上次阅读: ${ch || '未知章节'}`;
    }
    const ch = item.lastChapterId || '';
    const page = Number.isFinite(item.lastPage) ? item.lastPage : null;
    if (!ch && page == null) return '';
    if (page != null) {
      return `上次阅读: 第 ${ch || '未知'} 章 第 ${page} 页`;
    }
    return `上次阅读: 第 ${ch || '未知'} 章`;
  };

  const renderItem = ({ item }) => {
    if (!item) return null;
    const type = item.type || 'comic';
    const progressText = renderProgressText(item);
    return (
      <View
        style={[
          styles.cardWrapper,
          viewMode === 'list' && styles.cardWrapperList
        ]}
      >
        <View style={styles.cardInner}>
          {type === 'video' ? (
            <VideoCard video={item} viewMode={viewMode} onPress={() => handlePress(item)} />
          ) : type === 'ebook' ? (
            <BookCard book={item} viewMode={viewMode} onPress={() => handlePress(item)} />
          ) : type === 'novel' ? (
            <BookCard book={item} viewMode={viewMode} onPress={() => handlePress(item)} />
          ) : (
            <ComicCard comic={item} viewMode={viewMode} onPress={() => handlePress(item)} />
          )}
          {progressText ? (
            <View style={styles.progressOverlay} pointerEvents="none">
              <Text style={styles.progressOverlayText} numberOfLines={2}>
                {progressText}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/profile')} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>阅读历史</Text>
        {history.length > 0 && (
          <TouchableOpacity onPress={handleClearHistory}>
            <Text style={styles.clearButton}>清除</Text>
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={history}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item?.type || 'comic'}-${item?.id || 'unknown'}-${index}`}
        numColumns={1}
        contentContainerStyle={[
          styles.listContent,
          viewMode === 'list' && styles.listContentList
        ]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>暂无阅读历史</Text>
          </View>
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
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 24,
    color: '#000',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  clearButton: {
    fontSize: 14,
    color: '#6200EE',
  },
  listContent: {
    paddingBottom: 24,
    padding: 2,
  },
  listContentList: {
    padding: 0,
  },
  cardWrapper: {
    width: '33.333%',
    padding: 2,
  },
  cardWrapperList: {
    width: '100%',
    padding: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    marginBottom: 0,
  },
  cardInner: {
    position: 'relative',
  },
  progressOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  progressOverlayText: {
    fontSize: 12,
    color: '#fff',
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

export default HistoryScreen;
