import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Animated,
  TouchableWithoutFeedback,
  useWindowDimensions,
} from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import eventBus, { EVENTS } from '../../services/eventBus';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { getSeriesDetail, getEpisodes, getEpisodeDetail, getCurrentVideoSource } from '../../services/videoApi';
import { isFavorite, addFavorite, removeFavorite, addVideoHistory } from '../../services/storage';
import EpisodeCard from '../../components/EpisodeCard';
import videoDownloadManager from '../../services/videoDownloadManager';
import videoPlayerService from '../../services/videoPlayerService';

const SeriesDetailScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [series, setSeries] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playingEpisode, setPlayingEpisode] = useState(null);
  const [videoSource, setVideoSource] = useState('');
  const [showPlayer, setShowPlayer] = useState(false);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false); // 视频加载状态
  const [loadingEpisodeId, setLoadingEpisodeId] = useState(null); // 正在加载的剧集ID
  const progressTrackWidthRef = useRef(0);
  const [downloadState, setDownloadState] = useState(null);
  const [preparingDownloads, setPreparingDownloads] = useState(new Set());
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoFitMode, setVideoFitMode] = useState('contain'); // contain, cover, fill
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const controlsTimeoutRef = useRef(null);
  
  // 多选模式状态
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedEpisodes, setSelectedEpisodes] = useState(new Set());
  
  // 分区显示状态（每50集一个分区）
  const EPISODES_PER_GROUP = 50;
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  
  // 排序状态
  const [sortOrder, setSortOrder] = useState('asc'); // asc: 正序, desc: 倒序
  
  // 封面播放按钮动画
  const coverPlayScale = useRef(new Animated.Value(1)).current;
  const coverPlayOpacity = useRef(new Animated.Value(1)).current;
  
  // 收藏状态
  const [favorited, setFavorited] = useState(false);
  
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
            player.play();
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
        const time = player.currentTime || 0;
        const dur = player.duration || 0;
        
        setIsPlaying(playing);
        setCurrentTime(time);
        setDuration(dur);
        
        if ((playing && time > 0) || dur > 0) {
          setIsLoadingVideo(false);
          setLoadingEpisodeId(null);
        }
      } catch (error) {
        console.error('获取播放器状态失败:', error);
      }
    }, 500); // 每500ms检查一次
    
    return () => clearInterval(interval);
  }, [player]);

  useEffect(() => {
    loadData();
    checkFavorite();
  }, [id]);

  useEffect(() => {
    if (showControls && player && player.playing) {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 4000);
    }
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [showControls, player]);

  useEffect(() => {
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  const saveVideoHistoryIfNeeded = async (episode = null) => {
    const ep = episode || playingEpisode;
    if (!series || !series.id) return;
    if (!ep || !ep.id) return;

    const safePosition = Number.isFinite(currentTime) ? Math.floor(currentTime) : 0;
    const safeDuration = Number.isFinite(duration) ? Math.floor(duration) : 0;
    if (safeDuration <= 0) return;

    await addVideoHistory(
      {
        id: series.id,
        title: series.title,
        cover: series.cover,
      },
      ep.id,
      safePosition,
      safeDuration
    );
  };

  useEffect(() => {
    return () => {
      saveVideoHistoryIfNeeded();
    };
  }, [series, playingEpisode, currentTime, duration]);

  // 检查收藏状态
  const checkFavorite = async () => {
    const result = await isFavorite(id);
    setFavorited(result);
  };

  // 切换收藏状态
  const handleFavorite = async () => {
    if (!series) return;
    if (favorited) {
      await removeFavorite(id);
      setFavorited(false);
    } else {
      await addFavorite({
        id: series.id,
        title: series.title,
        cover: series.cover,
        type: 'video',
      });
      setFavorited(true);
    }
  };

  // 切换排序
  const toggleSort = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  // 下载状态管理
  useEffect(() => {
    // 订阅视频下载管理器状态更新
    const unsubscribe = videoDownloadManager.subscribe((state) => {
      setDownloadState(state);
    });
    
    // 初始化时获取当前下载状态
    setDownloadState(videoDownloadManager.getState());
    
    return unsubscribe;
  }, []);

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
      await saveVideoHistoryIfNeeded();
      console.log('=== 开始加载剧集 ===');
      console.log('剧集ID:', episode.id);
      console.log('剧集信息:', episode);
      setIsLoadingVideo(true);
      setLoadingEpisodeId(episode.id);
      console.log('正在调用后端API获取剧集详情...');
      console.log('API路径:', `/videos/episodes/${episode.id}?source=thanju`);
      const result = await getEpisodeDetail(episode.id);
      console.log('=== 后端API响应 ===');
      console.log('响应结果:', JSON.stringify(result, null, 2));
      if (result.success && result.data) {
        console.log('=== 剧集数据解析 ===');
        console.log('剧集数据:', result.data);
        console.log('视频URL (原始):', result.data.videoUrl);
        console.log('播放页面URL:', result.data.playUrl);
        if (result.data.videoUrl) {
          console.log('=== 设置视频源 ===');
          setPlayingEpisode(result.data);
          try {
            const currentSource = getCurrentVideoSource();
            const playUrlInfo = await videoPlayerService.getPlayUrlFromEpisode(
              episode.id,
              result.data,
              currentSource || 'thanju'
            );
            console.log('=== 视频播放URL信息 ===');
            console.log('最终URL:', playUrlInfo.url);
            console.log('是否本地:', playUrlInfo.isLocal);
            console.log('视频类型:', playUrlInfo.videoType);
            setVideoSource(playUrlInfo.url);
            setShowPlayer(true);
            setShowControls(true);
            console.log('播放器已显示，等待视频加载...');
          } catch (error) {
            console.error('获取视频播放URL失败:', error);
            setIsLoadingVideo(false);
            setLoadingEpisodeId(null);
            Alert.alert('错误', '无法获取视频播放地址: ' + error.message);
          }
        } else {
          console.error('=== 视频URL为空 ===');
          setIsLoadingVideo(false);
          setLoadingEpisodeId(null);
          Alert.alert(
            '无法播放', 
            `该剧集暂时无法播放。

播放页面: ${result.data.playUrl || '未知'}

可能原因：
- 剧集资源不存在
- 播放页面异常
- 后端解析失败

请尝试其他剧集。`
          );
        }
      } else {
        console.error('=== 获取剧集详情失败 ===');
        setIsLoadingVideo(false);
        setLoadingEpisodeId(null);
        Alert.alert('提示', result.error || '无法获取视频播放链接');
      }
    } catch (error) {
      console.error('=== 加载剧集详情异常 ===');
      setIsLoadingVideo(false);
      setLoadingEpisodeId(null);
      Alert.alert('错误', '加载视频失败: ' + error.message);
    }
  };

  const handleClosePlayer = () => {
    saveVideoHistoryIfNeeded();
    if (isFullscreen) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    }
    setShowPlayer(false);
    setPlayingEpisode(null);
    setVideoSource('');
    setIsFullscreen(false);
  };

  const handleControlsPress = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 4000);
  };

  const handlePlayPause = () => {
    if (!player) return;
    try {
      if (player.playing) {
        player.pause();
        setIsPlaying(false);
      } else {
        player.play();
        setIsPlaying(true);
      }
    } catch (e) {
      console.error('PlayPause failed:', e);
    }
  };

  const handleSeekForward = () => {
    if (!player) return;
    try {
      player.seekBy(10);
      setCurrentTime(Math.min((player.currentTime || 0) + 10, player.duration || 0));
    } catch (e) {
      console.error('SeekForward failed:', e);
    }
  };

  const handleSeekBackward = () => {
    if (!player) return;
    try {
      player.seekBy(-10);
      setCurrentTime(Math.max((player.currentTime || 0) - 10, 0));
    } catch (e) {
      console.error('SeekBackward failed:', e);
    }
  };

  const handlePlaybackRate = () => {
    if (!player) return;
    const rates = [0.5, 1, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % rates.length;
    const nextRate = rates[nextIndex];
    try {
      player.playbackRate = nextRate;
      setPlaybackRate(nextRate);
    } catch (e) {
      console.error('PlaybackRate failed:', e);
    }
  };

  const handleFullscreen = async () => {
    const nextFullscreen = !isFullscreen;
    if (nextFullscreen) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT).catch(() => {});
    } else {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    }
    setIsFullscreen(nextFullscreen);
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 4000);
  };

  const handleVideoFitMode = () => {
    const modes = ['contain', 'cover', 'fill'];
    const currentIndex = modes.indexOf(videoFitMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setVideoFitMode(modes[nextIndex]);
  };

  const getVideoFitModeName = () => {
    const modeNames = { contain: '适应', cover: '填充', fill: '拉伸' };
    return modeNames[videoFitMode] || '适应';
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeekPress = (event) => {
    if (!player) return;
    const width = progressTrackWidthRef.current || 0;
    const locationX = event.nativeEvent.locationX || 0;
    const dur = player.duration || 0;
    console.log('=== Seek Press ===');
    console.log('width:', width, 'locationX:', locationX, 'duration:', dur);
    if (width <= 0 || dur <= 0) return;
    const ratio = Math.min(Math.max(locationX / width, 0), 1);
    const nextTime = dur * ratio;
    console.log('ratio:', ratio, 'nextTime:', nextTime);
    try {
      player.seekBy(nextTime - (player.currentTime || 0));
      setCurrentTime(nextTime);
    } catch (e) {
      console.error('Seek failed:', e);
      try {
        player.currentTime = nextTime;
        setCurrentTime(nextTime);
      } catch (e2) {
        console.error('Seek fallback failed:', e2);
      }
    }
    setShowControls(true);
  };

  // 获取集数下载状态
  const getEpisodeDownloadStatus = useCallback((episodeId) => {
    // 检查是否在准备中
    if (preparingDownloads.has(episodeId)) {
      return {
        status: 'pending',
        progress: 0
      };
    }
    
    // 从下载管理器获取状态
    const status = videoDownloadManager.getDownloadStatus(episodeId);
    return status;
  }, [preparingDownloads]);

  const handleDownloadEpisode = useCallback(async (episode) => {
    if (!series) return;
    
    setPreparingDownloads(prev => new Set([...prev, episode.id]));
    
    try {
      const source = getCurrentVideoSource() || 'thanju'; // 使用当前选择的数据源
      const result = await videoDownloadManager.downloadEpisode(
        series.id,
        series.title,
        episode,
        source,
        (progress) => {
          // 进度回调已在下载管理器中处理
          console.log('下载进度:', progress);
        }
      );
      
      if (result.success && !result.alreadyDownloaded) {
        console.log(`剧集 ${episode.title} 已添加到下载队列`);
      } else if (result.alreadyDownloaded) {
        Alert.alert('提示', '该剧集已下载');
      }
      
      // 清除准备状态
      setPreparingDownloads(prev => {
        const next = new Set(prev);
        next.delete(episode.id);
        return next;
      });
    } catch (error) {
      console.error('下载失败:', error);
      Alert.alert('错误', '下载失败: ' + error.message);
      setPreparingDownloads(prev => {
        const next = new Set(prev);
        next.delete(episode.id);
        return next;
      });
    }
  }, [series]);

  // 提取剧集编号进行数字排序
  const extractEpisodeNumber = (title) => {
    const match = title.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  // 排序后的剧集列表
  const sortedEpisodes = useMemo(() => {
    return [...episodes].sort((a, b) => {
      const numA = extractEpisodeNumber(a.title || '');
      const numB = extractEpisodeNumber(b.title || '');
      return sortOrder === 'asc' ? numA - numB : numB - numA;
    });
  }, [episodes, sortOrder]);

  // 计算分组信息（基于排序后的列表）
  const episodeGroups = useMemo(() => {
    if (sortedEpisodes.length <= EPISODES_PER_GROUP) return [sortedEpisodes];
    
    const groups = [];
    for (let i = 0; i < sortedEpisodes.length; i += EPISODES_PER_GROUP) {
      groups.push(sortedEpisodes.slice(i, i + EPISODES_PER_GROUP));
    }
    return groups;
  }, [sortedEpisodes]);

  // 当前显示的剧集（根据分区）
  const displayedEpisodes = useMemo(() => {
    if (episodeGroups.length <= 1) return sortedEpisodes;
    return episodeGroups[currentGroupIndex] || [];
  }, [episodeGroups, currentGroupIndex, sortedEpisodes]);

  // 开始播放第一集（带动画）
  const handleStartPlaying = useCallback(() => {
    if (sortedEpisodes.length > 0) {
      // 封面播放按钮动画
      Animated.sequence([
        Animated.parallel([
          Animated.spring(coverPlayScale, {
            toValue: 1.2,
            tension: 200,
            friction: 5,
            useNativeDriver: true,
          }),
          Animated.timing(coverPlayOpacity, {
            toValue: 0.7,
            duration: 150,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.spring(coverPlayScale, {
            toValue: 1,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.timing(coverPlayOpacity, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        handleEpisodePress(sortedEpisodes[0]);
      });
    }
  }, [sortedEpisodes, handleEpisodePress, coverPlayScale, coverPlayOpacity]);

  // 多选模式：切换选中状态
  const toggleEpisodeSelection = useCallback((episodeId) => {
    setSelectedEpisodes(prev => {
      const next = new Set(prev);
      if (next.has(episodeId)) {
        next.delete(episodeId);
      } else {
        next.add(episodeId);
      }
      return next;
    });
  }, []);

  // 全选/取消全选当前分区
  const toggleSelectAll = useCallback(() => {
    const currentEpisodeIds = displayedEpisodes.map(e => e.id);
    const allSelected = currentEpisodeIds.every(id => selectedEpisodes.has(id));
    
    if (allSelected) {
      // 取消全选
      setSelectedEpisodes(prev => {
        const next = new Set(prev);
        currentEpisodeIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      // 全选
      setSelectedEpisodes(prev => {
        const next = new Set(prev);
        currentEpisodeIds.forEach(id => next.add(id));
        return next;
      });
    }
  }, [displayedEpisodes, selectedEpisodes]);

  // 进入多选模式
  const enterMultiSelectMode = useCallback(() => {
    setIsMultiSelectMode(true);
    setSelectedEpisodes(new Set());
  }, []);

  // 退出多选模式
  const exitMultiSelectMode = useCallback(() => {
    setIsMultiSelectMode(false);
    setSelectedEpisodes(new Set());
  }, []);

  // 批量下载选中的剧集（不弹窗提示，与漫画风格一致）
  const handleBatchDownload = async () => {
    if (!series || episodes.length === 0) return;
    
    try {
      const source = getCurrentVideoSource() || 'thanju';
      
      // 如果是多选模式，只下载选中的
      if (isMultiSelectMode && selectedEpisodes.size > 0) {
        const selectedList = episodes.filter(e => selectedEpisodes.has(e.id));
        await videoDownloadManager.batchDownloadEpisodes(
          series.id,
          series.title,
          selectedList,
          source
        );
        exitMultiSelectMode();
      } else {
        // 下载所有
        await videoDownloadManager.batchDownloadEpisodes(
          series.id,
          series.title,
          episodes,
          source
        );
      }
    } catch (error) {
      console.error('批量下载失败:', error);
    }
  };

  // 批量暂停所有下载
  const handleBatchPause = useCallback(() => {
    const allTasks = videoDownloadManager.queue.getAllTasks();
    const runningTasks = [...allTasks.running, ...allTasks.pending];
    runningTasks.forEach(task => {
      videoDownloadManager.pauseDownload(task.episodeId);
    });
  }, []);

  // 批量继续所有下载
  const handleBatchResume = useCallback(() => {
    const allTasks = videoDownloadManager.queue.getAllTasks();
    allTasks.paused.forEach(task => {
      videoDownloadManager.resumeDownload(task.episodeId);
    });
  }, []);

  const handlePauseDownload = useCallback((episodeId) => {
    videoDownloadManager.pauseDownload(episodeId);
  }, []);

  const handleResumeDownload = useCallback((episodeId) => {
    videoDownloadManager.resumeDownload(episodeId);
  }, []);

  const handleCancelDownload = useCallback((episodeId) => {
    videoDownloadManager.cancelDownload(episodeId);
  }, []);

  const handleRetryDownload = useCallback((episode) => {
    videoDownloadManager.retryDownload(episode.id);
  }, []);

  // 获取下载任务统计
  const downloadStats = useMemo(() => {
    if (!downloadState) return { running: 0, paused: 0, pending: 0 };
    const allTasks = videoDownloadManager.queue.getAllTasks();
    return {
      running: allTasks.running.length,
      paused: allTasks.paused.length,
      pending: allTasks.pending.length,
    };
  }, [downloadState]);

  const renderEpisodeCard = useCallback(({ item, index }) => {
    const downloadStatus = getEpisodeDownloadStatus(item.id);
    const isActive = playingEpisode?.id === item.id;
    const isSelected = selectedEpisodes.has(item.id);
    const isLoading = loadingEpisodeId === item.id;
    
    // 多选模式下点击切换选中状态
    const handlePress = isMultiSelectMode 
      ? () => toggleEpisodeSelection(item.id)
      : () => handleEpisodePress(item);
    
    return (
      <EpisodeCard
        item={item}
        onPress={handlePress}
        onDownload={handleDownloadEpisode}
        onPause={() => handlePauseDownload(item.id)}
        onResume={() => handleResumeDownload(item.id)}
        onCancel={() => handleCancelDownload(item.id)}
        onRetry={() => handleRetryDownload(item)}
        downloadStatus={downloadStatus}
        isActive={isActive}
        isMultiSelectMode={isMultiSelectMode}
        isSelected={isSelected}
        isLoading={isLoading}
      />
    );
  }, [getEpisodeDownloadStatus, playingEpisode, handleEpisodePress, handleDownloadEpisode, handlePauseDownload, handleResumeDownload, handleCancelDownload, handleRetryDownload, isMultiSelectMode, selectedEpisodes, toggleEpisodeSelection, loadingEpisodeId]);

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
    <SafeAreaView style={[styles.container, isFullscreen && styles.fullscreenContainer]} edges={isFullscreen ? [] : ['top']}>
      <StatusBar barStyle="dark-content" hidden={isFullscreen} />
      
      {!isFullscreen && (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>← 返回</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 播放器区域 - 默认显示 */}
        <View
          style={[
            styles.coverContainer,
            isFullscreen && styles.fullscreenContainer,
            { width: screenWidth, height: isFullscreen ? screenHeight : 300 }
          ]}
        >
          {showPlayer && playingEpisode && videoSource && player ? (
            // 正在播放
            <View
                style={[
                  styles.videoContainer,
                  {
                    width: screenWidth,
                    height: isFullscreen ? screenHeight : 300,
                  }
                ]}
              >
                {player ? (
                  <VideoView
                    player={player}
                    style={StyleSheet.absoluteFill}
                    nativeControls={false}
                    contentFit={videoFitMode}
                    onLoadStart={() => {
                      console.log('=== 视频开始加载 ===');
                      setIsLoadingVideo(true);
                    }}
                    onLoad={() => {
                      console.log('=== 视频加载完成 ===');
                      setIsLoadingVideo(false);
                      setLoadingEpisodeId(null);
                      if (player && !player.playing) {
                        try {
                          player.play();
                          console.log('已自动开始播放');
                        } catch (e) {
                          console.error('自动播放失败:', e);
                        }
                      }
                    }}
                    onError={() => {
                      console.error('=== 视频加载错误 ===');
                      setIsLoadingVideo(false);
                      setLoadingEpisodeId(null);
                      Alert.alert('播放错误', '视频加载失败，请检查网络连接');
                    }}
                  />
                ) : (
                  <View style={styles.loadingVideo}>
                    <ActivityIndicator color="#fff" />
                    <Text style={styles.loadingText}>正在初始化播放器...</Text>
                  </View>
                )}

                {isLoadingVideo && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator color="#fff" />
                    <Text style={styles.loadingText}>正在加载视频...</Text>
                  </View>
                )}

                <TouchableWithoutFeedback onPress={handleControlsPress}>
                  <View style={[styles.controlsOverlay, !showControls && styles.controlsOverlayHidden]}>
                    {showControls && (
                      <>
                        <View style={styles.topBar}>
                          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                            <Text style={styles.btnText}>← 返回</Text>
                          </TouchableOpacity>
                          <Text style={styles.playerTitle} numberOfLines={1}>{playingEpisode?.title || ''}</Text>
                          <TouchableOpacity style={styles.closeButton} onPress={handleClosePlayer}>
                            <Text style={styles.closeButtonText}>✕</Text>
                          </TouchableOpacity>
                        </View>

                        <View style={styles.centerArea}>
                          <TouchableOpacity style={styles.seekBtn} onPress={handleSeekBackward}>
                            <Text style={styles.seekBtnText}>⏪</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.playBtn} onPress={handlePlayPause}>
                            <Text style={styles.playBtnText}>{isPlaying ? '⏸' : '▶'}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.seekBtn} onPress={handleSeekForward}>
                            <Text style={styles.seekBtnText}>⏩</Text>
                          </TouchableOpacity>
                        </View>

                        <View style={styles.bottomBar}>
                          <View style={styles.progressRow}>
                            <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                            <TouchableOpacity
                              style={styles.progressTrack}
                              onPress={handleSeekPress}
                              onLayout={(e) => {
                                progressTrackWidthRef.current = e.nativeEvent.layout.width;
                              }}
                              activeOpacity={0.8}
                            >
                              <View style={[styles.progressFill, { width: `${duration > 0 ? (currentTime / duration * 100) : 0}%` }]} />
                            </TouchableOpacity>
                            <Text style={styles.timeText}>{formatTime(duration)}</Text>
                          </View>
                          <View style={styles.buttonRow}>
                            <TouchableOpacity style={styles.actionBtn} onPress={handlePlaybackRate}>
                              <Text style={styles.btnText}>{playbackRate}x</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionBtn} onPress={handleVideoFitMode}>
                              <Text style={styles.btnText}>比例:{getVideoFitModeName()}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionBtn} onPress={handleFullscreen}>
                              <Text style={styles.btnText}>{isFullscreen ? '退出全屏' : '全屏'}</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </>
                    )}
                  </View>
                </TouchableWithoutFeedback>
              </View>
          ) : (
            // 播放器预览界面（显示封面和播放按钮）
            <View style={styles.playerPreview}>
              <Image
                source={{ uri: series.cover }}
                style={[styles.cover, isLoadingVideo && styles.coverDimmed]}
                resizeMode="cover"
              />
              {/* 播放器样式遮罩 */}
              <View style={styles.playerOverlay}>
                {isLoadingVideo ? (
                  // 加载中
                  <View style={styles.loadingContent}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.loadingText}>正在加载视频...</Text>
                  </View>
                ) : (
                  // 播放按钮
                  <TouchableOpacity 
                    style={styles.playButtonLarge}
                    onPress={handleStartPlaying}
                    activeOpacity={0.8}
                  >
                    <Animated.View 
                      style={[
                        styles.playButtonInner,
                        {
                          transform: [{ scale: coverPlayScale }],
                          opacity: coverPlayOpacity,
                        }
                      ]}
                    >
                      <Text style={styles.playButtonLargeIcon}>▶</Text>
                    </Animated.View>
                  </TouchableOpacity>
                )}
              </View>
              {/* 播放器底部控制栏样式 */}
              <View style={styles.playerControlBar}>
                <Text style={styles.playerControlText}>
                  {isLoadingVideo ? '加载中...' : '点击播放'}
                </Text>
              </View>
            </View>
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

          {/* 操作按钮：开始播放 + 收藏（与漫画页面一致） */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleStartPlaying}
            >
              <Text style={styles.primaryButtonText}>开始播放</Text>
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

          <View style={styles.divider} />

          <View style={styles.episodesHeader}>
            {!isMultiSelectMode ? (
              <Text style={styles.episodesTitle}>剧集列表 ({episodes.length})</Text>
            ) : (
              <View style={styles.headerLeftSelection}>
                <Text style={styles.episodesTitle}>剧集列表 ({episodes.length})</Text>
                <Text style={styles.selectedCount}>已选 {selectedEpisodes.size}</Text>
              </View>
            )}
            <View style={styles.headerActions}>
              {isMultiSelectMode ? (
                <>
                  <TouchableOpacity
                    style={styles.selectAllButton}
                    onPress={toggleSelectAll}
                  >
                    <Text style={styles.selectAllText}>
                      {displayedEpisodes.every(e => selectedEpisodes.has(e.id)) ? '取消全选' : '全选'}
                    </Text>
                  </TouchableOpacity>
                  {selectedEpisodes.size > 0 && (
                    <TouchableOpacity
                      style={styles.batchDownloadButton}
                      onPress={handleBatchDownload}
                    >
                      <Text style={styles.batchDownloadText}>下载</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.cancelSelectButton}
                    onPress={exitMultiSelectMode}
                  >
                    <Text style={styles.cancelSelectText}>取消</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {episodes.length > 0 && (
                    <TouchableOpacity
                      style={styles.multiSelectButton}
                      onPress={enterMultiSelectMode}
                    >
                      <Text style={styles.multiSelectText}>批量下载</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.sortButton}
                    onPress={toggleSort}
                  >
                    <Text style={styles.sortButtonText}>
                      {sortOrder === 'asc' ? '正序' : '倒序'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
          
          {/* 批量下载控制区（有下载任务时显示） */}
          {(downloadStats.running > 0 || downloadStats.paused > 0 || downloadStats.pending > 0) && (
            <View style={styles.batchControlBar}>
              <Text style={styles.batchControlText}>
                下载中: {downloadStats.running} | 暂停: {downloadStats.paused} | 排队: {downloadStats.pending}
              </Text>
              <View style={styles.batchControlButtons}>
                {(downloadStats.running > 0 || downloadStats.pending > 0) && (
                  <TouchableOpacity style={styles.batchPauseButton} onPress={handleBatchPause}>
                    <Text style={styles.batchPauseText}>全部暂停</Text>
                  </TouchableOpacity>
                )}
                {downloadStats.paused > 0 && (
                  <TouchableOpacity style={styles.batchResumeButton} onPress={handleBatchResume}>
                    <Text style={styles.batchResumeText}>全部继续</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
          
          {/* 分区标签（超过50集显示） */}
          {episodeGroups.length > 1 && (
            <View style={styles.rangeContainer}>
              <Text style={styles.rangeTitle}>区间选择:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {episodeGroups.map((group, index) => {
                  // 使用第一个和最后一个剧集的编号来显示区间
                  const firstNum = extractEpisodeNumber(group[0]?.title || '');
                  const lastNum = extractEpisodeNumber(group[group.length - 1]?.title || '');
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.rangeChip,
                        currentGroupIndex === index && styles.rangeChipActive
                      ]}
                      onPress={() => setCurrentGroupIndex(index)}
                    >
                      <Text style={[
                        styles.rangeChipText,
                        currentGroupIndex === index && styles.rangeChipTextActive
                      ]}>
                        {sortOrder === 'asc' 
                          ? `${firstNum}-${lastNum}` 
                          : `${lastNum}-${firstNum}`
                        }
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>

        <FlatList
          data={displayedEpisodes}
          renderItem={renderEpisodeCard}
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
  fullscreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    backgroundColor: '#000',
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
    height: 220,
    backgroundColor: '#000',
  },
  coverDimmed: {
    opacity: 0.5,
  },
  playerPreview: {
    position: 'relative',
    width: '100%',
    height: 220,
    backgroundColor: '#000',
  },
  playerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 12,
  },
  playButtonLarge: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(98, 0, 238, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  playButtonLargeIcon: {
    fontSize: 28,
    color: '#fff',
    marginLeft: 4,
  },
  playerControlBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerControlText: {
    color: '#fff',
    fontSize: 13,
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
  metaText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    paddingTop: 16,
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
    flexWrap: 'wrap',
  },
  headerLeftSelection: {
    flexDirection: 'column',
  },
  episodesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  multiSelectButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#6200EE',
  },
  multiSelectText: {
    color: '#6200EE',
    fontSize: 13,
    fontWeight: '500',
  },
  selectAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e3f2fd',
    borderRadius: 6,
  },
  selectAllText: {
    color: '#2196F3',
    fontSize: 13,
    fontWeight: '500',
  },
  cancelSelectButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
  },
  cancelSelectText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '500',
  },
  selectedCount: {
    fontSize: 13,
    color: '#6200EE',
    fontWeight: '600',
  },
  batchDownloadButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#6200EE',
    borderRadius: 6,
  },
  batchDownloadText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  batchControlBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  batchControlText: {
    fontSize: 12,
    color: '#666',
  },
  batchControlButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  batchPauseButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ff9800',
    borderRadius: 4,
  },
  batchPauseText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  batchResumeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#4caf50',
    borderRadius: 4,
  },
  batchResumeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
  },
  sortButtonText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '500',
  },
  rangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  rangeTitle: {
    fontSize: 13,
    color: '#666',
    marginRight: 8,
  },
  rangeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    marginRight: 8,
  },
  rangeChipActive: {
    backgroundColor: '#6200EE',
  },
  rangeChipText: {
    fontSize: 13,
    color: '#666',
  },
  rangeChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  groupTabs: {
    marginBottom: 12,
  },
  groupTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    marginRight: 8,
  },
  groupTabActive: {
    backgroundColor: '#6200EE',
  },
  groupTabText: {
    fontSize: 13,
    color: '#666',
  },
  groupTabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  episodesList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
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
  videoContainer: {
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
  controlsOverlayHidden: {
    backgroundColor: 'transparent',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
  },
  btnText: {
    color: '#fff',
    fontSize: 14,
  },
  centerArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  seekBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  seekBtnText: {
    fontSize: 20,
    color: '#fff',
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
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    justifyContent: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6200EE',
    borderRadius: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
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
  timeText: {
    fontSize: 12,
    color: '#fff',
  },
});

export default SeriesDetailScreen;
