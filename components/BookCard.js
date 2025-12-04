import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

const BookCard = ({ book }) => {
  const router = useRouter();

  const handlePress = () => {
    router.push(`/ebook/${book.id}?source=kanunu8`);
  };

  // 简单的随机纯色背景
  const getRandomColor = (id) => {
    const colors = ['#2196F3', '#4CAF50', '#F44336', '#FF9800', '#9C27B0'];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const backgroundColor = getRandomColor(book.id);

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.7}>
      <View style={[styles.cover, { backgroundColor }]}>
        <Text style={styles.bookIcon}>📖</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {book.title}
        </Text>
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
    margin: 4,
    borderRadius: 4,
    backgroundColor: '#fff',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
    overflow: 'hidden',
  },
  cover: {
    width: '100%',
    aspectRatio: 0.9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookIcon: {
    fontSize: 24,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  info: {
    padding: 6,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111',
    marginBottom: 1,
  },
  author: {
    fontSize: 10,
    color: '#666',
  },
});

export default BookCard;

