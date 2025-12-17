import React, { useState } from 'react';
import { 
  View, 
  Text, 
  Image, 
  TouchableOpacity, 
  StyleSheet 
} from 'react-native';
import { useRouter } from 'expo-router';

const ComicCard = ({ comic, darkMode = false, viewMode = 'card', onPress }) => {
  const router = useRouter();
  const isList = viewMode === 'list';
  const [imageError, setImageError] = useState(false);

  if (!comic || !comic.id) {
    return null;
  }

  const handlePress = () => {
    if (typeof onPress === 'function') {
      onPress(comic);
      return;
    }
    router.push(`/comic/${comic.id}`);
  };

  const hasCover = !imageError && !!comic.cover;

  return (
    <TouchableOpacity 
      style={[styles.card, isList && styles.cardList]} 
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {hasCover ? (
        <Image 
          source={{ uri: comic.cover }} 
          style={[styles.cover, isList && styles.coverList]}
          resizeMode="cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <View style={[styles.cover, isList && styles.coverList, styles.coverPlaceholder]}>
          <Text style={styles.coverPlaceholderText}>📚</Text>
        </View>
      )}
      <View style={[styles.info, isList && styles.infoList]}>
        <Text 
          style={[
            styles.title, 
            darkMode && styles.titleDark,
            isList && styles.titleList
          ]} 
          numberOfLines={isList ? 1 : 2}
          ellipsizeMode="tail"
        >
          {comic.title}
        </Text>
        {/* 卡片模式：作者和标签放一排 */}
        {!isList && (
          <View style={styles.authorTagRow}>
            {comic.author && (
              <Text 
                style={[styles.authorInline, darkMode && styles.authorDark]} 
                numberOfLines={1}
              >
                {comic.author}
              </Text>
            )}
            {comic.tags && comic.tags.length > 0 && (
              <View style={styles.tagsInline}>
                {comic.tags.slice(0, 2).map((tag, index) => (
                  <View key={index} style={[styles.tag, darkMode && styles.tagDark]}>
                    <Text style={[styles.tagText, darkMode && styles.tagTextDark]}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
        {/* 列表模式：作者单独一行 */}
        {isList && comic.author && (
          <Text 
            style={[styles.author, darkMode && styles.authorDark, styles.authorList]} 
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {comic.author}
          </Text>
        )}
        {/* 列表模式：标签单独一行 */}
        {isList && comic.tags && comic.tags.length > 0 && (
          <View style={[styles.tagsContainer, styles.tagsContainerList]}>
            {comic.tags.slice(0, 4).map((tag, index) => (
              <View key={index} style={[styles.tag, darkMode && styles.tagDark]}>
                <Text style={[styles.tagText, darkMode && styles.tagTextDark]}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
        {/* 底部状态 */}
        <View style={[styles.meta, isList && styles.metaList]}>
          {comic.status && (
            <Text 
              style={[
                styles.statusText, 
                darkMode && styles.statusTextDark,
                isList && styles.statusTextList
              ]}
              numberOfLines={1}
            >
              {comic.status === 'completed' ? '完结' : '连载'}
            </Text>
          )}
          {isList && comic.latestChapter && (
            <Text 
              style={[styles.chapter, darkMode && styles.chapterDark, styles.chapterList]} 
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {comic.latestChapter}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    height: 280, // 固定高度，确保卡片高度一致
  },
  cardList: {
    flexDirection: 'row',
    marginHorizontal: 0,
    marginVertical: 0,
    marginBottom: 0,
    borderRadius: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    height: 100,
  },
  cover: {
    width: '100%',
    height: 200, // 固定封面高度
    backgroundColor: '#f0f0f0',
  },
  coverPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
  },
  coverPlaceholderText: {
    fontSize: 24,
    color: '#666',
  },
  coverList: {
    width: 75,
    height: 88, // 固定封面高度，与列表卡片高度匹配
    borderRadius: 4,
    margin: 6,
  },
  info: {
    padding: 8,
    paddingTop: 6,
    height: 74,
    justifyContent: 'space-between',
  },
  infoList: {
    flex: 1,
    paddingVertical: 8,
    paddingRight: 10,
    paddingLeft: 0,
    justifyContent: 'center',
    height: 88, // 与封面高度匹配
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
    lineHeight: 17,
  },
  titleList: {
    fontSize: 15,
    marginBottom: 3,
    minHeight: 20, // 列表模式单行高度
    lineHeight: 20,
  },
  titleDark: {
    color: '#fff',
  },
  authorTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    height: 16,
    overflow: 'hidden',
  },
  authorInline: {
    fontSize: 10,
    color: '#888',
    marginRight: 4,
    flexShrink: 1,
  },
  tagsInline: {
    flexDirection: 'row',
    flexShrink: 0,
    gap: 2,
  },
  author: {
    fontSize: 11,
    color: '#888',
    marginBottom: 3,
    lineHeight: 14,
  },
  authorList: {
    fontSize: 12,
    marginBottom: 2,
  },
  authorDark: {
    color: '#aaa',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
    gap: 3,
  },
  tagsContainerList: {
    marginBottom: 3,
  },
  tag: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  tagDark: {
    backgroundColor: '#333',
  },
  tagText: {
    fontSize: 8,
    color: '#666',
  },
  tagTextDark: {
    color: '#aaa',
  },
  chapter: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    minHeight: 16, // 确保章节区域有固定高度
    lineHeight: 16,
  },
  chapterList: {
    fontSize: 12,
    marginBottom: 4,
    minHeight: 16,
    lineHeight: 16,
  },
  chapterDark: {
    color: '#aaa',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    height: 14,
  },
  metaList: {
    justifyContent: 'flex-start',
    gap: 8,
  },
  statusText: {
    fontSize: 9,
    color: '#888',
    fontWeight: '500',
  },
  statusTextList: {
    fontSize: 11,
  },
  statusTextDark: {
    color: '#aaa',
  },
  rating: {
    fontSize: 12,
    color: '#ff9800',
    fontWeight: '600',
  },
  ratingList: {
    fontSize: 12,
  },
  ratingDark: {
    color: '#aaa',
  },
});

export default ComicCard;
