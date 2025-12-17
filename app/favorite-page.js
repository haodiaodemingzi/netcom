import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import ComicCard from '../components/ComicCard';
import VideoCard from '../components/VideoCard';
import { getFavorites } from '../services/storage';

const FavoritePage = () => {
  const router = useRouter();
  const [favorites, setFavorites] = useState([]);
  const viewMode = 'list';

  useFocusEffect(
    React.useCallback(() => {
      loadFavorites();
    }, [])
  );

  const loadFavorites = async () => {
    const data = await getFavorites();
    setFavorites(data || []);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>我的收藏</Text>
          <Text style={styles.headerSubtitle}>共 {favorites.length} 个</Text>
        </View>
      </View>

      <FlatList
        data={favorites}
        renderItem={({ item }) => {
          if (!item) return null;
          const isVideo = item.type === 'video';
          return (
            <View style={styles.itemWrapper}>
              {isVideo ? (
                <VideoCard video={item} viewMode={viewMode} />
              ) : (
                <ComicCard comic={item} viewMode={viewMode} />
              )}
            </View>
          );
        }}
        keyExtractor={(item, index) => `${item?.id || 'unknown'}-${index}`}
        numColumns={1}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>暂无收藏</Text>
            <Text style={styles.emptyHint}>快去收藏你喜欢的内容吧</Text>
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
  headerContent: {
    flex: 1,
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
  },
  itemWrapper: {
    width: '100%',
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

export default FavoritePage;
