import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

const BookCard = ({ book, viewMode = 'card' }) => {
  const router = useRouter();
  const isList = viewMode === 'list';

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
    <TouchableOpacity 
      style={[styles.card, isList && styles.cardList]} 
      onPress={handlePress} 
      activeOpacity={0.7}
    >
      <View style={[styles.cover, isList && styles.coverList, { backgroundColor }]}>
        <Text style={[styles.bookIcon, isList && styles.bookIconList]}>📖</Text>
      </View>
      <View style={[styles.info, isList && styles.infoList]}>
        <Text style={[styles.title, isList && styles.titleList]} numberOfLines={isList ? 1 : 2}>
          {book.title}
        </Text>
        <Text style={[styles.author, isList && styles.authorList]} numberOfLines={1}>
          {book.author}
        </Text>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverList: {
    width: 75,
    height: 88, // 固定封面高度，与列表卡片高度匹配
    borderRadius: 4,
    margin: 6,
  },
  bookIcon: {
    fontSize: 24,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  bookIconList: {
    fontSize: 20,
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
    color: '#111',
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
  author: {
    fontSize: 12,
    color: '#666',
    minHeight: 16, // 确保作者区域有固定高度
    lineHeight: 16,
  },
  authorList: {
    fontSize: 13,
    minHeight: 16,
    lineHeight: 16,
  },
});

export default BookCard;

