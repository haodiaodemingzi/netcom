import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import ImageViewer from '../../components/ImageViewer';
import ReaderToolbar from '../../components/ReaderToolbar';
import { getChapterImages } from '../../services/api';
import { getSettings, addHistory, getCurrentSource } from '../../services/storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ReaderScreen = () => {
  const router = useRouter();
  const { chapterId } = useLocalSearchParams();
  const flatListRef = useRef(null);

  const [images, setImages] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [settings, setSettings] = useState({
    readingMode: 'single',
    imageFitMode: 'width',
    backgroundColor: 'black',
  });
  const [currentSource, setCurrentSource] = useState('guoman8');

  useEffect(() => {
    loadData();
  }, [chapterId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const source = await getCurrentSource();
      setCurrentSource(source);
      
      const [imagesData, settingsData] = await Promise.all([
        getChapterImages(chapterId, source),
        getSettings(),
      ]);
      setImages(imagesData.images || []);
      setSettings(settingsData);
    } catch (error) {
      console.error('加载章节图片失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page) => {
    const index = page - 1;
    if (index >= 0 && index < images.length) {
      flatListRef.current?.scrollToIndex({
        index,
        animated: true,
      });
      setCurrentPage(page);
    }
  };

  const handleViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const page = viewableItems[0].index + 1;
      setCurrentPage(page);
    }
  }).current;

  const toggleToolbar = () => {
    setToolbarVisible(!toolbarVisible);
  };

  const handleClose = () => {
    router.back();
  };

  const renderItem = ({ item, index }) => (
    <TouchableOpacity
      activeOpacity={1}
      onPress={toggleToolbar}
      style={styles.imageContainer}
    >
      <ImageViewer
        imageUrl={item.url}
        fitMode={settings.imageFitMode}
      />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200EE" />
      </View>
    );
  }

  return (
    <View 
      style={[
        styles.container,
        { backgroundColor: settings.backgroundColor },
      ]}
    >
      <StatusBar hidden />
      
      <FlatList
        ref={flatListRef}
        data={images}
        renderItem={renderItem}
        keyExtractor={(item, index) => index.toString()}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={{
          itemVisiblePercentThreshold: 50,
        }}
        getItemLayout={(data, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      <ReaderToolbar
        visible={toolbarVisible}
        currentPage={currentPage}
        totalPages={images.length}
        chapterTitle={`第 ${chapterId} 章`}
        onPrevChapter={null}
        onNextChapter={null}
        onPageChange={handlePageChange}
        onChapterListPress={() => {
          router.back();
        }}
        onSettingsPress={() => {
          // TODO: 打开设置面板
        }}
        onClose={handleClose}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ReaderScreen;
