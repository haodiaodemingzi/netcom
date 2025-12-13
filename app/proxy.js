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
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import proxyApi from '../services/proxyApi';

const PROXY_TYPES = [
  { label: 'HTTP', value: 'http' },
  { label: 'HTTPS', value: 'https' },
  { label: 'SOCKS5', value: 'socks5' },
];

export default function ProxyScreen() {
  const [subscriptionUrl, setSubscriptionUrl] = useState('');
  const [nodes, setNodes] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [proxyMode, setProxyMode] = useState('off'); // 'off' | 'manual' | 'subscription'
  const [activeTab, setActiveTab] = useState('manual'); // 'manual' | 'subscription'
  
  // 手动代理配置
  const [manualProxy, setManualProxy] = useState({
    type: 'http',
    host: '',
    port: '',
    username: '',
    password: '',
  });
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

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
      
      // 加载代理模式
      const mode = proxyApi.getProxyMode();
      setProxyMode(mode);
      
      // 加载手动代理配置
      const manual = proxyApi.getManualProxy();
      if (manual) {
        setManualProxy(manual);
      }
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

  // 切换代理模式
  const handleModeChange = async (newMode) => {
    // 检查配置是否完整
    if (newMode === 'manual') {
      if (!manualProxy.host || !manualProxy.port) {
        Alert.alert('提示', '请先填写代理服务器地址和端口');
        return;
      }
    } else if (newMode === 'subscription') {
      if (nodes.length === 0) {
        Alert.alert('提示', '请先更新订阅并选择节点');
        return;
      }
      if (selectedIndex === null) {
        Alert.alert('提示', '请先选择一个节点');
        return;
      }
    }
    
    await proxyApi.setProxyMode(newMode);
    setProxyMode(newMode);
    
    if (newMode === 'off') {
      Alert.alert('提示', '代理已关闭，将使用直连模式');
    } else {
      const proxyUrl = proxyApi.getProxyUrl();
      Alert.alert('成功', `代理已启用\n${proxyUrl || ''}`);
    }
  };

  // 保存手动代理配置
  const saveManualProxy = async () => {
    if (!manualProxy.host.trim()) {
      Alert.alert('错误', '请输入代理服务器地址');
      return;
    }
    if (!manualProxy.port.trim()) {
      Alert.alert('错误', '请输入端口号');
      return;
    }
    
    setLoading(true);
    try {
      const result = await proxyApi.saveManualProxy(manualProxy);
      if (result.success) {
        Alert.alert('成功', result.message);
      } else {
        Alert.alert('失败', result.message);
      }
    } catch (error) {
      Alert.alert('错误', error.message);
    } finally {
      setLoading(false);
    }
  };

  // 测试代理连接
  const testProxyConnection = async () => {
    if (!manualProxy.host || !manualProxy.port) {
      Alert.alert('提示', '请先填写代理配置');
      return;
    }
    
    setTesting(true);
    setTestResult(null);
    
    try {
      const result = await proxyApi.testProxy(manualProxy);
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: error.message,
        latency: -1,
      });
    } finally {
      setTesting(false);
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

  // 渲染代理类型选择器
  const renderProxyTypeSelector = () => (
    <View style={styles.typeSelector}>
      {PROXY_TYPES.map((type) => (
        <TouchableOpacity
          key={type.value}
          style={[
            styles.typeButton,
            manualProxy.type === type.value && styles.typeButtonActive,
          ]}
          onPress={() => setManualProxy({ ...manualProxy, type: type.value })}
        >
          <Text
            style={[
              styles.typeButtonText,
              manualProxy.type === type.value && styles.typeButtonTextActive,
            ]}
          >
            {type.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // 渲染手动配置表单
  const renderManualConfig = () => (
    <View style={styles.configSection}>
      <Text style={styles.sectionTitle}>代理类型</Text>
      {renderProxyTypeSelector()}
      
      <Text style={styles.sectionTitle}>服务器地址</Text>
      <TextInput
        style={styles.input}
        placeholder="例如: 192.168.1.1 或 proxy.example.com"
        value={manualProxy.host}
        onChangeText={(text) => setManualProxy({ ...manualProxy, host: text })}
        autoCapitalize="none"
        autoCorrect={false}
      />
      
      <Text style={styles.sectionTitle}>端口</Text>
      <TextInput
        style={styles.input}
        placeholder="例如: 7890 或 1080"
        value={manualProxy.port}
        onChangeText={(text) => setManualProxy({ ...manualProxy, port: text })}
        keyboardType="numeric"
      />
      
      <Text style={styles.sectionTitle}>用户名（可选）</Text>
      <TextInput
        style={styles.input}
        placeholder="如果需要认证，请输入用户名"
        value={manualProxy.username}
        onChangeText={(text) => setManualProxy({ ...manualProxy, username: text })}
        autoCapitalize="none"
        autoCorrect={false}
      />
      
      <Text style={styles.sectionTitle}>密码（可选）</Text>
      <TextInput
        style={styles.input}
        placeholder="如果需要认证，请输入密码"
        value={manualProxy.password}
        onChangeText={(text) => setManualProxy({ ...manualProxy, password: text })}
        secureTextEntry
      />
      
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.actionButton, styles.testButton]}
          onPress={testProxyConnection}
          disabled={testing}
        >
          {testing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="flash" size={18} color="#fff" />
              <Text style={styles.buttonText}>测试连接</Text>
            </>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.saveButton]}
          onPress={saveManualProxy}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="save" size={18} color="#fff" />
              <Text style={styles.buttonText}>保存配置</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      
      {testResult && (
        <View style={[
          styles.testResultBox,
          testResult.success ? styles.testResultSuccess : styles.testResultFail
        ]}>
          <Ionicons 
            name={testResult.success ? "checkmark-circle" : "close-circle"} 
            size={18} 
            color={testResult.success ? "#4CAF50" : "#f44336"} 
          />
          <Text style={styles.testResultText}>
            {testResult.message}
            {testResult.latency > 0 && ` (延迟: ${testResult.latency}ms)`}
          </Text>
        </View>
      )}
    </View>
  );

  // 渲染订阅配置
  const renderSubscriptionConfig = () => (
    <View style={styles.configSection}>
      <Text style={styles.sectionTitle}>订阅地址</Text>
      <TextInput
        style={styles.input}
        placeholder="输入SSR/Trojan订阅URL"
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
      
      <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
        节点列表 ({nodes.length})
      </Text>
      
      <FlatList
        data={nodes}
        renderItem={renderNode}
        keyExtractor={(item, index) => index.toString()}
        scrollEnabled={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cloud-offline-outline" size={48} color="#999" />
            <Text style={styles.emptyText}>暂无节点</Text>
            <Text style={styles.emptyHint}>请先更新订阅</Text>
          </View>
        }
      />
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>代理设置</Text>
        <Text style={styles.subtitle}>配置HTTP/HTTPS/SOCKS5代理</Text>
      </View>

      {/* 代理模式选择 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>代理模式</Text>
        <View style={styles.modeSelector}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              proxyMode === 'off' && styles.modeButtonActive,
            ]}
            onPress={() => handleModeChange('off')}
          >
            <Ionicons 
              name="close-circle-outline" 
              size={20} 
              color={proxyMode === 'off' ? '#fff' : '#666'} 
            />
            <Text style={[
              styles.modeButtonText,
              proxyMode === 'off' && styles.modeButtonTextActive,
            ]}>关闭</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.modeButton,
              proxyMode === 'manual' && styles.modeButtonActive,
            ]}
            onPress={() => handleModeChange('manual')}
          >
            <Ionicons 
              name="create-outline" 
              size={20} 
              color={proxyMode === 'manual' ? '#fff' : '#666'} 
            />
            <Text style={[
              styles.modeButtonText,
              proxyMode === 'manual' && styles.modeButtonTextActive,
            ]}>手动</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.modeButton,
              proxyMode === 'subscription' && styles.modeButtonActive,
            ]}
            onPress={() => handleModeChange('subscription')}
          >
            <Ionicons 
              name="cloud-download-outline" 
              size={20} 
              color={proxyMode === 'subscription' ? '#fff' : '#666'} 
            />
            <Text style={[
              styles.modeButtonText,
              proxyMode === 'subscription' && styles.modeButtonTextActive,
            ]}>订阅</Text>
          </TouchableOpacity>
        </View>
        
        {proxyMode !== 'off' && (
          <View style={styles.statusBox}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.statusText}>
              当前代理: {proxyApi.getProxyUrl() || '未配置'}
            </Text>
          </View>
        )}
      </View>

      {/* 配置选项卡 */}
      <View style={styles.section}>
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'manual' && styles.tabActive]}
            onPress={() => setActiveTab('manual')}
          >
            <Text style={[
              styles.tabText,
              activeTab === 'manual' && styles.tabTextActive,
            ]}>手动配置</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'subscription' && styles.tabActive]}
            onPress={() => setActiveTab('subscription')}
          >
            <Text style={[
              styles.tabText,
              activeTab === 'subscription' && styles.tabTextActive,
            ]}>订阅管理</Text>
          </TouchableOpacity>
        </View>
        
        {activeTab === 'manual' ? renderManualConfig() : renderSubscriptionConfig()}
      </View>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={20} color="#2196F3" />
        <Text style={styles.infoText}>
          提示：React Native需要系统级代理支持。建议在手机上安装Clash/SSR客户端，或将此配置发送给后端服务器使用。
        </Text>
      </View>
      
      <View style={{ height: 40 }} />
    </ScrollView>
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  // 代理模式选择器
  modeSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  modeButtonActive: {
    backgroundColor: '#4CAF50',
  },
  modeButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  modeButtonTextActive: {
    color: '#fff',
  },
  // 选项卡
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
  },
  tabText: {
    fontSize: 15,
    color: '#999',
  },
  tabTextActive: {
    color: '#2196F3',
    fontWeight: '600',
  },
  // 代理类型选择器
  typeSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#2196F3',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  // 配置表单
  configSection: {
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
    backgroundColor: '#fafafa',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
  },
  testButton: {
    backgroundColor: '#ff9800',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  testResultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 10,
    borderRadius: 6,
  },
  testResultSuccess: {
    backgroundColor: '#e8f5e9',
  },
  testResultFail: {
    backgroundColor: '#ffebee',
  },
  testResultText: {
    fontSize: 13,
    color: '#333',
  },
  // 订阅相关
  updateButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
  // 状态和提示
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 10,
    backgroundColor: '#f0f8f0',
    borderRadius: 6,
  },
  statusText: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
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
    alignItems: 'flex-start',
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
    lineHeight: 18,
  },
});
