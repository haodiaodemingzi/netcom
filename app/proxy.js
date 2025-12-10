import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import proxyApi from '../services/proxyApi';

export default function ProxyScreen() {
  const [subscriptionUrl, setSubscriptionUrl] = useState('');
  const [nodes, setNodes] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [proxyEnabled, setProxyEnabled] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // 加载订阅URL
      if (proxyApi.subscriptionUrl) {
        setSubscriptionUrl(proxyApi.subscriptionUrl);
      }
      
      // 加载节点列表
      const nodeList = proxyApi.getNodes();
      setNodes(nodeList);
      
      // 加载选中的节点
      const selected = proxyApi.getSelectedNode();
      if (selected) {
        const index = nodeList.findIndex(
          n => n.server === selected.server && n.port === selected.port
        );
        if (index >= 0) {
          setSelectedIndex(index);
        }
      }
      
      // 加载代理启用状态
      setProxyEnabled(proxyApi.isProxyEnabled());
    } catch (error) {
      console.error('加载数据失败:', error);
    }
  };

  const updateSubscription = async () => {
    if (!subscriptionUrl.trim()) {
      Alert.alert('错误', '请输入订阅地址');
      return;
    }

    setLoading(true);
    try {
      const result = await proxyApi.updateSubscription(subscriptionUrl);

      if (result.success) {
        setNodes(result.nodes);
        Alert.alert('成功', result.message);
      } else {
        Alert.alert('失败', result.message);
      }
    } catch (error) {
      Alert.alert('错误', '更新订阅失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const selectNode = async (index) => {
    try {
      const result = await proxyApi.selectNode(index);

      if (result.success) {
        setSelectedIndex(index);
        Alert.alert('成功', '节点选择成功');
      } else {
        Alert.alert('失败', result.message);
      }
    } catch (error) {
      Alert.alert('错误', '选择节点失败: ' + error.message);
    }
  };

  const toggleProxy = async (value) => {
    if (value && selectedIndex === null && nodes.length === 0) {
      Alert.alert('提示', '请先更新订阅并选择一个节点');
      return;
    }
    
    if (value && selectedIndex === null) {
      Alert.alert('提示', '请先选择一个节点');
      return;
    }
    
    await proxyApi.setProxyEnabled(value);
    setProxyEnabled(value);
    
    if (value) {
      Alert.alert('成功', `代理已启用: ${nodes[selectedIndex].name}`);
    } else {
      Alert.alert('提示', '代理已关闭，将使用直连模式');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const renderNode = ({ item, index }) => {
    const isSelected = index === selectedIndex;
    
    return (
      <TouchableOpacity
        style={[styles.nodeItem, isSelected && styles.nodeItemSelected]}
        onPress={() => selectNode(index)}
      >
        <View style={styles.nodeHeader}>
          <Text style={styles.nodeName}>{item.name}</Text>
          {isSelected && (
            <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
          )}
        </View>
        
        <View style={styles.nodeInfo}>
          <Text style={styles.nodeDetail}>
            协议: {item.protocol.toUpperCase()}
          </Text>
          <Text style={styles.nodeDetail}>
            服务器: {item.server}:{item.port}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>代理设置</Text>
        <Text style={styles.subtitle}>配置SSR/Trojan节点</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.switchRow}>
          <View style={styles.switchLeft}>
            <Text style={styles.sectionTitle}>启用代理</Text>
            <Text style={styles.switchHint}>
              关闭后将直接连接，不经过代理服务器
            </Text>
          </View>
          <Switch
            value={proxyEnabled}
            onValueChange={toggleProxy}
            trackColor={{ false: '#ccc', true: '#4CAF50' }}
            thumbColor={proxyEnabled ? '#fff' : '#f4f3f4'}
          />
        </View>
        
        {proxyEnabled ? (
          <View style={styles.statusBox}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.statusText}>
              {selectedIndex !== null
                ? `当前节点: ${nodes[selectedIndex]?.name}`
                : '请选择节点'}
            </Text>
          </View>
        ) : (
          <View style={styles.warningBox}>
            <Ionicons name="information-circle-outline" size={16} color="#ff9800" />
            <Text style={styles.warningText}>
              代理已关闭，当前使用直连模式
            </Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>订阅地址</Text>
        <TextInput
          style={styles.input}
          placeholder="输入订阅URL"
          value={subscriptionUrl}
          onChangeText={setSubscriptionUrl}
          autoCapitalize="none"
          autoCorrect={false}
        />
        
        <TouchableOpacity
          style={styles.updateButton}
          onPress={updateSubscription}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.buttonText}>更新订阅</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          节点列表 ({nodes.length})
        </Text>
        
        <FlatList
          data={nodes}
          renderItem={renderNode}
          keyExtractor={(item, index) => index.toString()}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="cloud-offline-outline" size={48} color="#999" />
              <Text style={styles.emptyText}>暂无节点</Text>
              <Text style={styles.emptyHint}>请先更新订阅</Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      </View>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={20} color="#2196F3" />
        <Text style={styles.infoText}>
          代理功能完全可选。关闭代理时，应用将直接连接服务器。启用代理后，需在系统设置中配置相应的VPN或代理客户端。
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginTop: 4,
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 12,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLeft: {
    flex: 1,
    marginRight: 16,
  },
  switchHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 10,
    backgroundColor: '#f0f8f0',
    borderRadius: 6,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 10,
    backgroundColor: '#fff3e0',
    borderRadius: 6,
  },
  warningText: {
    fontSize: 13,
    color: '#f57c00',
  },
  statusText: {
    fontSize: 14,
    color: '#333',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
  },
  updateButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  nodeItem: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  nodeItemSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#f0f8f0',
  },
  nodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  nodeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  nodeInfo: {
    gap: 4,
  },
  nodeDetail: {
    fontSize: 13,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  emptyHint: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 4,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 12,
    margin: 16,
    borderRadius: 8,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1976D2',
  },
});
