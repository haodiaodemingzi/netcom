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
    flex: 1,
    margin: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: 'hidden',
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
  },
  cover: {
    width: '100%',
    aspectRatio: 0.7,
    backgroundColor: '#f0f0f0',
  },
  coverList: {
    width: 75,
    aspectRatio: 0.66,
    borderRadius: 4,
    margin: 6,
  },
  info: {
    padding: 12,
  },
  infoList: {
    flex: 1,
    paddingVertical: 8,
    paddingRight: 10,
    paddingLeft: 0,
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  titleList: {
    fontSize: 15,
    marginBottom: 3,
  },
  titleDark: {
    color: '#fff',
  },
  chapter: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  chapterList: {
    fontSize: 12,
    marginBottom: 4,
  },
  chapterDark: {
    color: '#aaa',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    color: '#666',
  },
  ratingList: {
    fontSize: 12,
  },
  ratingDark: {
    color: '#aaa',
  },
});

export default ComicCard;
