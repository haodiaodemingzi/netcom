import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import SourceCard from '../components/SourceCard';
import { getMarketSources, getMarketCategories } from '../services/marketApi';
import {
  installSource,
  uninstallSource,
  isSourceInstalled,
  getInstalledSources,
} from '../services/storage';

const MarketScreen = () => {
  const router = useRouter();
  const [sources, setSources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [installedSources, setInstalledSources] = useState({});
  const [installedSourceIds, setInstalledSourceIds] = useState(new Set());

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadSources();
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    loadInstalledSources();
  }, []);

  const loadInitialData = async () => {
    await Promise.all([loadCategories(), loadInstalledSources()]);
    await loadSources();
  };

  const loadCategories = async () => {
    try {
      const result = await getMarketCategories();
      if (result.success) {
        setCategories(result.data);
      }
    } catch (error) {
      console.error('加载分类失败:', error);
    }
  };

  const loadInstalledSources = async () => {
    try {
      const installed = await getInstalledSources();
      setInstalledSources(installed);
      
      // 创建已安装ID集合，方便快速查找
      const ids = new Set();
      Object.values(installed).forEach(categorySources => {
        categorySources.forEach(id => ids.add(id));
      });
      setInstalledSourceIds(ids);
    } catch (error) {
      console.error('加载已安装数据源失败:', error);
    }
  };

  const loadSources = async () => {
    setLoading(true);
    try {
      const result = await getMarketSources(selectedCategory, searchQuery);
      if (result.success) {
        setSources(result.data);
      }
    } catch (error) {
      console.error('加载数据源失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadSources(), loadInstalledSources()]);
    setRefreshing(false);
  };

  const handleInstall = async (sourceId, category) => {
    try {
      const success = await installSource(sourceId, category);
      if (success) {
        await loadInstalledSources();
        // 显示提示
        // Alert.alert('成功', '数据源已安装');
      }
    } catch (error) {
      console.error('安装数据源失败:', error);
      // Alert.alert('错误', '安装失败');
    }
  };

  const handleUninstall = async (sourceId) => {
    try {
      const success = await uninstallSource(sourceId);
      if (success) {
        await loadInstalledSources();
        // 显示提示
        // Alert.alert('成功', '数据源已卸载');
      }
    } catch (error) {
      console.error('卸载数据源失败:', error);
      // Alert.alert('错误', '卸载失败');
    }
  };

  const handleSourcePress = (source) => {
    router.push(`/market/${source.id}`);
  };

  const renderCategoryItem = ({ item }) => {
    const isSelected = selectedCategory === item.id;
    return (
      <TouchableOpacity
        style={[styles.categoryItem, isSelected && styles.categoryItemSelected]}
        onPress={() => setSelectedCategory(item.id)}
        activeOpacity={0.7}
      >
        <Text style={[styles.categoryText, isSelected && styles.categoryTextSelected]}>
          {item.icon} {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderSourceItem = ({ item }) => {
    const installed = installedSourceIds.has(item.id);
    return (
      <SourceCard
        source={item}
        isInstalled={installed}
        onInstall={handleInstall}
        onUninstall={handleUninstall}
        onPress={handleSourcePress}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      {/* 标题栏 */}
      <View style={styles.header}>
        <Text style={styles.title}>数据源市场</Text>
      </View>

      {/* 搜索栏 */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="搜索数据源..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
      </View>

      {/* 分类标签栏 */}
      <View style={styles.categoriesContainer}>
        <FlatList
          data={categories}
          renderItem={renderCategoryItem}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
        />
      </View>

      {/* 数据源列表 */}
      {loading && sources.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={sources}
          renderItem={renderSourceItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchQuery ? '没有找到相关数据源' : '暂无数据源'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  categoriesContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  categoriesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  categoryItem: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  categoryItemSelected: {
    backgroundColor: '#007AFF',
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
  },
  categoryTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    paddingVertical: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
});

export default MarketScreen;

