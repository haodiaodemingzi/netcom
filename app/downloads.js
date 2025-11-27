import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import downloadManager from '../services/downloadManager';

const DownloadsScreen = () => {
  const router = useRouter();
  const [downloads, setDownloads] = useState([]);
  const [downloadState, setDownloadState] = useState(null);

  useEffect(() => {
    loadDownloads();
    
    const unsubscribe = downloadManager.subscribe((state) => {
      setDownloadState(state);
      loadDownloads();
    });

    return () => unsubscribe();
  }, []);

  const loadDownloads = () => {
    const downloadedList = Array.from(downloadManager.downloadedChapters.values());
    // 按下载时间倒序排列
    downloadedList.sort((a, b) => 
      new Date(b.downloadedAt) - new Date(a.downloadedAt)
    );
    setDownloads(downloadedList);
  };

  const handleChapterPress = (item) => {
    router.push(`/reader/${item.chapterId}`);
  };

  const handleDeleteChapter = (item) => {
    Alert.alert(
      '确认删除',
      `确定要删除 "${item.chapterTitle}" 吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await downloadManager.deleteChapter(item.comicId, item.chapterId);
              Alert.alert('成功', '章节已删除');
            } catch (error) {
              Alert.alert('错误', '删除失败: ' + error.message);
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.chapterCard}
      onPress={() => handleChapterPress(item)}
    >
      <View style={styles.chapterInfo}>
        <Text style={styles.comicTitle} numberOfLines={1}>
          {item.comicTitle}
        </Text>
        <Text style={styles.chapterTitle} numberOfLines={1}>
          {item.chapterTitle}
        </Text>
        <Text style={styles.downloadTime}>
          下载于: {new Date(item.downloadedAt).toLocaleString('zh-CN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteChapter(item)}
      >
        <Text style={styles.deleteIcon}>🗑️</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📦</Text>
      <Text style={styles.emptyText}>还没有下载任何章节</Text>
      <Text style={styles.emptyHint}>
        在章节列表点击下载按钮即可离线阅读
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>已下载</Text>
        <Text style={styles.headerCount}>{downloads.length} 个章节</Text>
      </View>

      <FlatList
        data={downloads}
        renderItem={renderItem}
        keyExtractor={(item) => item.chapterId}
        contentContainerStyle={downloads.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={renderEmpty}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerCount: {
    fontSize: 14,
    color: '#666',
  },
  list: {
    padding: 12,
  },
  emptyList: {
    flex: 1,
  },
  chapterCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chapterInfo: {
    flex: 1,
  },
  comicTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  chapterTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  downloadTime: {
    fontSize: 12,
    color: '#999',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  deleteIcon: {
    fontSize: 24,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

export default DownloadsScreen;
