import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getSourceDetail } from '../../services/marketApi';
import {
  installSource,
  uninstallSource,
  isSourceInstalled,
} from '../../services/storage';

const SourceDetailScreen = () => {
  const router = useRouter();
  const { sourceId } = useLocalSearchParams();
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    loadSourceDetail();
    checkInstalled();
  }, [sourceId]);

  const loadSourceDetail = async () => {
    setLoading(true);
    try {
      const result = await getSourceDetail(sourceId);
      if (result.success) {
        setSource(result.data);
      }
    } catch (error) {
      console.error('加载数据源详情失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkInstalled = async () => {
    try {
      const isInstalled = await isSourceInstalled(sourceId);
      setInstalled(isInstalled);
    } catch (error) {
      console.error('检查安装状态失败:', error);
    }
  };

  const handleInstall = async () => {
    if (!source) return;
    
    try {
      const success = await installSource(source.id, source.category);
      if (success) {
        setInstalled(true);
      }
    } catch (error) {
      console.error('安装数据源失败:', error);
    }
  };

  const handleUninstall = async () => {
    try {
      const success = await uninstallSource(sourceId);
      if (success) {
        setInstalled(false);
      }
    } catch (error) {
      console.error('卸载数据源失败:', error);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  if (!source) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>数据源不存在</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>返回</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* 图标和名称 */}
        <View style={styles.header}>
          {source.icon ? (
            <Image source={{ uri: source.icon }} style={styles.icon} />
          ) : (
            <View style={[styles.icon, styles.iconPlaceholder]}>
              <Text style={styles.iconText}>
                {source.name?.charAt(0) || '?'}
              </Text>
            </View>
          )}
          <Text style={styles.name}>{source.name}</Text>
        </View>

        {/* 描述 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>描述</Text>
          <Text style={styles.description}>{source.description}</Text>
        </View>

        {/* 分类和标签 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>分类</Text>
          <View style={styles.categoryContainer}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>
                {source.category === 'video' ? '视频' :
                 source.category === 'comic' ? '漫画' :
                 source.category === 'ebook' ? '电子书' :
                 source.category === 'novel' ? '小说' :
                 source.category === 'news' ? '新闻' : source.category}
              </Text>
            </View>
          </View>
        </View>

        {source.tags && source.tags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>标签</Text>
            <View style={styles.tagsContainer}>
              {source.tags.map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 版本信息 */}
        {source.version && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>版本</Text>
            <Text style={styles.versionText}>{source.version}</Text>
          </View>
        )}

        {/* 作者信息 */}
        {source.author && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>作者</Text>
            <Text style={styles.authorText}>{source.author}</Text>
          </View>
        )}

        {/* 操作按钮 */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              installed ? styles.uninstallButton : styles.installButton,
            ]}
            onPress={installed ? handleUninstall : handleInstall}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.actionText,
                installed ? styles.uninstallText : styles.installText,
              ]}
            >
              {installed ? '卸载' : '安装'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 20,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  icon: {
    width: 120,
    height: 120,
    borderRadius: 24,
    marginBottom: 16,
    backgroundColor: '#f0f0f0',
  },
  iconPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
  },
  iconText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#666',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  categoryContainer: {
    flexDirection: 'row',
  },
  categoryBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 12,
    color: '#666',
  },
  versionText: {
    fontSize: 14,
    color: '#666',
  },
  authorText: {
    fontSize: 14,
    color: '#666',
  },
  actionContainer: {
    marginTop: 8,
    marginBottom: 24,
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  installButton: {
    backgroundColor: '#007AFF',
  },
  uninstallButton: {
    backgroundColor: '#f0f0f0',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  installText: {
    color: '#fff',
  },
  uninstallText: {
    color: '#666',
  },
});

export default SourceDetailScreen;

