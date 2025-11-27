import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Slider,
} from 'react-native';

const ReaderToolbar = ({
  visible,
  currentPage,
  totalPages,
  chapterTitle,
  onPrevChapter,
  onNextChapter,
  onPageChange,
  onChapterListPress,
  onSettingsPress,
  onClose,
}) => {
  if (!visible) return null;

  return (
    <>
      {/* 顶部工具栏 */}
      <View style={styles.topBar}>
        <TouchableOpacity 
          onPress={onClose}
          style={styles.iconButton}
        >
          <Text style={styles.iconText}>←</Text>
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.chapterTitle} numberOfLines={1}>
            {chapterTitle}
          </Text>
        </View>
        <TouchableOpacity 
          onPress={onSettingsPress}
          style={styles.iconButton}
        >
          <Text style={styles.iconText}>⚙</Text>
        </TouchableOpacity>
      </View>

      {/* 底部工具栏 */}
      <View style={styles.bottomBar}>
        <View style={styles.progressContainer}>
          <Text style={styles.pageText}>
            {currentPage} / {totalPages}
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={totalPages}
            value={currentPage}
            onValueChange={onPageChange}
            minimumTrackTintColor="#6200EE"
            maximumTrackTintColor="#ccc"
            thumbTintColor="#6200EE"
            step={1}
          />
        </View>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.navButton,
              !onPrevChapter && styles.navButtonDisabled,
            ]}
            onPress={onPrevChapter}
            disabled={!onPrevChapter}
          >
            <Text style={styles.navButtonText}>上一章</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.chapterButton}
            onPress={onChapterListPress}
          >
            <Text style={styles.chapterButtonText}>章节</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.navButton,
              !onNextChapter && styles.navButtonDisabled,
            ]}
            onPress={onNextChapter}
            disabled={!onNextChapter}
          >
            <Text style={styles.navButtonText}>下一章</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 8,
    zIndex: 10,
  },
  iconButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 24,
    color: '#fff',
  },
  titleContainer: {
    flex: 1,
    paddingHorizontal: 8,
  },
  chapterTitle: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 10,
  },
  progressContainer: {
    marginBottom: 12,
  },
  pageText: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#6200EE',
    borderRadius: 4,
    marginHorizontal: 4,
  },
  navButtonDisabled: {
    backgroundColor: '#555',
  },
  navButtonText: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
  chapterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#03DAC6',
    borderRadius: 4,
    marginHorizontal: 4,
  },
  chapterButtonText: {
    fontSize: 14,
    color: '#000',
    textAlign: 'center',
    fontWeight: '600',
  },
});

export default ReaderToolbar;
