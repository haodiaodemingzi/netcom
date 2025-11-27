import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import downloadManager from '../services/downloadManager';

const DownloadProgress = () => {
  const [downloadState, setDownloadState] = useState(null);
  const [visible, setVisible] = useState(false);
  const slideAnim = useState(new Animated.Value(-100))[0];

  useEffect(() => {
    const unsubscribe = downloadManager.subscribe((state) => {
      setDownloadState(state);
      
      const hasActiveDownloads = state.queue.some(
        task => task.status === 'downloading' || task.status === 'pending'
      );
      
      if (hasActiveDownloads && !visible) {
        setVisible(true);
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 8,
        }).start();
      } else if (!hasActiveDownloads && visible) {
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setVisible(false));
      }
    });

    return unsubscribe;
  }, [visible]);

  if (!downloadState || !visible) {
    return null;
  }

  const downloadingTasks = downloadState.queue.filter(
    task => task.status === 'downloading' || task.status === 'pending'
  );
  
  const completedCount = downloadState.queue.filter(
    task => task.status === 'completed'
  ).length;
  
  const totalCount = downloadState.queue.length;
  const currentTask = downloadingTasks.find(task => task.status === 'downloading');
  const overallProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <View style={styles.content}>
        <View style={styles.info}>
          <Text style={styles.title}>
            {currentTask ? `正在下载: ${currentTask.chapterTitle}` : '准备下载...'}
          </Text>
          <Text style={styles.subtitle}>
            {completedCount}/{totalCount} 章节 ({overallProgress}%)
          </Text>
        </View>

        <View style={styles.progressBarContainer}>
          <View 
            style={[
              styles.progressBar,
              { width: `${overallProgress}%` }
            ]} 
          />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity 
            style={styles.button}
            onPress={() => downloadManager.pauseAll()}
          >
            <Text style={styles.buttonText}>暂停</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.button, styles.cancelButton]}
            onPress={() => setVisible(false)}
          >
            <Text style={[styles.buttonText, styles.cancelButtonText]}>隐藏</Text>
          </TouchableOpacity>
        </View>
      </View>

      {currentTask && (
        <View style={styles.currentProgress}>
          <Text style={styles.currentProgressText}>
            {currentTask.currentImage}/{currentTask.totalImages} 页 ({currentTask.progress}%)
          </Text>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  content: {
    padding: 16,
  },
  info: {
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#6200EE',
    borderRadius: 3,
  },
  actions: {
    flexDirection: 'row',
  },
  button: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#6200EE',
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    marginLeft: 8,
  },
  cancelButtonText: {
    color: '#666',
  },
  currentProgress: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  currentProgressText: {
    fontSize: 12,
    color: '#999',
  },
});

export default DownloadProgress;
