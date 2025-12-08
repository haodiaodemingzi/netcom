import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getSeriesList, setVideoDataSource, getVideoDataSource } from '../../services/videoApi';
import { useToast } from '../../components/MessageToast';

const SeriesScreen = () => {
  const router = useRouter();
  const toast = useToast();
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState(getVideoDataSource());

  useEffect(() => {
    loadSeries();
  }, [dataSource]);

  const loadSeries = async () => {
    setLoading(true);
    try {
      const result = await getSeriesList();
      if (result.success) {
        setSeries(result.data);
      } else {
        toast.error('加载短剧列表失败');
      }
    } catch (error) {
      console.error('加载短剧失败:', error);
      toast.error('加载短剧失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSeriesPress = (item) => {
    router.push(`/series/${item.id}`);
  };

  const handleSwitchDataSource = () => {
    const newSource = dataSource === 'mock' ? 'api' : 'mock';
    setVideoDataSource(newSource);
    setDataSource(newSource);
    toast.success(`已切换到 ${newSource === 'mock' ? 'Mock 数据' : 'API 数据'} 源`);
  };

  const renderSeriesCard = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleSeriesPress(item)}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: item.cover }}
        style={styles.cover}
      />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
        <View style={styles.meta}>
          <Text style={styles.rating}>⭐ {item.rating}</Text>
          <Text style={styles.episodes}>{item.episodes} 集</Text>
          <Text style={[styles.status, item.status === '完结' ? styles.completed : styles.ongoing]}>
            {item.status}
          </Text>
        </View>
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>短剧</Text>
        <TouchableOpacity
          style={styles.sourceButton}
          onPress={handleSwitchDataSource}
        >
          <Text style={styles.sourceButtonText}>
            {dataSource === 'mock' ? 'Mock' : 'API'}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={series}
        renderItem={renderSeriesCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  sourceButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#6200EE',
    borderRadius: 4,
  },
  sourceButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 12,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cover: {
    width: 120,
    height: 160,
    backgroundColor: '#e0e0e0',
  },
  info: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rating: {
    fontSize: 12,
    color: '#ff9800',
    fontWeight: '600',
  },
  episodes: {
    fontSize: 12,
    color: '#999',
  },
  status: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  completed: {
    backgroundColor: '#e8f5e9',
    color: '#4caf50',
  },
  ongoing: {
    backgroundColor: '#fff3e0',
    color: '#ff9800',
  },
});

export default SeriesScreen;
