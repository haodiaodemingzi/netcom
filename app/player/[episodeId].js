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
import { Video } from 'expo-av';
import { getEpisodeDetail, savePlaybackProgress } from '../../services/videoApi';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const PlayerScreen = () => {
  const router = useRouter();
  const { episodeId } = useLocalSearchParams();
  const videoRef = useRef(null);
  
  const [episode, setEpisode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(true); // 默认全屏
  const [quality, setQuality] = useState('high'); // high, medium, low
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [draggedTime, setDraggedTime] = useState(0);
  const controlsTimeoutRef = useRef(null);
  const progressBarRef = useRef(null);

  useEffect(() => {
    loadEpisode();
  }, [episodeId]);

  const loadEpisode = async () => {
    setLoading(true);
    try {
      const result = await getEpisodeDetail(episodeId);
      if (result.success) {
        setEpisode(result.data);
        console.log('剧集加载成功:', result.data.title);
      } else {
        Alert.alert('错误', '加载剧集失败');
      }
    } catch (error) {
      console.error('加载剧集失败:', error);
      Alert.alert('错误', '加载剧集失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      setCurrentTime(status.positionMillis / 1000);
      setDuration(status.durationMillis / 1000);
      setIsPlaying(status.isPlaying);

      // 每 5 秒保存一次进度
      if (Math.floor(status.positionMillis / 1000) % 5 === 0) {
        savePlaybackProgress(episodeId, status.positionMillis / 1000, status.durationMillis / 1000);
      }
    }
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pauseAsync();
      } else {
        videoRef.current.playAsync();
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
    if (!progressBarRef.current) return;
    
    progressBarRef.current.measure((x, y, width) => {
      const touchX = event.nativeEvent.locationX;
      const percentage = touchX / width;
      const newTime = percentage * duration;
      
      setIsDraggingProgress(true);
      setDraggedTime(newTime);
    });
  };

  const handleProgressRelease = async () => {
    if (videoRef.current && isDraggingProgress) {
      await videoRef.current.setPositionAsync(draggedTime * 1000);
      setIsDraggingProgress(false);
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

  const videoContainerHeight = isFullscreen ? SCREEN_HEIGHT - 80 : SCREEN_WIDTH * 0.5625;
  const videoContainerWidth = SCREEN_WIDTH;

  return (
    <View style={[styles.container, isFullscreen && styles.fullscreenContainer]}>
      <StatusBar hidden={isFullscreen} />
      
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
        <Video
          ref={videoRef}
          source={{ uri: episode.videoUrl }}
          style={styles.video}
          useNativeControls={false}
          resizeMode="contain"
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          progressUpdateIntervalMillis={500}
        />

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
                  {isPlaying ? '⏸' : '▶'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.bottomControls}>
              <View style={styles.progressContainer}>
                <Text style={styles.timeText}>{formatTime(isDraggingProgress ? draggedTime : currentTime)}</Text>
                <TouchableOpacity
                  ref={progressBarRef}
                  style={styles.progressBar}
                  onPress={handleProgressPress}
                  onPressOut={handleProgressRelease}
                >
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${((isDraggingProgress ? draggedTime : currentTime) / duration) * 100}%` }
                    ]}
                  />
                  <View
                    style={[
                      styles.progressDot,
                      { left: `${((isDraggingProgress ? draggedTime : currentTime) / duration) * 100}%` }
                    ]}
                  />
                </TouchableOpacity>
                <Text style={styles.timeText}>{formatTime(duration)}</Text>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'space-between',
  },
  fullscreenContainer: {
    backgroundColor: '#000',
    justifyContent: 'space-between',
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
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
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
