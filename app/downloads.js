import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import downloadManager from '../services/downloadManager';
import videoDownloadManager from '../services/videoDownloadManager';
import ebookDownloadManager from '../services/ebookDownloadManager';
import { getComicDetail, getEbookDetail } from '../services/api';
import { getSeriesDetail } from '../services/videoApi';

const statusOrderMap = {
  downloading: 1,
  pending: 2,
  paused: 3,
  failed: 4,
  completed: 5,
};

const getStatusOrder = (status) => {
  if (!status) {
    return 99;
  }
  const order = statusOrderMap[status];
  if (typeof order === 'number') {
    return order;
  }
  return 99;
};

const getStatusText = (status) => {
  if (!status) {
    return '';
  }
  if (status === 'pending') {
    return '排队中';
  }
  if (status === 'downloading') {
    return '下载中';
  }
  if (status === 'paused') {
    return '已暂停';
  }
  if (status === 'failed') {
    return '失败';
  }
  if (status === 'completed') {
    return '已完成';
  }
  return status;
};

const formatDateTime = (value) => {
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  try {
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
};

const DownloadsScreen = () => {
  const router = useRouter();
  const [comicState, setComicState] = useState(() => downloadManager.getState());
  const [videoState, setVideoState] = useState(() => videoDownloadManager.getState());
  const [ebookState, setEbookState] = useState(() => ebookDownloadManager.getState());

  const [coverMap, setCoverMap] = useState(() => ({}));
  const [coverFailedKeys, setCoverFailedKeys] = useState(() => new Set());
  const coverFetchingRef = useRef(new Set());

  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  useEffect(() => {
    const unsubComic = downloadManager.subscribe((state) => {
      if (!state) {
        return;
      }
      setComicState(state);
    });

    const unsubVideo = videoDownloadManager.subscribe((state) => {
      if (!state) {
        return;
      }
      setVideoState(state);
    });

    const unsubEbook = ebookDownloadManager.subscribe((state) => {
      if (!state) {
        return;
      }
      setEbookState(state);
    });

    return () => {
      if (typeof unsubComic === 'function') {
        unsubComic();
      }
      if (typeof unsubVideo === 'function') {
        unsubVideo();
      }
      if (typeof unsubEbook === 'function') {
        unsubEbook();
      }
    };
  }, []);

  const allItems = useMemo(() => {
    const items = [];

    const comicQueue = Array.isArray(comicState?.queue) ? comicState.queue : [];
    for (const task of comicQueue) {
      if (!task || !task.chapterId) {
        continue;
      }
      items.push({
        key: `comic_task_${task.chapterId}`,
        type: 'comic',
        kind: 'task',
        status: task.status,
        progress: typeof task.progress === 'number' ? task.progress : 0,
        parentId: task.comicId,
        parentTitle: task.comicTitle,
        contentId: task.chapterId,
        contentTitle: task.chapterTitle,
        source: task.source,
        error: task.error,
      });
    }

    const comicDownloads = Array.from(downloadManager.downloadedChapters?.values?.() || []);
    for (const chapter of comicDownloads) {
      if (!chapter || !chapter.chapterId) {
        continue;
      }
      items.push({
        key: `comic_done_${chapter.chapterId}`,
        type: 'comic',
        kind: 'downloaded',
        status: 'completed',
        progress: 1,
        parentId: chapter.comicId,
        parentTitle: chapter.comicTitle,
        contentId: chapter.chapterId,
        contentTitle: chapter.chapterTitle,
        source: chapter.source,
        downloadedAt: chapter.downloadedAt,
      });
    }

    const videoQueue = Array.isArray(videoState?.queue) ? videoState.queue : [];
    for (const task of videoQueue) {
      if (!task || !task.episodeId) {
        continue;
      }
      items.push({
        key: `video_task_${task.episodeId}`,
        type: 'video',
        kind: 'task',
        status: task.status,
        progress: typeof task.progress === 'number' ? task.progress : 0,
        parentId: task.seriesId,
        parentTitle: task.seriesTitle,
        contentId: task.episodeId,
        contentTitle: task.episodeTitle,
        source: task.source,
        error: task.error,
      });
    }

    const videoDownloads = Array.from(videoDownloadManager.downloadedEpisodes?.values?.() || []);
    for (const episode of videoDownloads) {
      if (!episode || !episode.episodeId) {
        continue;
      }
      items.push({
        key: `video_done_${episode.episodeId}`,
        type: 'video',
        kind: 'downloaded',
        status: 'completed',
        progress: 1,
        parentId: episode.seriesId,
        parentTitle: episode.seriesTitle,
        contentId: episode.episodeId,
        contentTitle: episode.episodeTitle,
        source: episode.source,
        downloadedAt: episode.downloadedAt,
        outputPath: episode.outputPath,
      });
    }

    if (ebookState?.downloading?.id) {
      items.push({
        key: `ebook_task_${ebookState.downloading.id}`,
        type: 'ebook',
        kind: 'task',
        status: ebookState.status,
        progress: typeof ebookState.progress === 'number' ? ebookState.progress : 0,
        parentId: ebookState.downloading.id,
        parentTitle: ebookState.downloading.title,
        contentId: ebookState.downloading.id,
        contentTitle: ebookState.chapterTitle,
        source: ebookDownloadManager.getPendingDownloadInfo?.()?.source,
      });
    }

    const ebookDownloads = Array.isArray(ebookState?.downloadedBooks) ? ebookState.downloadedBooks : [];
    for (const book of ebookDownloads) {
      if (!book || !book.id) {
        continue;
      }
      items.push({
        key: `ebook_done_${book.id}`,
        type: 'ebook',
        kind: 'downloaded',
        status: 'completed',
        progress: 1,
        parentId: book.id,
        parentTitle: book.title,
        contentId: book.id,
        contentTitle: book.author,
        source: book.source,
        downloadedAt: book.downloadedAt,
      });
    }

    items.sort((a, b) => {
      const orderA = getStatusOrder(a.status);
      const orderB = getStatusOrder(b.status);
      if (orderA !== orderB) {
        return orderA - orderB;
      }

      const timeA = a.downloadedAt ? new Date(a.downloadedAt).getTime() : 0;
      const timeB = b.downloadedAt ? new Date(b.downloadedAt).getTime() : 0;
      return timeB - timeA;
    });

    return items;
  }, [comicState, videoState, ebookState]);

  const getCoverKey = (item) => {
    if (!item || !item.type || !item.parentId) {
      return '';
    }
    return `${item.type}_${item.parentId}`;
  };

  const resolveCoverFromResponse = (response) => {
    if (!response) {
      return '';
    }
    const data = response.data && typeof response.data === 'object' ? response.data : response;
    if (data && typeof data.cover === 'string' && data.cover) {
      return data.cover;
    }
    if (data && typeof data.coverUrl === 'string' && data.coverUrl) {
      return data.coverUrl;
    }
    if (data && typeof data.cover_url === 'string' && data.cover_url) {
      return data.cover_url;
    }
    if (data && typeof data.poster === 'string' && data.poster) {
      return data.poster;
    }
    if (data && typeof data.pic === 'string' && data.pic) {
      return data.pic;
    }
    if (data && typeof data.thumbnail === 'string' && data.thumbnail) {
      return data.thumbnail;
    }
    if (data && typeof data.thumb === 'string' && data.thumb) {
      return data.thumb;
    }
    if (data && typeof data.image === 'string' && data.image) {
      return data.image;
    }
    if (data && typeof data.img === 'string' && data.img) {
      return data.img;
    }
    return '';
  };

  useEffect(() => {
    const uniqueCandidates = new Map();
    for (const item of allItems) {
      if (!item || !item.parentId) {
        continue;
      }
      const coverKey = getCoverKey(item);
      if (!coverKey) {
        continue;
      }
      if (coverMap[coverKey]) {
        continue;
      }
      if (coverFailedKeys.has(coverKey)) {
        continue;
      }
      if (coverFetchingRef.current.has(coverKey)) {
        continue;
      }
      if (!uniqueCandidates.has(coverKey)) {
        uniqueCandidates.set(coverKey, item);
      }
    }

    const candidates = Array.from(uniqueCandidates.values()).slice(0, 8);
    if (candidates.length <= 0) {
      return;
    }

    const fetchCovers = async () => {
      await Promise.all(
        candidates.map(async (item) => {
          const coverKey = getCoverKey(item);
          if (!coverKey) {
            return;
          }
          coverFetchingRef.current.add(coverKey);

          try {
            let response;
            if (item.type === 'comic') {
              response = await getComicDetail(item.parentId, item.source || null);
            } else if (item.type === 'ebook') {
              response = await getEbookDetail(item.parentId, item.source || null);
            } else if (item.type === 'video') {
              response = await getSeriesDetail(item.parentId);
            }

            const cover = resolveCoverFromResponse(response);
            if (cover) {
              setCoverMap((prev) => ({
                ...prev,
                [coverKey]: cover,
              }));
              return;
            }

            setCoverFailedKeys((prev) => {
              const next = new Set(prev);
              next.add(coverKey);
              return next;
            });
          } catch {
            setCoverFailedKeys((prev) => {
              const next = new Set(prev);
              next.add(coverKey);
              return next;
            });
          } finally {
            coverFetchingRef.current.delete(coverKey);
          }
        })
      );
    };

    fetchCovers();
  }, [allItems, coverMap, coverFailedKeys]);

  const toggleMultiSelectMode = () => {
    setIsMultiSelectMode((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedIds(new Set());
      }
      return next;
    });
  };

  const toggleSelectItem = (key) => {
    if (!key) {
      return;
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        return next;
      }
      next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const allKeys = allItems.map((it) => it.key).filter(Boolean);
    if (allKeys.length <= 0) {
      return;
    }

    setSelectedIds((prev) => {
      if (prev.size === allKeys.length) {
        return new Set();
      }
      return new Set(allKeys);
    });
  };

  const getSelectedItems = () => {
    if (selectedIds.size <= 0) {
      return [];
    }
    return allItems.filter((it) => selectedIds.has(it.key));
  };

  const handleItemPress = (item) => {
    if (!item) {
      return;
    }

    if (isMultiSelectMode) {
      toggleSelectItem(item.key);
      return;
    }

    if (item.type === 'comic') {
      if (!item.contentId) {
        return;
      }
      const comicId = item.parentId;
      if (!comicId) {
        return;
      }
      const comicTitle = encodeURIComponent(item.parentTitle || '');
      router.push(`/reader/${item.contentId}?comicId=${comicId}&comicTitle=${comicTitle}`);
      return;
    }

    if (item.type === 'video') {
      if (!item.parentId) {
        return;
      }
      router.push(`/series/${item.parentId}`);
      return;
    }

    if (item.type === 'ebook') {
      if (!item.parentId) {
        return;
      }
      const bookTitle = encodeURIComponent(item.parentTitle || '');
      if (item.status === 'completed') {
        router.push(`/ebook-offline-reader/${item.parentId}?bookTitle=${bookTitle}`);
        return;
      }

      const source = encodeURIComponent(item.source || 'kanunu8');
      router.push(`/ebook/${item.parentId}?source=${source}`);
    }
  };

  const pauseOne = (item) => {
    if (!item) {
      return;
    }
    if (item.type === 'comic') {
      downloadManager.pauseDownload(item.contentId);
      return;
    }
    if (item.type === 'video') {
      videoDownloadManager.pauseDownload(item.contentId);
      return;
    }
    if (item.type === 'ebook') {
      ebookDownloadManager.pauseDownload();
    }
  };

  const resumeOne = async (item) => {
    if (!item) {
      return;
    }
    if (item.type === 'comic') {
      downloadManager.resumeDownload(item.contentId);
      return;
    }
    if (item.type === 'video') {
      videoDownloadManager.resumeDownload(item.contentId);
      return;
    }
    if (item.type === 'ebook') {
      await ebookDownloadManager.resumeDownload();
    }
  };

  const cancelOne = (item) => {
    if (!item) {
      return;
    }
    if (item.type === 'comic') {
      downloadManager.cancelDownload(item.contentId);
      return;
    }
    if (item.type === 'video') {
      videoDownloadManager.cancelDownload(item.contentId);
      return;
    }
    if (item.type === 'ebook') {
      ebookDownloadManager.cancelDownload();
    }
  };

  const retryOne = (item) => {
    if (!item) {
      return;
    }
    if (item.type === 'comic') {
      downloadManager.retryDownload(item.contentId);
      return;
    }
    if (item.type === 'video') {
      videoDownloadManager.retryDownload(item.contentId);
    }
  };

  const deleteOne = async (item) => {
    if (!item) {
      return;
    }
    if (item.type === 'comic') {
      await downloadManager.deleteDownloadedChapter(item.contentId);
      return;
    }
    if (item.type === 'video') {
      if (!item.parentId) {
        return;
      }
      await videoDownloadManager.deleteEpisode(item.parentId, item.contentId);
      return;
    }
    if (item.type === 'ebook') {
      await ebookDownloadManager.deleteBook(item.parentId);
    }
  };

  const handleBatchPause = () => {
    const selected = getSelectedItems();
    for (const it of selected) {
      if (!it) {
        continue;
      }
      if (it.status === 'downloading' || it.status === 'pending') {
        pauseOne(it);
      }
    }
  };

  const handleBatchResume = async () => {
    const selected = getSelectedItems();
    for (const it of selected) {
      if (!it) {
        continue;
      }
      if (it.status === 'paused') {
        await resumeOne(it);
      }
    }
  };

  const handleBatchCancel = () => {
    const selected = getSelectedItems();
    for (const it of selected) {
      if (!it) {
        continue;
      }
      if (it.status === 'completed') {
        continue;
      }
      cancelOne(it);
    }
  };

  const handleBatchDelete = async () => {
    const selected = getSelectedItems();
    for (const it of selected) {
      if (!it) {
        continue;
      }
      if (it.status !== 'completed') {
        continue;
      }
      await deleteOne(it);
    }
  };

  const handleBatchRetry = () => {
    const selected = getSelectedItems();
    for (const it of selected) {
      if (!it) {
        continue;
      }
      if (it.status === 'failed') {
        retryOne(it);
      }
    }
  };

  const confirmDeleteOne = (item) => {
    if (!item) {
      return;
    }

    const title = item.contentTitle || item.parentTitle || '';
    Alert.alert(
      '确认删除',
      `确定要删除 "${title}" 吗`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteOne(item);
            } catch (e) {
              const msg = e && e.message ? e.message : '';
              Alert.alert('删除失败', msg || '请稍后重试');
            }
          },
        },
      ]
    );
  };

  const confirmBatchDelete = () => {
    const selected = getSelectedItems().filter((it) => it && it.status === 'completed');
    if (selected.length <= 0) {
      return;
    }
    Alert.alert(
      '确认删除',
      `确定要删除 ${selected.length} 个已下载内容吗`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            await handleBatchDelete();
            setSelectedIds(new Set());
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const checked = selectedIds.has(item.key);
    const coverKey = getCoverKey(item);
    const coverUri = coverKey ? coverMap[coverKey] : '';
    const coverFailed = coverKey ? coverFailedKeys.has(coverKey) : true;
    const showProgress = true;
    const progressValue = item.status === 'completed' ? 1 : typeof item.progress === 'number' ? item.progress : 0;
    const percent = Math.round(progressValue * 100);
    const statusText = getStatusText(item.status);
    const downloadedText = item.downloadedAt ? formatDateTime(item.downloadedAt) : '';

    const showPause = item.status === 'downloading' || item.status === 'pending';
    const showResume = item.status === 'paused';
    const showCancel = item.status !== 'completed';
    const showRetry = item.status === 'failed' && item.type !== 'ebook';
    const showDelete = item.status === 'completed';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.rowTop}>
          {isMultiSelectMode && (
            <View style={styles.checkboxWrap}>
              <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                {checked ? <Text style={styles.checkboxText}>✓</Text> : null}
              </View>
            </View>
          )}

          {!coverFailed && coverUri ? (
            <Image
              source={{ uri: coverUri }}
              style={styles.cover}
              resizeMode="cover"
              onError={() => {
                if (!coverKey) {
                  return;
                }
                setCoverFailedKeys((prev) => {
                  const next = new Set(prev);
                  next.add(coverKey);
                  return next;
                });
              }}
            />
          ) : (
            <View style={[styles.cover, styles.coverPlaceholder]}>
              <Text style={styles.coverPlaceholderText}>{item.type === 'comic' ? '📚' : item.type === 'video' ? '🎬' : '📖'}</Text>
            </View>
          )}

          <View style={styles.info}>
            <Text style={styles.parentTitle} numberOfLines={1}>
              {item.parentTitle || ''}
            </Text>
            <Text style={styles.contentTitle} numberOfLines={2}>
              {item.contentTitle || ''}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {item.type === 'comic' ? '漫画' : item.type === 'video' ? '视频' : '电子书'}
              {'  '}
              {statusText}
              {downloadedText ? `  ${downloadedText}` : ''}
            </Text>
          </View>
        </View>

        {showProgress && (
          <View style={styles.progressWrap}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${Math.min(Math.max(percent, 0), 100)}%` }]} />
            </View>
            <Text style={styles.progressText}>{`${percent}%`}</Text>
          </View>
        )}

        {!isMultiSelectMode && (
          <View style={styles.actions}>
            {showPause && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={(e) => {
                  if (e && typeof e.stopPropagation === 'function') {
                    e.stopPropagation();
                  }
                  pauseOne(item);
                }}
              >
                <Text style={styles.actionText}>暂停</Text>
              </TouchableOpacity>
            )}
            {showResume && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={async (e) => {
                  if (e && typeof e.stopPropagation === 'function') {
                    e.stopPropagation();
                  }
                  await resumeOne(item);
                }}
              >
                <Text style={styles.actionText}>开始</Text>
              </TouchableOpacity>
            )}
            {showRetry && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={(e) => {
                  if (e && typeof e.stopPropagation === 'function') {
                    e.stopPropagation();
                  }
                  retryOne(item);
                }}
              >
                <Text style={styles.actionText}>重试</Text>
              </TouchableOpacity>
            )}
            {showCancel && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionDanger]}
                onPress={(e) => {
                  if (e && typeof e.stopPropagation === 'function') {
                    e.stopPropagation();
                  }
                  cancelOne(item);
                }}
              >
                <Text style={[styles.actionText, styles.actionDangerText]}>取消</Text>
              </TouchableOpacity>
            )}
            {showDelete && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionDanger]}
                onPress={(e) => {
                  if (e && typeof e.stopPropagation === 'function') {
                    e.stopPropagation();
                  }
                  confirmDeleteOne(item);
                }}
              >
                <Text style={[styles.actionText, styles.actionDangerText]}>删除</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📦</Text>
      <Text style={styles.emptyText}>还没有下载任何内容</Text>
      <Text style={styles.emptyHint}>
        在内容页点击下载即可加入队列
      </Text>
    </View>
  );

  const selectedCount = selectedIds.size;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>下载管理</Text>
          {isMultiSelectMode ? (
            <Text style={styles.headerCount}>{`已选 ${selectedCount}`}</Text>
          ) : (
            <Text style={styles.headerCount}>{`${allItems.length} 条记录`}</Text>
          )}
        </View>
        <TouchableOpacity style={styles.headerRightBtn} onPress={toggleMultiSelectMode}>
          <Text style={styles.headerRightText}>{isMultiSelectMode ? '完成' : '批量'}</Text>
        </TouchableOpacity>
      </View>

      {isMultiSelectMode && (
        <View style={styles.batchBar}>
          <TouchableOpacity style={styles.batchBtn} onPress={toggleSelectAll}>
            <Text style={styles.batchText}>{selectedIds.size === allItems.length && allItems.length > 0 ? '取消全选' : '全选'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.batchBtn} onPress={handleBatchResume}>
            <Text style={styles.batchText}>开始</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.batchBtn} onPress={handleBatchPause}>
            <Text style={styles.batchText}>暂停</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.batchBtn} onPress={handleBatchRetry}>
            <Text style={styles.batchText}>重试</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.batchBtn, styles.batchDanger]} onPress={handleBatchCancel}>
            <Text style={[styles.batchText, styles.batchDangerText]}>取消</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.batchBtn, styles.batchDanger]} onPress={confirmBatchDelete}>
            <Text style={[styles.batchText, styles.batchDangerText]}>删除</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={allItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        contentContainerStyle={allItems.length === 0 ? styles.emptyList : styles.list}
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    fontSize: 20,
    color: '#333',
    fontWeight: '600',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  headerCount: {
    fontSize: 14,
    color: '#666',
  },
  headerRightBtn: {
    paddingHorizontal: 12,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRightText: {
    fontSize: 14,
    color: '#6200EE',
    fontWeight: '600',
  },
  batchBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  batchBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#6200EE',
  },
  batchText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  batchDanger: {
    backgroundColor: '#f5f5f5',
  },
  batchDangerText: {
    color: '#ff4444',
  },
  list: {
    padding: 12,
  },
  emptyList: {
    flex: 1,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkboxWrap: {
    marginRight: 10,
  },
  cover: {
    width: 64,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    marginRight: 12,
  },
  coverPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
  },
  coverPlaceholderText: {
    fontSize: 20,
    color: '#666',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    borderColor: '#6200EE',
    backgroundColor: '#6200EE',
  },
  checkboxText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  parentTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  contentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  meta: {
    fontSize: 12,
    color: '#999',
  },
  progressWrap: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6200EE',
  },
  progressText: {
    width: 50,
    textAlign: 'right',
    fontSize: 12,
    color: '#666',
  },
  actions: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#6200EE',
  },
  actionText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  actionDanger: {
    backgroundColor: '#f5f5f5',
  },
  actionDangerText: {
    color: '#ff4444',
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
