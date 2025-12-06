import React from 'react';
import { 
  View, 
  Text, 
  Image, 
  TouchableOpacity, 
  StyleSheet 
} from 'react-native';
import { useRouter } from 'expo-router';

const ComicCard = ({ comic, darkMode = false, viewMode = 'card' }) => {
  const router = useRouter();
  const isList = viewMode === 'list';

  const handlePress = () => {
    router.push(`/comic/${comic.id}`);
  };

  return (
    <TouchableOpacity 
      style={[styles.card, isList && styles.cardList]} 
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Image 
        source={{ uri: comic.cover }} 
        style={[styles.cover, isList && styles.coverList]}
        resizeMode="cover"
      />
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
        {comic.latestChapter && (
          <Text 
            style={[
              styles.chapter, 
              darkMode && styles.chapterDark,
              isList && styles.chapterList
            ]} 
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {comic.latestChapter}
          </Text>
        )}
        <View style={[styles.meta, isList && styles.metaList]}>
          {comic.status && (
            <Text 
              style={[
                styles.statusText, 
                darkMode && styles.statusTextDark,
                isList && styles.statusTextList
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {comic.status === 'completed' ? '完结' : '连载'}
            </Text>
          )}
          {comic.rating && (
            <Text 
              style={[
                styles.rating, 
                darkMode && styles.ratingDark,
                isList && styles.ratingList
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              ⭐ {comic.rating}
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
    marginHorizontal: 8,
    marginVertical: 4,
    borderRadius: 6,
    borderBottomWidth: 0,
    elevation: 1,
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    height: 100, // 列表模式固定高度
  },
  cover: {
    width: '100%',
    height: 200, // 固定封面高度
    backgroundColor: '#f0f0f0',
  },
  coverList: {
    width: 75,
    height: 88, // 固定封面高度，与列表卡片高度匹配
    borderRadius: 4,
    margin: 6,
  },
  info: {
    padding: 12,
    height: 80, // 固定信息区域高度
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
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
    minHeight: 40, // 确保标题区域有最小高度（2行）
    lineHeight: 20,
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
    justifyContent: 'space-between',
    minHeight: 20, // 确保元数据区域有固定高度
  },
  metaList: {
    justifyContent: 'flex-start',
    gap: 8,
  },
  statusText: {
    fontSize: 10,
    color: '#666',
    fontWeight: '600',
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
