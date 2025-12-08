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
  Dimensions,
} from 'react-native';
import eventBus, { EVENTS } from '../../services/eventBus';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { getSeriesDetail, getEpisodes, getEpisodeDetail, getCurrentVideoSource } from '../../services/videoApi';
import { isFavorite, addFavorite, removeFavorite } from '../../services/storage';
import EpisodeCard from '../../components/EpisodeCard';
import videoDownloadManager from '../../services/videoDownloadManager';
import videoPlayerService from '../../services/videoPlayerService';

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
  const [downloadState, setDownloadState] = useState(null);
  const [preparingDownloads, setPreparingDownloads] = useState(new Set());
  
  // 多选模式状态
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedEpisodes, setSelectedEpisodes] = useState(new Set());
  
  // 分区显示状态（每50集一个分区）
  const EPISODES_PER_GROUP = 50;
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  
  // 排序状态
  const [sortOrder, setSortOrder] = useState('asc'); // asc: 正序, desc: 倒序
  
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
    checkFavorite();
  }, [id]);

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
          console.log('原始视频URL:', result.data.videoUrl);
          
          // 先设置播放的剧集信息
          setPlayingEpisode(result.data);
          
          // 使用统一的视频播放服务获取播放URL
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
            
            // 最后显示播放器
            setShowPlayer(true);
            console.log('播放器已显示，等待视频加载...');
          } catch (error) {
            console.error('获取视频播放URL失败:', error);
            Alert.alert('错误', '无法获取视频播放地址: ' + error.message);
          }
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
        player.pause();
      } catch (e) {
        console.error('停止播放失败:', e);
      }
    }
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

  // 开始播放第一集
  const handleStartPlaying = useCallback(() => {
    if (sortedEpisodes.length > 0) {
      handleEpisodePress(sortedEpisodes[0]);
    }
  }, [sortedEpisodes, handleEpisodePress]);

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
      />
    );
  }, [getEpisodeDownloadStatus, playingEpisode, handleEpisodePress, handleDownloadEpisode, handlePauseDownload, handleResumeDownload, handleCancelDownload, handleRetryDownload, isMultiSelectMode, selectedEpisodes, toggleEpisodeSelection]);

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
                      player.play();
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
                  Alert.alert('播放错误', `视频加载失败

视频源: ${videoSource}

请检查网络连接或视频链接`);
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
