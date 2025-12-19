import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  StatusBar,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { getCurrentVideoSource, getEpisodeDetail, getEpisodes, savePlaybackProgress, setCurrentVideoSource } from '../../services/videoApi';
import { getSettings, saveSettings } from '../../services/storage';
import videoDownloadManager from '../../services/videoDownloadManager';
import videoPlayerService from '../../services/videoPlayerService';
import FullScreenLoader from '../../components/FullScreenLoader';

const PlayerScreen = () => {
  const router = useRouter();
  const { episodeId, source } = useLocalSearchParams();
  
  // 使用 useWindowDimensions 动态获取屏幕尺寸（支持横竖屏切换）
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  
  const [episode, setEpisode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false); // 默认非全屏，在上半屏播放
  const [quality, setQuality] = useState('high'); // high, medium, low
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [videoFitMode, setVideoFitMode] = useState('contain'); // contain, cover, fill
  const [orientationMode, setOrientationMode] = useState('auto');
  const controlsTimeoutRef = useRef(null);
  const pinchScaleRef = useRef(1);
  const playToEndHandledRef = useRef(false);
  const lastSwitchEpisodeIdRef = useRef(null);
  const lastSwitchAtRef = useRef(0);

  const getOrientationModeLabel = (mode) => {
    if (mode === 'portrait') return '竖屏';
    if (mode === 'landscape') return '横屏';
    return '自动';
  };

  const applyOrientationMode = async (mode) => {
    const safeMode = mode || 'auto';
    if (safeMode === 'portrait') {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      return;
    }
    if (safeMode === 'landscape') {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      return;
    }
    await ScreenOrientation.unlockAsync();
  };

  const persistOrientationMode = async (mode) => {
    const safeMode = mode || 'auto';
    const settings = await getSettings();
    await saveSettings({
      ...(settings || {}),
      videoOrientationMode: safeMode,
    });
  };

  // 使用 expo-video 的 useVideoPlayer hook
  // 注意：useVideoPlayer需要传入source URL，如果URL变化需要重新创建player
  const [videoSource, setVideoSource] = useState('');
  const [seriesEpisodes, setSeriesEpisodes] = useState([]);
  const [seriesId, setSeriesId] = useState(null);
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

  const extractEpisodeNumber = (title) => {
    if (!title) return 0;
    const match = String(title).match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  const sortedEpisodes = React.useMemo(() => {
    if (!Array.isArray(seriesEpisodes)) return [];
    return [...seriesEpisodes].sort((a, b) => {
      const numA = extractEpisodeNumber(a?.title || '');
      const numB = extractEpisodeNumber(b?.title || '');
      return numA - numB;
    });
  }, [seriesEpisodes]);

  const currentEpisodeIndex = React.useMemo(() => {
    if (!episodeId) return -1;
    return sortedEpisodes.findIndex(e => e?.id === episodeId);
  }, [sortedEpisodes, episodeId]);

  const hasPrevEpisode = currentEpisodeIndex > 0;
  const hasNextEpisode = currentEpisodeIndex >= 0 && currentEpisodeIndex < sortedEpisodes.length - 1;

  const canSkipIntro = React.useMemo(() => {
    if (!player) return false;
    return true;
  }, [player]);

  const loadSeriesEpisodes = async (sid) => {
    if (!sid) {
      setSeriesEpisodes([]);
      return;
    }
    try {
      const result = await getEpisodes(sid);
      if (!result?.success) {
        setSeriesEpisodes([]);
        return;
      }
      setSeriesEpisodes(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      console.error('加载系列剧集列表失败', {
        seriesId: sid,
        episodeId,
        error,
      });
      setSeriesEpisodes([]);
    }
  };

  useEffect(() => {
    loadSeriesEpisodes(seriesId);
  }, [seriesId]);

  const switchEpisodeByIndex = (index) => {
    if (index < 0) return;
    if (index >= sortedEpisodes.length) return;
    const target = sortedEpisodes[index];
    if (!target?.id) return;

    const now = Date.now();
    if (lastSwitchEpisodeIdRef.current === target.id && now - lastSwitchAtRef.current < 300) return;
    lastSwitchEpisodeIdRef.current = target.id;
    lastSwitchAtRef.current = now;

    setVideoSource('');
    router.replace(`/player/${target.id}`);
  };

  const handlePrevEpisode = () => {
    if (!hasPrevEpisode) return;
    switchEpisodeByIndex(currentEpisodeIndex - 1);
  };

  const handleNextEpisode = () => {
    if (!hasNextEpisode) {
      Alert.alert('提示', '已经是最后一集');
      return;
    }
    switchEpisodeByIndex(currentEpisodeIndex + 1);
  };

  const handleSkipIntro = () => {
    if (!player) return;
    const targetSeconds = 90;
    const safeCurrent = Number.isFinite(player.currentTime) ? player.currentTime : 0;
    const safeDuration = Number.isFinite(player.duration) ? player.duration : 0;
    const safeTarget = safeDuration > 0
      ? Math.min(targetSeconds, Math.max(0, safeDuration - 1))
      : targetSeconds;

    const delta = safeTarget - safeCurrent;
    if (delta <= 0.5) return;

    try {
      player.seekBy(delta);
    } catch (error) {
      console.error('跳过片头失败', {
        seriesId,
        episodeId,
        safeTarget,
        safeCurrent,
        error,
      });
      try {
        player.currentTime = safeTarget;
      } catch (error2) {
        console.error('跳过片头回退失败', {
          seriesId,
          episodeId,
          safeTarget,
          safeCurrent,
          error: error2,
        });
      }
    }
  };

  useEffect(() => {
    if (!player) return;
    if (!player.addListener) return;

    const subscription = player.addListener('playToEnd', () => {
      if (playToEndHandledRef.current) return;
      playToEndHandledRef.current = true;
      if (!hasNextEpisode) {
        Alert.alert('提示', '已经是最后一集');
        return;
      }
      switchEpisodeByIndex(currentEpisodeIndex + 1);
    });

    return () => {
      if (!subscription?.remove) return;
      subscription.remove();
    };
  }, [player, hasNextEpisode, currentEpisodeIndex, sortedEpisodes]);
  
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

  useEffect(() => {
    const nextSource = typeof source === 'string' ? source.trim() : '';
    if (!nextSource) return;
    setCurrentVideoSource(nextSource);
  }, [source]);

  useEffect(() => {
    playToEndHandledRef.current = false;
  }, [episodeId]);

  useEffect(() => {
    const initOrientation = async () => {
      const settings = await getSettings();
      const mode = settings?.videoOrientationMode || 'auto';
      setOrientationMode(mode);
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };

    initOrientation().catch((e) => {
      console.warn('初始化方向模式失败', e);
    });

    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch((e) => {
        console.warn('退出播放器恢复竖屏失败', e);
      });
    };
  }, []);

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

      const routeSource = typeof source === 'string' ? source.trim() : '';
      const sourceToUse = routeSource || getCurrentVideoSource() || 'thanju';
      if (routeSource) {
        setCurrentVideoSource(routeSource);
      }
      
      // 1. 先获取配置并访问 cookie_url
      try {
        const encodedSource = encodeURIComponent(sourceToUse);
        const configResponse = await fetch(
          `${process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:5000/api'}/videos/episodes/${episodeId}/config?source=${encodedSource}`
        );
        
        if (configResponse.ok) {
          const configData = await configResponse.json();
          if (configData.success && configData.data?.cookie_url) {
            console.log('访问入口页面获取Cookie:', configData.data.cookie_url);
            await fetch(configData.data.cookie_url, {
              method: 'GET',
              credentials: 'include',
              headers: configData.data.headers || {},
            });
            console.log('✓ Cookie 预加载完成');
          }
        }
      } catch (error) {
        console.warn('获取Cookie失败（继续加载）:', error);
      }
      
      // 2. 加载剧集详情
      const result = await getEpisodeDetail(episodeId, sourceToUse);
      console.log('剧集详情响应:', result);
      
      if (result.success) {
        setEpisode(result.data);
        const nextSeriesId = result.data?.seriesId || result.data?.series_id || null;
        setSeriesId(nextSeriesId);
        console.log('=== 剧集加载成功 ===');
        console.log('剧集数据:', result.data);
        console.log('视频URL:', result.data.videoUrl);
        
        if (!result.data.videoUrl) {
          console.error('视频URL为空');
          Alert.alert('提示', '未找到视频播放链接，可能需要使用播放页面URL');
          return;
        }
        
        // 使用统一的视频播放服务获取播放URL
        try {
          const playUrlInfo = await videoPlayerService.getPlayUrlFromEpisode(
            episodeId,
            result.data,
            sourceToUse
          );
          
          console.log('=== 视频播放URL信息 ===');
          console.log('最终URL:', playUrlInfo.url);
          console.log('是否本地:', playUrlInfo.isLocal);
          console.log('视频类型:', playUrlInfo.videoType);
          
          setVideoSource(playUrlInfo.url);
        } catch (error) {
          console.error('获取视频播放URL失败:', error);
          Alert.alert('错误', '无法获取视频播放地址: ' + error.message);
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
    setShowControls(prev => !prev);
    
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }

    // 显示后 4 秒自动隐藏
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 4000);
  };

  const handleQualitySelect = (selectedQuality) => {
    setQuality(selectedQuality);
    setShowQualityMenu(false);
    Alert.alert('清晰度已切换', `已切换至${selectedQuality === 'high' ? '高' : selectedQuality === 'medium' ? '中' : '低'}清晰度`);
  };

  const handleFullscreen = async () => {
    const nextFullscreen = !isFullscreen;
    if (nextFullscreen) {
      try {
        await applyOrientationMode(orientationMode);
      } catch (e) {
        console.warn('进入全屏应用方向模式失败', e);
      }
    } else {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch((e) => {
        console.warn('退出全屏恢复竖屏失败', e);
      });
    }
    setIsFullscreen(nextFullscreen);
  };

  const handleToggleOrientationMode = async () => {
    const modes = ['auto', 'portrait', 'landscape'];
    const currentIndex = modes.indexOf(orientationMode);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % modes.length : 0;
    const nextMode = modes[nextIndex];
    setOrientationMode(nextMode);
    try {
      await persistOrientationMode(nextMode);
      if (!isFullscreen) return;
      await applyOrientationMode(nextMode);
    } catch (e) {
      console.warn('切换方向模式失败', e);
    }
  };

  // 切换视频缩放模式
  const handleVideoFitMode = () => {
    const modes = ['contain', 'cover', 'fill'];
    const modeNames = { contain: '适应', cover: '填充', fill: '拉伸' };
    const currentIndex = modes.indexOf(videoFitMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    const nextMode = modes[nextIndex];
    setVideoFitMode(nextMode);
  };

  const getVideoFitModeName = () => {
    const modeNames = { contain: '适应', cover: '填充', fill: '拉伸' };
    return modeNames[videoFitMode] || '适应';
  };

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      pinchScaleRef.current = 1;
    })
    .onUpdate((event) => {
      pinchScaleRef.current = event.scale;
    })
    .onEnd((event) => {
      const scale = event.scale;
      if (scale > 1.1) {
        setVideoFitMode('cover');
      } else if (scale < 0.9) {
        setVideoFitMode('contain');
      }
      pinchScaleRef.current = 1;
    });

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return <FullScreenLoader variant="detail" theme="dark" accentColor="#6200EE" />;
  }

  if (!episode) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>剧集不存在</Text>
      </View>
    );
  }

  // 非全屏时，视频容器占16:9比例
  const videoContainerWidth = screenWidth;
  const videoContainerHeight = isFullscreen ? screenHeight : screenWidth * 0.5625; // 16:9比例

  return (
    <SafeAreaView style={[styles.container, isFullscreen && styles.fullscreenContainer]} edges={isFullscreen ? [] : ['top']}>
      <StatusBar hidden={isFullscreen} barStyle="light-content" />
      
      {/* 视频播放区域 */}
      <GestureDetector gesture={pinchGesture}>
        <Pressable
          style={[
            styles.videoContainer,
            {
              width: screenWidth,
              height: isFullscreen ? screenHeight : screenWidth * 0.5625,
            }
          ]}
          onPress={handleControlsPress}
        >
          {/* 视频播放器 */}
          {player ? (
            <VideoView
              player={player}
              style={StyleSheet.absoluteFill}
              nativeControls={false}
              contentFit={videoFitMode}
            />
          ) : (
            <View style={styles.loadingVideo}>
              <Text style={{ color: '#fff' }}>正在初始化播放器...</Text>
            </View>
          )}

          {/* 控制栏覆盖层 */}
          {showControls && (
            <View style={styles.controlsOverlay}>
              {/* 顶部控制栏 */}
              <View style={styles.topBar}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                  <Text style={styles.btnText}>← 返回</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.qualityBtn} onPress={() => setShowQualityMenu(!showQualityMenu)}>
                  <Text style={styles.btnText}>{quality === 'high' ? '高清' : quality === 'medium' ? '标清' : '流畅'}</Text>
                </TouchableOpacity>
              </View>

              {/* 中间播放按钮 */}
              <View style={styles.centerArea}>
                <TouchableOpacity style={styles.playBtn} onPress={handlePlayPause}>
                  <Text style={styles.playBtnText}>{player?.playing ? '⏸' : '▶'}</Text>
                </TouchableOpacity>
              </View>

              {/* 底部控制栏 */}
              <View style={styles.bottomBar}>
                <View style={styles.progressRow}>
                  <Text style={styles.timeText}>{formatTime(player?.currentTime || 0)}</Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${player?.duration ? ((player.currentTime || 0) / player.duration * 100) : 0}%` }]} />
                  </View>
                  <Text style={styles.timeText}>{formatTime(player?.duration || 0)}</Text>
                </View>
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, !hasPrevEpisode && styles.actionBtnDisabled]}
                    onPress={handlePrevEpisode}
                    disabled={!hasPrevEpisode}
                  >
                    <Text style={styles.btnText}>上一集</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, !hasNextEpisode && styles.actionBtnDisabled]}
                    onPress={handleNextEpisode}
                    disabled={!hasNextEpisode}
                  >
                    <Text style={styles.btnText}>下一集</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, !canSkipIntro && styles.actionBtnDisabled]}
                    onPress={handleSkipIntro}
                    disabled={!canSkipIntro}
                  >
                    <Text style={styles.btnText}>跳过片头</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={handleVideoFitMode}>
                    <Text style={styles.btnText}>比例:{getVideoFitModeName()}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={handleToggleOrientationMode}>
                    <Text style={styles.btnText}>方向:{getOrientationModeLabel(orientationMode)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={handleFullscreen}>
                    <Text style={styles.btnText}>{isFullscreen ? '退出全屏' : '全屏'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </Pressable>
      </GestureDetector>

      {/* 全屏时隐藏信息区域 */}
      {!isFullscreen && (
        <View style={styles.infoContainer}>
          <Text style={styles.episodeTitle}>{episode.title}</Text>
          <Text style={styles.episodeDescription}>{episode.description}</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullscreenContainer: {
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
  },
  loadingVideo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'space-between',
    padding: 16,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  centerArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    gap: 10,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6200EE',
    borderRadius: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 10,
  },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
  },
  qualityBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#6200EE',
    borderRadius: 4,
  },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#6200EE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBtnText: {
    fontSize: 28,
    color: '#fff',
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  episodePickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
    padding: 12,
  },
  episodePickerPanel: {
    backgroundColor: '#111',
    borderRadius: 10,
    maxHeight: '70%',
    overflow: 'hidden',
  },
  episodePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  episodePickerTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  episodePickerClose: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  episodePickerCloseText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  episodePickerList: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  episodePickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  episodeChip: {
    width: '18%',
    margin: '1%',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  episodeChipActive: {
    backgroundColor: 'rgba(98, 0, 238, 0.9)',
  },
  episodeChipText: {
    color: '#fff',
    fontSize: 12,
  },
  episodeChipTextActive: {
    fontWeight: '700',
  },
  btnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    minWidth: 45,
  },
  infoContainer: {
    padding: 16,
    backgroundColor: '#fff',
    flex: 1,
  },
  episodeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  episodeDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default PlayerScreen;
