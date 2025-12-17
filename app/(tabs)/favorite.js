import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import ComicCard from '../../components/ComicCard';
import VideoCard from '../../components/VideoCard';
import { getFavorites, getSettings } from '../../services/storage';

const FavoriteScreen = () => {
  const router = useRouter();
  const [favorites, setFavorites] = useState([]);
  const [viewMode, setViewMode] = useState('card');

  useFocusEffect(
    React.useCallback(() => {
      loadFavorites();
      loadViewMode();
    }, [])
  );

  useEffect(() => {
    loadViewMode();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      loadViewMode();
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const loadFavorites = async () => {
    const data = await getFavorites();
    setFavorites(data || []);
  };

  const loadViewMode = async () => {
    const settings = await getSettings();
    if (settings?.viewMode) {
      setViewMode(settings.viewMode);
    }
  };

  const handlePress = (item) => {
    if (!item || !item.id) return;
    if (item.type === 'video') {
      router.push(`/series/${item.id}`);
      return;
    }
    router.push(`/comic/${item.id}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>我的收藏</Text>
        <Text style={styles.headerSubtitle}>
          共 {favorites.length} 个
        </Text>
      </View>
      <FlatList
        key={viewMode}
        data={favorites}
        renderItem={({ item }) => {
          if (!item) return null;
          const isVideo = item.type === 'video';
          return (
            <View
              style={[
                styles.cardWrapper,
                viewMode === 'list' && styles.cardWrapperList
              ]}
            >
              {isVideo ? (
                <VideoCard video={item} viewMode={viewMode} />
              ) : (
                <ComicCard comic={item} viewMode={viewMode} />
              )}
            </View>
          );
        }}
        keyExtractor={(item, index) => `${item?.id || 'unknown'}-${index}`}
        numColumns={viewMode === 'list' ? 1 : 3}
        contentContainerStyle={[
          styles.listContent,
          viewMode === 'list' && styles.listContentList
        ]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>暂无收藏</Text>
            <Text style={styles.emptyHint}>
              快去收藏你喜欢的内容吧
            </Text>
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
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
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
    paddingHorizontal: 0,
    paddingVertical: 0,
    marginBottom: 0,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#ccc',
  },
});

export default FavoriteScreen;
