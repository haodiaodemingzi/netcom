import React, { useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ebookChapterContent } from '../../mock/ebooks';

const EbookReaderScreen = () => {
  const router = useRouter();
  const { chapterId } = useLocalSearchParams();
  const [fontSize, setFontSize] = useState(17);
  const [theme, setTheme] = useState('light');

  const content = useMemo(
    () => ebookChapterContent(chapterId),
    [chapterId]
  );

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
        <Text
          style={[
            styles.chapterText,
            theme === 'dark' ? styles.chapterTextDark : styles.chapterTextLight,
            { fontSize },
          ]}
        >
          {content}
        </Text>
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

