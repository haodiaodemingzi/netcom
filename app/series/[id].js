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
import { getSeriesDetail, getEpisodes } from '../../services/videoApi';

const SeriesDetailScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [series, setSeries] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const seriesResult = await getSeriesDetail(id);
      const episodesResult = await getEpisodes(id);

      if (seriesResult.success) {
        setSeries(seriesResult.data);
      }
      if (episodesResult.success) {
        setEpisodes(episodesResult.data);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
      Alert.alert('错误', '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEpisodePress = (episode) => {
    router.push(`/player/${episode.id}`);
  };

  const handleDownloadEpisode = (episode) => {
    // TODO: 实现视频下载功能
    Alert.alert('提示', `开始下载: ${episode.title}`);
  };

  const handleBatchDownload = () => {
    // TODO: 实现批量下载功能
    Alert.alert('提示', `开始批量下载 ${episodes.length} 集`);
  };

  const renderEpisodeCard = ({ item, index }) => (
    <TouchableOpacity
      style={styles.episodeCard}
      onPress={() => handleEpisodePress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.episodeNumber}>
        <Text style={styles.episodeNumberText}>
          {item.episodeNumber || index + 1}
        </Text>
      </View>
      <View style={styles.episodeInfo}>
        <Text style={styles.episodeTitle}>{item.title || `第${item.episodeNumber || index + 1}集`}</Text>
        {item.playUrl && (
          <Text style={styles.episodeUrl} numberOfLines={1}>
            {item.playUrl}
          </Text>
        )}
        <TouchableOpacity
          style={styles.downloadButton}
          onPress={(e) => {
            e.stopPropagation();
            handleDownloadEpisode(item);
          }}
        >
          <Text style={styles.downloadButtonText}>下载</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200EE" />
      </View>
    );
  }

  if (!series) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>短剧不存在</Text>
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
          source={{ uri: series.cover }}
          style={styles.cover}
        />

        <View style={styles.info}>
          <Text style={styles.title}>{series.title}</Text>
          
          <View style={styles.meta}>
            {series.rating && (
              <Text style={styles.rating}>⭐ {series.rating}</Text>
            )}
            {series.episodes && (
              <Text style={styles.episodes}>{series.episodes} 集</Text>
            )}
            {series.status && (
              <Text style={[
                styles.status,
                series.status === '完结' ? styles.completed : styles.ongoing
              ]}>
                {series.status}
              </Text>
            )}
          </View>

          {series.year && (
            <Text style={styles.metaText}>年份: {series.year}</Text>
          )}
          {series.director && (
            <Text style={styles.metaText}>导演: {series.director}</Text>
          )}
          {series.actors && series.actors.length > 0 && (
            <Text style={styles.metaText}>主演: {series.actors.join(', ')}</Text>
          )}

          {series.description && (
            <Text style={styles.description}>{series.description}</Text>
          )}

          <View style={styles.divider} />

          <View style={styles.episodesHeader}>
          <Text style={styles.episodesTitle}>剧集列表 ({episodes.length})</Text>
            {episodes.length > 0 && (
              <TouchableOpacity
                style={styles.batchDownloadButton}
                onPress={handleBatchDownload}
              >
                <Text style={styles.batchDownloadText}>批量下载</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <FlatList
          data={episodes}
          renderItem={({ item, index }) => renderEpisodeCard({ item, index })}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          contentContainerStyle={styles.episodesList}
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
    gap: 12,
    marginBottom: 16,
  },
  rating: {
    fontSize: 14,
    color: '#ff9800',
    fontWeight: '600',
  },
  episodes: {
    fontSize: 14,
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
  episodesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  episodesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  batchDownloadButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#6200EE',
    borderRadius: 6,
  },
  batchDownloadText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  episodesList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  episodeCard: {
    flexDirection: 'row',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    alignItems: 'center',
  },
  episodeNumber: {
    width: 50,
    height: 50,
    backgroundColor: '#6200EE',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 12,
    borderRadius: 25,
  },
  episodeNumberText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  episodeInfo: {
    flex: 1,
    padding: 12,
    paddingLeft: 0,
    justifyContent: 'space-between',
  },
  episodeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  episodeUrl: {
    fontSize: 11,
    color: '#999',
    marginBottom: 8,
  },
  metaText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  downloadButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    marginTop: 4,
  },
  downloadButtonText: {
    fontSize: 12,
    color: '#6200EE',
    fontWeight: '600',
  },
});

export default SeriesDetailScreen;
