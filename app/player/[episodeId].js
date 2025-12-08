import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  StatusBar,
  PanResponder,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { getEpisodeDetail, savePlaybackProgress } from '../../services/videoApi';
import videoDownloadManager from '../../services/videoDownloadManager';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const PlayerScreen = () => {
  const router = useRouter();
  const { episodeId } = useLocalSearchParams();
  
  const [episode, setEpisode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false); // 默认非全屏，在上半屏播放
  const [quality, setQuality] = useState('high'); // high, medium, low
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [draggedTime, setDraggedTime] = useState(0);
  const controlsTimeoutRef = useRef(null);
  const progressBarRef = useRef(null);

  // 使用 expo-video 的 useVideoPlayer hook
  // 注意：useVideoPlayer需要传入source URL，如果URL变化需要重新创建player
  const [videoSource, setVideoSource] = useState('');
  const player = useVideoPlayer(videoSource, (player) => {
    if (player) {
      console.log('=== 播放器初始化 ===');
      console.log('播放器对象:', player);
      console.log('视频源:', videoSource);
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
  
  // 监听视频源变化
  useEffect(() => {
    console.log('=== 视频源变化 ===');
    console.log('新视频源:', videoSource);
    if (videoSource) {
      console.log('视频源URL:', videoSource);
      console.log('视频源是否为代理URL:', videoSource.includes('/videos/proxy'));
      console.log('视频源是否为m3u8:', videoSource.includes('.m3u8') || videoSource.includes('m3u8'));
    }
  }, [videoSource]);

  useEffect(() => {
    loadEpisode();
  }, [episodeId]);

  // 当episode加载完成后，更新video source（如果还没有设置本地视频）
  useEffect(() => {
    if (episode?.videoUrl && !videoSource) {
      console.log('=== 更新视频源 ===');
      console.log('原始视频URL:', episode.videoUrl);
      setVideoSource(episode.videoUrl);
      console.log('视频源已设置');
    } else if (!episode?.videoUrl) {
      console.log('剧集数据中没有视频URL');
    }
  }, [episode?.videoUrl, videoSource]);

  // 监听播放状态和进度
  useEffect(() => {
    if (!player) return;

    const interval = setInterval(() => {
      try {
        // expo-video: playing是属性，currentTime和duration也是属性
        if (player.playing) {
          const currentTime = player.currentTime || 0;
          const duration = player.duration || 0;
          
          // 每 5 秒保存一次进度
          if (duration > 0 && Math.floor(currentTime) % 5 === 0 && Math.floor(currentTime) > 0) {
            savePlaybackProgress(episodeId, currentTime, duration);
          }
        }
      } catch (error) {
        console.error('获取播放状态失败:', error);
      }
    }, 1000); // 改为每秒检查一次，减少频率

    return () => clearInterval(interval);
  }, [player, episodeId]);

  const loadEpisode = async () => {
    setLoading(true);
    try {
      console.log('=== 开始加载剧集 ===');
      console.log('剧集ID:', episodeId);
      
      const result = await getEpisodeDetail(episodeId);
      console.log('剧集详情响应:', result);
      
      if (result.success) {
        setEpisode(result.data);
        console.log('=== 剧集加载成功 ===');
        console.log('剧集数据:', result.data);
        console.log('视频URL:', result.data.videoUrl);
        console.log('视频URL类型:', typeof result.data.videoUrl);
        console.log('视频URL是否为空:', !result.data.videoUrl);
        console.log('视频URL是否为代理URL:', result.data.videoUrl?.includes('/videos/proxy'));
        
        // 检查是否有本地下载的视频（优先使用本地文件）
        const seriesId = result.data.seriesId || result.data.series_id;
        const localVideoUri = await videoDownloadManager.getLocalVideoUri(seriesId, episodeId);
        if (localVideoUri) {
          console.log('=== 找到本地视频，优先使用本地文件 ===');
          console.log('本地视频路径:', localVideoUri);
          setVideoSource(localVideoUri);
          return;
        } else {
          console.log('未找到本地视频，使用在线URL');
        }
        
        if (!result.data.videoUrl) {
          console.error('视频URL为空');
          Alert.alert('提示', '未找到视频播放链接，可能需要使用播放页面URL');
        }
      } else {
        console.error('获取剧集详情失败:', result.error);
        Alert.alert('错误', result.error || '加载剧集失败');
      }
    } catch (error) {
      console.error('=== 加载剧集异常 ===');
      console.error('错误信息:', error);
      console.error('错误堆栈:', error.stack);
      Alert.alert('错误', '加载剧集失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPause = () => {
    if (player) {
      try {
        // expo-video: 使用 play() 和 pause() 方法控制播放
        if (player.playing) {
          player.pause();
        } else {
          player.play();
        }
      } catch (error) {
        console.error('播放控制失败:', error);
      }
    }
  };

  const handleControlsPress = () => {
    setShowControls(!showControls);
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }

    if (!showControls) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  const handleProgressPress = (event) => {
    if (!progressBarRef.current || !player) return;
    
    progressBarRef.current.measure((x, y, width) => {
      const touchX = event.nativeEvent.locationX;
      const percentage = touchX / width;
      const newTime = percentage * player.duration;
      
      setIsDraggingProgress(true);
      setDraggedTime(newTime);
    });
  };

  const handleProgressRelease = () => {
    if (player && isDraggingProgress) {
      try {
        // expo-video: currentTime是属性，直接设置
        player.currentTime = draggedTime;
        setIsDraggingProgress(false);
      } catch (error) {
        console.error('设置播放进度失败:', error);
      setIsDraggingProgress(false);
      }
    }
  };

  const handleQualitySelect = (selectedQuality) => {
    setQuality(selectedQuality);
    setShowQualityMenu(false);
    Alert.alert('清晰度已切换', `已切换至${selectedQuality === 'high' ? '高' : selectedQuality === 'medium' ? '中' : '低'}清晰度`);
  };

  const handleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!episode) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>剧集不存在</Text>
      </View>
    );
  }

  // 非全屏时，视频容器占屏幕上半部分（16:9比例）
  const videoContainerWidth = SCREEN_WIDTH;
  const videoContainerHeight = isFullscreen ? SCREEN_HEIGHT : SCREEN_WIDTH * 0.5625; // 16:9比例

  return (
    <SafeAreaView style={[styles.container, isFullscreen && styles.fullscreenContainer]} edges={isFullscreen ? [] : ['top']}>
      <StatusBar hidden={isFullscreen} barStyle="light-content" />
      
      <TouchableOpacity
        style={[
          styles.videoContainer,
          {
            width: videoContainerWidth,
            height: videoContainerHeight,
          }
        ]}
        onPress={handleControlsPress}
        activeOpacity={1}
      >
        {player ? (
          <VideoView
            player={player}
          style={styles.video}
            nativeControls={false}
            contentFit="contain"
            onLoadStart={() => {
              console.log('=== 视频开始加载 ===');
              console.log('视频源:', videoSource);
            }}
            onLoad={(event) => {
              console.log('=== 视频加载完成 ===');
              console.log('加载事件:', event);
              console.log('视频源:', videoSource);
            }}
            onError={(error) => {
              console.error('=== 视频加载错误 ===');
              console.error('错误信息:', error);
              console.error('视频源:', videoSource);
              Alert.alert('播放错误', '视频加载失败，请检查网络连接或视频链接');
            }}
          />
        ) : (
          <View style={styles.video}>
            <Text style={{ color: '#fff', textAlign: 'center', padding: 20 }}>
              正在初始化播放器...
            </Text>
          </View>
        )}

        {showControls && (
          <View style={styles.controls}>
            <View style={styles.topControls}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <Text style={styles.backButtonText}>← 返回</Text>
              </TouchableOpacity>
              
              <View style={styles.qualityContainer}>
                <TouchableOpacity
                  style={styles.qualityButton}
                  onPress={() => setShowQualityMenu(!showQualityMenu)}
                >
                  <Text style={styles.qualityButtonText}>
                    {quality === 'high' ? '高清' : quality === 'medium' ? '标清' : '流畅'}
                  </Text>
                </TouchableOpacity>
                
                {showQualityMenu && (
                  <View style={styles.qualityMenu}>
                    <TouchableOpacity
                      style={[styles.qualityOption, quality === 'high' && styles.qualityOptionActive]}
                      onPress={() => handleQualitySelect('high')}
                    >
                      <Text style={styles.qualityOptionText}>高清</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.qualityOption, quality === 'medium' && styles.qualityOptionActive]}
                      onPress={() => handleQualitySelect('medium')}
                    >
                      <Text style={styles.qualityOptionText}>标清</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.qualityOption, quality === 'low' && styles.qualityOptionActive]}
                      onPress={() => handleQualitySelect('low')}
                    >
                      <Text style={styles.qualityOptionText}>流畅</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.centerControls}>
              <TouchableOpacity
                style={styles.playButton}
                onPress={handlePlayPause}
              >
                <Text style={styles.playButtonText}>
                  {player?.playing ? '⏸' : '▶'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.bottomControls}>
              <View style={styles.progressContainer}>
                <Text style={styles.timeText}>
                  {formatTime(isDraggingProgress ? draggedTime : (player?.currentTime || 0))}
                </Text>
                <TouchableOpacity
                  ref={progressBarRef}
                  style={styles.progressBar}
                  onPress={handleProgressPress}
                  onPressOut={handleProgressRelease}
                >
                  <View
                    style={[
                      styles.progressFill,
                      { 
                        width: `${player?.duration ? (((isDraggingProgress ? draggedTime : (player.currentTime || 0)) / player.duration) * 100) : 0}%` 
                      }
                    ]}
                  />
                  <View
                    style={[
                      styles.progressDot,
                      { 
                        left: `${player?.duration ? (((isDraggingProgress ? draggedTime : (player.currentTime || 0)) / player.duration) * 100) : 0}%` 
                      }
                    ]}
                  />
                </TouchableOpacity>
                <Text style={styles.timeText}>{formatTime(player?.duration || 0)}</Text>
              </View>

              <View style={styles.bottomButtonsContainer}>
                <TouchableOpacity
                  style={styles.fullscreenButton}
                  onPress={handleFullscreen}
                >
                  <Text style={styles.fullscreenButtonText}>
                    {isFullscreen ? '退出全屏' : '全屏'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </TouchableOpacity>

      <View style={[styles.infoContainer, isFullscreen && styles.infoContainerFullscreen]}>
        <Text style={styles.episodeTitle}>{episode.title}</Text>
        {!isFullscreen && (
          <>
            <Text style={styles.episodeDescription}>{episode.description}</Text>
            <Text style={styles.episodeDuration}>
              时长: {formatTime(episode.duration)}
            </Text>
          </>
        )}
        {isFullscreen && (
          <Text style={styles.episodeDescriptionCompact}>{episode.description}</Text>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullscreenContainer: {
    backgroundColor: '#000',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  errorText: {
    fontSize: 16,
    color: '#fff',
  },
  videoContainer: {
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  controls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  centerControls: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomControls: {
    gap: 8,
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 4,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  qualityContainer: {
    position: 'relative',
  },
  qualityButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#6200EE',
    borderRadius: 4,
  },
  qualityButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  qualityMenu: {
    position: 'absolute',
    top: 40,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 4,
    overflow: 'hidden',
    minWidth: 80,
  },
  qualityOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  qualityOptionActive: {
    backgroundColor: '#6200EE',
  },
  qualityOptionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6200EE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonText: {
    fontSize: 28,
    color: '#fff',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    minWidth: 40,
    fontWeight: '500',
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    overflow: 'visible',
    justifyContent: 'center',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6200EE',
    borderRadius: 3,
  },
  progressDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    top: -3,
    marginLeft: -6,
  },
  bottomButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  fullscreenButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 4,
  },
  fullscreenButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  infoContainer: {
    padding: 16,
    backgroundColor: '#fff',
    maxHeight: SCREEN_HEIGHT * 0.4, // 限制最大高度，确保视频在上半屏
  },
  infoContainerFullscreen: {
    flex: 0,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a1a',
    height: 80,
  },
  episodeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  episodeDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
    marginBottom: 12,
  },
  episodeDescriptionCompact: {
    fontSize: 12,
    color: '#999',
    lineHeight: 18,
  },
  episodeDuration: {
    fontSize: 12,
    color: '#999',
  },
});

export default PlayerScreen;
