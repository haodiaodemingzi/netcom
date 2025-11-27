import React from 'react';
import { 
  View, 
  Text, 
  Image, 
  TouchableOpacity, 
  StyleSheet 
} from 'react-native';
import { useRouter } from 'expo-router';

const ComicCard = ({ comic, darkMode = false }) => {
  const router = useRouter();

  const handlePress = () => {
    router.push(`/comic/${comic.id}`);
  };

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Image 
        source={{ uri: comic.cover }} 
        style={styles.cover}
        resizeMode="cover"
      />
      <View style={styles.info}>
        <Text 
          style={[
            styles.title, 
            darkMode && styles.titleDark
          ]} 
          numberOfLines={2}
        >
          {comic.title}
        </Text>
        {comic.latestChapter && (
          <Text 
            style={[
              styles.chapter, 
              darkMode && styles.chapterDark
            ]} 
            numberOfLines={1}
          >
            {comic.latestChapter}
          </Text>
        )}
        <View style={styles.meta}>
          {comic.status && (
            <Text 
              style={[
                styles.statusText, 
                darkMode && styles.statusTextDark
              ]}
            >
              {comic.status === 'completed' ? '完结' : '连载'}
            </Text>
          )}
          {comic.rating && (
            <Text 
              style={[
                styles.rating, 
                darkMode && styles.ratingDark
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
  cover: {
    width: '100%',
    aspectRatio: 0.7,
    backgroundColor: '#f0f0f0',
  },
  info: {
    padding: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  titleDark: {
    color: '#fff',
  },
  chapter: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  chapterDark: {
    color: '#aaa',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusText: {
    fontSize: 10,
    color: '#666',
    fontWeight: '600',
  },
  statusTextDark: {
    color: '#aaa',
  },
  rating: {
    fontSize: 12,
    color: '#666',
  },
  ratingDark: {
    color: '#aaa',
  },
});

export default ComicCard;
