import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getChapterContent } from '../../services/api';

const EbookReaderScreen = () => {
  const router = useRouter();
  const { chapterId, source = 'kanunu8' } = useLocalSearchParams();
  const [fontSize, setFontSize] = useState(17);
  const [theme, setTheme] = useState('light');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [chapterTitle, setChapterTitle] = useState('');

  useEffect(() => {
    loadChapterContent();
  }, [chapterId]);

  const loadChapterContent = async () => {
    try {
      setLoading(true);
      const data = await getChapterContent(chapterId, source);
      setContent(data.content || '');
      setChapterTitle(data.title || '');
    } catch (error) {
      console.error('加载章节内容失败:', error);
      setContent('加载失败,请重试');
    } finally {
      setLoading(false);
    }
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const increaseFont = () => setFontSize((size) => Math.min(size + 1, 22));
  const decreaseFont = () => setFontSize((size) => Math.max(size - 1, 14));

  return (
    <SafeAreaView
      style={[
        styles.container,
        theme === 'dark' ? styles.containerDark : styles.containerLight,
      ]}
      edges={['top']}
    >
      <View style={styles.toolbar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.toolbarBtn}>返回</Text>
        </TouchableOpacity>
        <View style={styles.toolbarGroup}>
          <TouchableOpacity onPress={decreaseFont}>
            <Text style={styles.toolbarBtn}>A-</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={increaseFont}>
            <Text style={styles.toolbarBtn}>A+</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleTheme}>
            <Text style={styles.toolbarBtn}>
              {theme === 'light' ? '夜间' : '日间'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.readerContent}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6200EE" />
          </View>
        ) : (
          <>
            {chapterTitle && (
              <Text
                style={[
                  styles.chapterTitle,
                  theme === 'dark' ? styles.chapterTextDark : styles.chapterTextLight,
                ]}
              >
                {chapterTitle}
              </Text>
            )}
            <Text
              style={[
                styles.chapterText,
                theme === 'dark' ? styles.chapterTextDark : styles.chapterTextLight,
                { fontSize },
              ]}
            >
              {content}
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerLight: {
    backgroundColor: '#fefefe',
  },
  containerDark: {
    backgroundColor: '#121212',
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomColor: '#ddd',
    borderBottomWidth: 1,
  },
  toolbarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolbarBtn: {
    color: '#6200EE',
    fontSize: 14,
    marginHorizontal: 6,
  },
  readerContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  chapterTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  chapterText: {
    lineHeight: 28,
    letterSpacing: 0.2,
  },
  chapterTextLight: {
    color: '#222',
  },
  chapterTextDark: {
    color: '#eee',
  },
});

export default EbookReaderScreen;

