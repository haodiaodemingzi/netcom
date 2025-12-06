import React, { useState, useEffect, useRef } from 'react';
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
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { getSeriesDetail, getEpisodes, getEpisodeDetail } from '../../services/videoApi';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SeriesDetailScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [series, setSeries] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playingEpisode, setPlayingEpisode] = useState(null);
  const [videoSource, setVideoSource] = useState('');
  const [showPlayer, setShowPlayer] = useState(false);
  
  // 视频播放器 - useVideoPlayer会自动响应videoSource的变化
  const player = useVideoPlayer(videoSource || null, (player) => {
    if (player) {
      console.log('=== 播放器初始化/更新 ===');
      console.log('播放器对象:', player);
      console.log('当前视频源:', videoSource);
      player.loop = false;
      player.muted = false;
      
      // 监听播放器状态
      try {
        console.log('播放器状态 - playing:', player.playing);
        console.log('播放器状态 - currentTime:', player.currentTime);
        console.log('播放器状态 - duration:', player.duration);
      } catch (e) {
        console.error('获取播放器状态失败:', e);
      }
    } else {
      console.log('播放器未初始化，视频源:', videoSource);
    }
  });
  
  // 监听视频源变化，确保播放器正确更新
  useEffect(() => {
    console.log('=== 视频源变化 ===');
    console.log('新视频源:', videoSource);
    if (videoSource) {
      console.log('视频源URL:', videoSource);
      console.log('视频源是否为代理URL:', videoSource.includes('/videos/proxy'));
      console.log('视频源是否为m3u8:', videoSource.includes('.m3u8') || videoSource.includes('m3u8'));
      console.log('播放器状态:', player ? '已初始化' : '未初始化');
      if (player) {
        console.log('播放器当前源:', player.source || 'N/A');
      }
    } else {
      console.log('视频源为空，播放器将被重置');
    }
  }, [videoSource, player]);
  
  // 当播放器准备好且视频源存在时，自动播放
  useEffect(() => {
    if (player && videoSource && showPlayer) {
      // 延迟一下确保播放器完全初始化
      const timer = setTimeout(() => {
        try {
          if (player.duration > 0 && !player.playing) {
            player.playing = true;
            console.log('自动开始播放视频');
          }
        } catch (e) {
          console.error('自动播放失败:', e);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [player, videoSource, showPlayer]);
  
  // 监听播放器状态
  useEffect(() => {
    if (!player) return;
    
    const interval = setInterval(() => {
      try {
        const playing = player.playing;
        const currentTime = player.currentTime || 0;
        const duration = player.duration || 0;
        
        if (playing && currentTime > 0) {
          console.log('播放中 - 当前时间:', currentTime, '总时长:', duration);
        }
      } catch (error) {
        console.error('获取播放器状态失败:', error);
      }
    }, 2000); // 每2秒检查一次
    
    return () => clearInterval(interval);
  }, [player]);

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

  const handleEpisodePress = async (episode) => {
    try {
      console.log('=== 开始加载剧集 ===');
      console.log('剧集ID:', episode.id);
      console.log('剧集信息:', episode);
      
      // 加载剧集详情获取视频URL
      console.log('正在调用后端API获取剧集详情...');
      console.log('API路径:', `/videos/episodes/${episode.id}?source=thanju`);
      
      const result = await getEpisodeDetail(episode.id);
      console.log('=== 后端API响应 ===');
      console.log('响应结果:', JSON.stringify(result, null, 2));
      
      if (result.success && result.data) {
        console.log('=== 剧集数据解析 ===');
        console.log('剧集数据:', result.data);
        console.log('视频URL (原始):', result.data.videoUrl);
        console.log('视频URL类型:', typeof result.data.videoUrl);
        console.log('视频URL是否为空:', !result.data.videoUrl);
        console.log('视频URL是否为null:', result.data.videoUrl === null);
        console.log('播放页面URL:', result.data.playUrl);
        
        if (result.data.videoUrl) {
          console.log('=== 设置视频源 ===');
          console.log('视频URL (转换后):', result.data.videoUrl);
          console.log('是否为代理URL:', result.data.videoUrl.includes('/videos/proxy'));
          
          // 先设置播放的剧集信息
          setPlayingEpisode(result.data);
          
          // 然后设置视频源（这会触发播放器更新）
          setVideoSource(result.data.videoUrl);
          
          // 最后显示播放器
          setShowPlayer(true);
          console.log('播放器已显示，等待视频加载...');
          console.log('当前videoSource状态:', result.data.videoUrl);
        } else {
          console.error('=== 视频URL为空 ===');
          console.error('可能的原因:');
          console.error('1. 播放页面返回错误（剧集可能不存在）');
          console.error('2. 播放页面结构发生变化');
          console.error('3. 需要特殊的请求头或Cookie');
          console.error('4. 后端解析失败');
          console.error('播放页面URL:', result.data.playUrl);
          Alert.alert(
            '无法播放', 
            `该剧集暂时无法播放。\n\n播放页面: ${result.data.playUrl || '未知'}\n\n可能原因：\n- 剧集资源不存在\n- 播放页面异常\n- 后端解析失败\n\n请尝试其他剧集。`
          );
        }
      } else {
        console.error('=== 获取剧集详情失败 ===');
        console.error('错误信息:', result.error || '未知错误');
        console.error('完整响应:', result);
        Alert.alert('提示', result.error || '无法获取视频播放链接');
      }
    } catch (error) {
      console.error('=== 加载剧集详情异常 ===');
      console.error('错误信息:', error);
      console.error('错误消息:', error.message);
      console.error('错误堆栈:', error.stack);
      Alert.alert('错误', '加载视频失败: ' + error.message);
    }
  };

  const handleClosePlayer = () => {
    setShowPlayer(false);
    setPlayingEpisode(null);
    setVideoSource('');
    if (player) {
      try {
        player.playing = false;
      } catch (e) {
        console.error('停止播放失败:', e);
      }
    }
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
        {/* 封面/播放器区域 - 合并显示 */}
        <View style={styles.coverContainer}>
          {showPlayer && playingEpisode && videoSource && player ? (
            <View style={styles.playerWrapper}>
              <View style={styles.playerHeader}>
                <Text style={styles.playerTitle}>{playingEpisode.title}</Text>
                <TouchableOpacity onPress={handleClosePlayer} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
              <VideoView
                player={player}
                style={styles.videoPlayer}
                nativeControls={true}
                contentFit="contain"
                onLoadStart={() => {
                  console.log('=== 视频开始加载 ===');
                  console.log('视频源:', videoSource);
                  console.log('播放器源:', player.source || 'N/A');
                }}
                onLoad={(event) => {
                  console.log('=== 视频加载完成 ===');
                  console.log('加载事件:', event);
                  console.log('视频源:', videoSource);
                  console.log('播放器状态 - duration:', player.duration);
                  console.log('播放器状态 - playing:', player.playing);
                  // 视频加载完成后自动播放
                  if (player && !player.playing) {
                    try {
                      player.playing = true;
                      console.log('已自动开始播放');
                    } catch (e) {
                      console.error('自动播放失败:', e);
                    }
                  }
                }}
                onError={(error) => {
                  console.error('=== 视频加载错误 ===');
                  console.error('错误信息:', error);
                  console.error('错误详情:', JSON.stringify(error, null, 2));
                  console.error('视频源:', videoSource);
                  console.error('播放器源:', player.source || 'N/A');
                  Alert.alert('播放错误', `视频加载失败\n\n视频源: ${videoSource}\n\n请检查网络连接或视频链接`);
                }}
              />
            </View>
          ) : showPlayer && playingEpisode && videoSource ? (
            <View style={styles.videoPlayer}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={{ color: '#fff', textAlign: 'center', padding: 20, marginTop: 10 }}>
                正在初始化播放器...
              </Text>
            </View>
          ) : (
            <Image
              source={{ uri: series.cover }}
              style={styles.cover}
              resizeMode="cover"
            />
          )}
        </View>

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
  coverContainer: {
    width: '100%',
    height: 300,
    backgroundColor: '#000',
    position: 'relative',
  },
  playerWrapper: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  playerContainer: {
    backgroundColor: '#000',
    paddingTop: 8,
    paddingBottom: 8,
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1a1a1a',
  },
  playerTitle: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
});

export default SeriesDetailScreen;
