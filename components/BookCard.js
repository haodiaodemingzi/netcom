import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

const BookCard = ({ book }) => {
  const router = useRouter();

  const handlePress = () => {
    router.push(`/ebook/${book.id}`);
  };

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.7}>
      <Image source={{ uri: book.cover }} style={styles.cover} resizeMode="cover" />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {book.title}
        </Text>
        {book.latestChapter?.title && (
          <Text style={styles.chapter} numberOfLines={1}>
            {book.latestChapter.title}
          </Text>
        )}
        <View style={styles.meta}>
          <Text style={styles.status}>
            {book.status === 'completed' ? '完结' : '连载'}
          </Text>
          <Text style={styles.wordCount}>{book.wordCount}</Text>
        </View>
        <Text style={styles.author} numberOfLines={1}>
          {book.author}
        </Text>
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
    color: '#111',
    marginBottom: 4,
  },
  chapter: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  status: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },
  wordCount: {
    fontSize: 12,
    color: '#999',
  },
  author: {
    fontSize: 12,
    color: '#666',
  },
});

export default BookCard;

