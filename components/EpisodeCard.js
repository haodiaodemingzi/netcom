import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
} from 'react-native';
import InlineSkeleton from './InlineSkeleton';

const EpisodeCard = ({ 
  item, 
  onPress, 
  onDownload, 
  onPause,
  onResume,
  onCancel,
  onRetry,
  downloadStatus,
  isActive = false,
  isMultiSelectMode = false,
  isSelected = false,
  isLoading = false,
}) => {
  const isDownloading = downloadStatus && typeof downloadStatus === 'object' && 
                       downloadStatus.status === 'downloading';
  const isPending = downloadStatus && typeof downloadStatus === 'object' && 
                   downloadStatus.status === 'pending';
  const isCompleted = downloadStatus === 'completed';
  const downloadProgress = isDownloading ? (downloadStatus.progress || 0) : 0;
  
  // 播放按钮动画
  const playButtonScale = useRef(new Animated.Value(1)).current;
  const playButtonOpacity = useRef(new Animated.Value(1)).current;
  const [isPlaying, setIsPlaying] = useState(false);
  
  const progressAnimRef = useRef(null);
  if (!progressAnimRef.current) {
    progressAnimRef.current = new Animated.Value(downloadProgress);
  }
  const progressAnim = progressAnimRef.current;
  const completionAnimRef = useRef(null);
  if (!completionAnimRef.current) {
    completionAnimRef.current = new Animated.Value(isCompleted ? 1 : 0);
  }
  const completionAnim = completionAnimRef.current;
  const prevProgressRef = useRef(downloadProgress);
  const prevCompletedRef = useRef(isCompleted);
  const [showingCompletion, setShowingCompletion] = useState(false);
  
  // 播放按钮点击动画
  const handlePlayPress = () => {
    if (isMultiSelectMode) {
      onPress(item);
      return;
    }
    
    setIsPlaying(true);
    
    // 脉冲动画效果
    Animated.sequence([
      Animated.parallel([
        Animated.spring(playButtonScale, {
          toValue: 1.3,
          tension: 200,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.timing(playButtonOpacity, {
          toValue: 0.7,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.spring(playButtonScale, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(playButtonOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setIsPlaying(false);
      onPress(item);
    });
  };
  
  useEffect(() => {
    if (isDownloading) {
      // 只在进度真正变化时才动画
      if (Math.abs(downloadProgress - prevProgressRef.current) > 0.001) {
        Animated.timing(progressAnim, {
          toValue: downloadProgress,
          duration: 200,
          useNativeDriver: false,
        }).start();
        prevProgressRef.current = downloadProgress;
      }
    }
  }, [downloadProgress, isDownloading, isPending]);
  
  useEffect(() => {
    // 检测到完成状态变化时触发动画
    if (isCompleted && !prevCompletedRef.current) {
      setShowingCompletion(true);
      // 进度条动画到100%
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start(() => {
        // 完成后触发完成徽章的弹出动画
        completionAnim.setValue(0);
        Animated.spring(completionAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }).start(() => {
          // 动画完成后隐藏进度条
          setTimeout(() => setShowingCompletion(false), 100);
        });
      });
    }
    prevCompletedRef.current = isCompleted;
  }, [isCompleted]);

  return (
    <TouchableOpacity
      style={[
        styles.episodeCard,
        isActive && styles.episodeCardActive,
        isMultiSelectMode && isSelected && styles.episodeCardSelected,
      ]}
      onPress={handlePlayPress}
      activeOpacity={0.7}
    >
      {/* 多选模式复选框 */}
      {isMultiSelectMode ? (
        <View style={[
          styles.checkbox,
          isSelected && styles.checkboxSelected
        ]}>
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
        </View>
      ) : (
        /* 播放图标按钮 */
        <TouchableOpacity 
          style={styles.playButtonContainer}
          onPress={handlePlayPress}
          activeOpacity={0.8}
          disabled={isLoading}
        >
          <Animated.View 
            style={[
              styles.playButton,
              isActive && styles.playButtonActive,
              isLoading && styles.playButtonLoading,
              {
                transform: [{ scale: playButtonScale }],
                opacity: playButtonOpacity,
              }
            ]}
          >
            {isLoading ? (
              <InlineSkeleton size={16} />
            ) : (
              <Text style={[styles.playIcon, isActive && styles.playIconActive]}>
                {isPlaying ? '⏳' : '▶'}
              </Text>
            )}
          </Animated.View>
        </TouchableOpacity>
      )}
      
      <View style={styles.episodeInfo}>
        <Text 
          style={[
            styles.episodeTitle,
            isActive && styles.episodeTitleActive,
          ]}
          numberOfLines={2}
        >
          {item.title || `第${item.episodeNumber || ''}集`}
        </Text>
        {item.description && (
          <Text style={styles.episodeDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
      </View>
      
      <View style={styles.episodeActions}>
        {downloadStatus === 'completed' && (
          <Animated.View 
            style={[
              styles.downloadActionRow,
              {
                opacity: completionAnim,
                transform: [
                  {
                    scale: completionAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
              }
            ]}
          >
            <View style={styles.downloadedBadge}>
              <Text style={styles.downloadedBadgeText}>✓ 已下载</Text>
            </View>
          </Animated.View>
        )}
        
        {downloadStatus?.status === 'downloading' && (
          <View style={styles.downloadActionRow}>
            <View style={styles.downloadingBadge}>
              <Text style={styles.downloadingText}>
                {Math.round(downloadStatus.progress * 100)}%
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.pauseButton}
              onPress={(e) => {
                e.stopPropagation();
                if (onPause) {
                  onPause();
                }
              }}
            >
              <Text style={styles.pauseButtonText}>暂停</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {downloadStatus?.status === 'pending' && (
          <View style={styles.downloadActionRow}>
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingText}>排队中</Text>
            </View>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={(e) => {
                e.stopPropagation();
                if (onCancel) {
                  onCancel();
                }
              }}
            >
              <Text style={styles.cancelButtonText}>取消</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {downloadStatus?.status === 'paused' && (
          <View style={styles.downloadActionRow}>
            <View style={styles.pausedBadge}>
              <Text style={styles.pausedText}>已暂停</Text>
            </View>
            <TouchableOpacity 
              style={styles.resumeButton}
              onPress={(e) => {
                e.stopPropagation();
                if (onResume) {
                  onResume();
                }
              }}
            >
              <Text style={styles.resumeButtonText}>继续</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={(e) => {
                e.stopPropagation();
                if (onCancel) {
                  onCancel();
                }
              }}
            >
              <Text style={styles.cancelButtonText}>取消</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {downloadStatus?.status === 'failed' && (
          <View style={styles.downloadActionRow}>
            <TouchableOpacity 
              style={styles.failedBadge}
              onPress={(e) => {
                e.stopPropagation();
                // 如果是 FFmpeg 相关错误，显示提示而不是重试
                const errorMsg = downloadStatus?.error?.message || downloadStatus?.error || '';
                if (errorMsg.includes('FFmpeg') || errorMsg.includes('m3u8') || errorMsg.includes('在线播放')) {
                  Alert.alert(
                    '无法下载',
                    '该视频为 m3u8 格式，需要服务器安装 FFmpeg 才能下载。\n\n目前该视频仅支持在线播放。',
                    [{ text: '我知道了', onPress: () => onCancel && onCancel() }]
                  );
                } else if (onRetry) {
                  onRetry();
                }
              }}
            >
              <Text style={styles.failedText}>
                {(downloadStatus?.error?.message || downloadStatus?.error || '').includes('FFmpeg') ? '不支持' : '重试'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={(e) => {
                e.stopPropagation();
                if (onCancel) {
                  onCancel();
                }
              }}
            >
              <Text style={styles.cancelButtonText}>取消</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {!downloadStatus && (
          <TouchableOpacity 
            style={styles.downloadButton}
            activeOpacity={0.6}
            onPress={(e) => {
              e.stopPropagation();
              onDownload(item);
            }}
          >
            <Text style={styles.downloadButtonText}>下载</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {(isDownloading || showingCompletion) && (
        <View style={styles.progressBarContainer}>
          <Animated.View 
            style={[
              styles.progressBar,
              { 
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%']
                })
              }
            ]}
          />
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  episodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  episodeCardActive: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196F3',
  },
  episodeCardSelected: {
    backgroundColor: '#f3e5f5',
    borderColor: '#6200EE',
  },
  playButtonContainer: {
    marginRight: 12,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#6200EE',
  },
  playButtonActive: {
    backgroundColor: '#6200EE',
    borderColor: '#6200EE',
  },
  playButtonLoading: {
    backgroundColor: '#e3f2fd',
    borderColor: '#6200EE',
  },
  playIcon: {
    fontSize: 16,
    color: '#6200EE',
    marginLeft: 2,
  },
  playIconActive: {
    color: '#fff',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ccc',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#6200EE',
    borderColor: '#6200EE',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  episodeInfo: {
    flex: 1,
    marginRight: 12,
  },
  episodeTitle: {
    fontSize: 15,
    color: '#000',
    marginBottom: 6,
    lineHeight: 20,
    fontWeight: '500',
  },
  episodeTitleActive: {
    color: '#2196F3',
    fontWeight: '600',
  },
  episodeDescription: {
    fontSize: 12,
    color: '#999',
    lineHeight: 18,
  },
  episodeActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  downloadActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  downloadedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#e3f2fd',
    marginRight: 4,
  },
  downloadedBadgeText: {
    fontSize: 11,
    color: '#2196F3',
    fontWeight: '500',
  },
  downloadingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#e8f5e9',
  },
  downloadingText: {
    fontSize: 12,
    color: '#4caf50',
    fontWeight: '600',
  },
  pauseButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#ff9800',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseButtonText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  resumeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#4caf50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resumeButtonText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  pausedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#fff3e0',
  },
  pausedText: {
    fontSize: 11,
    color: '#ff9800',
    fontWeight: '500',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#f5f5f5',
    marginRight: 4,
  },
  pendingText: {
    fontSize: 11,
    color: '#999',
    fontWeight: '500',
    marginLeft: 4,
  },
  failedBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#ff9800',
    justifyContent: 'center',
    alignItems: 'center',
  },
  failedText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  downloadButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#6200EE',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#6200EE',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  downloadButtonText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4caf50',
  },
});

export default React.memo(EpisodeCard);

