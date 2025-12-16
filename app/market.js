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
import { getMarketSources, getMarketCategories, activateMarket } from '../services/marketApi';
import {
  installSource,
  uninstallSource,
  isSourceInstalled,
  getInstalledSources,
  getActivationToken,
  saveActivationToken,
} from '../services/storage';
import eventBus, { EVENTS } from '../services/eventBus';

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
  const [activationToken, setActivationToken] = useState('');
  const [activating, setActivating] = useState(false);
  const [codeInput, setCodeInput] = useState('');

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
    const token = await loadToken();
    await Promise.all([loadCategories(token), loadInstalledSources()]);
    await loadSources(token);
  };

  const loadToken = async () => {
    const token = await getActivationToken();
    setActivationToken(token);
    return token;
  };

  const loadCategories = async (tokenParam) => {
    try {
      const tokenToUse = tokenParam !== undefined ? tokenParam : activationToken;
      const result = await getMarketCategories(tokenToUse);
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

  const loadSources = async (tokenParam) => {
    setLoading(true);
    try {
      const tokenToUse = tokenParam !== undefined ? tokenParam : activationToken;
      const result = await getMarketSources(selectedCategory, searchQuery, tokenToUse);
      if (result.success) {
        setSources(result.data);
      }
    } catch (error) {
      console.error('加载数据源失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async () => {
    if (!codeInput.trim()) {
      alert('请输入激活码');
      return;
    }
    setActivating(true);
    try {
      const result = await activateMarket(codeInput.trim());
      if (result.success) {
        await saveActivationToken(result.token);
        setActivationToken(result.token);
        setCodeInput('');
        await loadCategories(result.token);
        await loadSources(result.token);
        alert('激活成功');
      } else {
        alert(result.message || '无效的激活码');
      }
    } catch (error) {
      alert('激活失败');
    } finally {
      setActivating(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    const token = await loadToken();
    await Promise.all([loadSources(token), loadInstalledSources(), loadCategories(token)]);
    setRefreshing(false);
  };

  const handleInstall = async (sourceId, category) => {
    try {
      const success = await installSource(sourceId, category);
      if (success) {
        await loadInstalledSources();
        // 发布数据源安装事件
        eventBus.emit(EVENTS.SOURCE_INSTALLED, { sourceId, category });
      }
    } catch (error) {
      console.error('安装数据源失败:', error);
    }
  };

  const handleUninstall = async (sourceId) => {
    try {
      const success = await uninstallSource(sourceId);
      if (success) {
        await loadInstalledSources();
        // 发布数据源卸载事件
        eventBus.emit(EVENTS.SOURCE_UNINSTALLED, { sourceId });
      }
    } catch (error) {
      console.error('卸载数据源失败:', error);
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

      {/* 激活状态/输入 */}
      {activationToken ? (
        <View style={styles.activatedContainer}>
          <Text style={styles.activatedText}>已激活，全部资源可用</Text>
        </View>
      ) : (
        <View style={styles.activateContainer}>
          <TextInput
            style={styles.activateInput}
            placeholder="输入激活码解锁全部资源"
            placeholderTextColor="#999"
            value={codeInput}
            onChangeText={setCodeInput}
          />
          <TouchableOpacity
            style={styles.activateButton}
            onPress={handleActivate}
            activeOpacity={0.7}
            disabled={activating}
          >
            <Text style={styles.activateButtonText}>{activating ? '激活中' : '激活'}</Text>
          </TouchableOpacity>
        </View>
      )}

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
  activateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  activateInput: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    marginRight: 8,
  },
  activateButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  activateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default MarketScreen;

