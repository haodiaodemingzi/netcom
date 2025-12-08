import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const SourceCard = ({ source, isInstalled, onInstall, onUninstall, onPress }) => {
  // 状态：跟踪图片是否加载失败
  const [imageError, setImageError] = useState(false);
  
  // 当source.icon变化时，重置错误状态
  useEffect(() => {
    setImageError(false);
  }, [source.icon]);
  
  const handleAction = () => {
    if (isInstalled) {
      onUninstall?.(source.id);
    } else {
      onInstall?.(source.id, source.category);
    }
  };

  // 本地默认图标
  const defaultIconSource = require('../assets/icon.png');
  
  // 确定要显示的图标
  const hasValidIcon = source.icon && !imageError;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(source)}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        {/* 图标 */}
        <View style={styles.iconContainer}>
          {hasValidIcon ? (
            <Image
              source={{ uri: source.icon }}
              style={styles.icon}
              onError={() => {
                // 如果图片加载失败，切换到默认图标
                if (!imageError) {
                  setImageError(true);
                }
              }}
            />
          ) : (
            <Image
              source={defaultIconSource}
              style={styles.icon}
            />
          )}
        </View>

        {/* 信息 */}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {source.name}
          </Text>
          <Text style={styles.description} numberOfLines={2}>
            {source.description}
          </Text>

          {/* 标签 */}
          {source.tags && source.tags.length > 0 && (
            <View style={styles.tags}>
              {source.tags.slice(0, 3).map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 操作按钮 */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            isInstalled ? styles.uninstallButton : styles.installButton,
          ]}
          onPress={handleAction}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.actionText,
              isInstalled ? styles.uninstallText : styles.installText,
            ]}
          >
            {isInstalled ? '已安装' : '安装'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 已安装标识 */}
      {isInstalled && (
        <View style={styles.installedBadge}>
          <Text style={styles.installedText}>✓</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 12,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  iconPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
  },
  iconText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#666',
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    lineHeight: 16,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  tag: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 4,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 10,
    color: '#666',
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  installButton: {
    backgroundColor: '#007AFF',
  },
  uninstallButton: {
    backgroundColor: '#f0f0f0',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  installText: {
    color: '#fff',
  },
  uninstallText: {
    color: '#666',
  },
  installedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  installedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default SourceCard;

