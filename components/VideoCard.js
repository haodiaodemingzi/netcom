import React from 'react';
import { 
  View, 
  Text, 
  Image, 
  TouchableOpacity, 
  StyleSheet 
} from 'react-native';
import { useRouter } from 'expo-router';

const VideoCard = ({ video, darkMode = false, viewMode = 'card', onPress }) => {
  const router = useRouter();
  const isList = viewMode === 'list';
  const [imageError, setImageError] = React.useState(false);

  if (!video || !video.id) {
    return null;
  }

  const handlePress = () => {
    if (typeof onPress === 'function') {
      onPress(video);
      return;
    }
    const source = typeof video.source === 'string' ? video.source.trim() : '';
    const suffix = source ? `?source=${encodeURIComponent(source)}` : '';
    router.push(`/series/${video.id}${suffix}`);
  };

  // 获取封面URL，如果为空或加载失败则使用占位图
  const getCoverUri = () => {
    if (imageError || !video.cover) {
      return 'https://via.placeholder.com/200x300/e0e0e0/666666?text=No+Image';
    }
    return video.cover;
  };

  return (
    <TouchableOpacity 
      style={[styles.card, isList && styles.cardList]} 
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Image 
        source={{ uri: getCoverUri() }} 
        style={[styles.cover, isList && styles.coverList]}
        resizeMode="cover"
        onError={(e) => {
          if (!imageError) {
            console.log('封面图片加载失败:', video.cover || '(URL为空)');
            setImageError(true);
          }
        }}
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
          {video.title}
        </Text>
        {video.episodes && (
          <Text 
            style={[
              styles.episodes, 
              darkMode && styles.episodesDark,
              isList && styles.episodesList
            ]} 
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {video.episodes} 集
          </Text>
        )}
        <View style={[styles.meta, isList && styles.metaList]}>
          {video.rating && (
            <Text 
              style={[
                styles.rating, 
                darkMode && styles.ratingDark,
                isList && styles.ratingList
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              ⭐ {video.rating}
            </Text>
          )}
          {video.status && (
            <Text 
              style={[
                styles.statusText, 
                darkMode && styles.statusTextDark,
                isList && styles.statusTextList
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {video.status === '完结' ? '完结' : '连载中'}
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
  episodes: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    minHeight: 16, // 确保集数区域有固定高度
    lineHeight: 16,
  },
  episodesList: {
    fontSize: 12,
    marginBottom: 4,
    minHeight: 16,
    lineHeight: 16,
  },
  episodesDark: {
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
  rating: {
    fontSize: 12,
    color: '#ff9800',
    fontWeight: '600',
  },
  ratingList: {
    fontSize: 12,
  },
  ratingDark: {
    color: '#ffb74d',
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
});

export default VideoCard;

