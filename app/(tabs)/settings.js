import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getProxyConfig, saveProxyConfig } from '../../services/scrapers/proxyConfig';
import CacheManager from '../../services/cache/CacheManager';

const SettingsScreen = () => {
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [proxyHost, setProxyHost] = useState('');
  const [proxyPort, setProxyPort] = useState('');
  const [proxyType, setProxyType] = useState('http');
  const [cacheStats, setCacheStats] = useState(null);
  const [loadingCache, setLoadingCache] = useState(false);

  useEffect(() => {
    loadProxyConfig();
    loadCacheStats();
  }, []);

  const loadProxyConfig = async () => {
    try {
      const config = await getProxyConfig();
      setProxyEnabled(config.enabled);
      setProxyHost(config.host);
      setProxyPort(config.port);
      setProxyType(config.type);
    } catch (error) {
      console.error('加载代理配置失败:', error);
    }
  };

  const loadCacheStats = async () => {
    try {
      const stats = await CacheManager.getStats();
      setCacheStats(stats);
    } catch (error) {
      console.error('加载缓存统计失败:', error);
    }
  };

  const handleClearCache = async () => {
    Alert.alert(
      '清除缓存',
      '确定要清除所有缓存吗？这将删除所有已缓存的漫画数据。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清除',
          style: 'destructive',
          onPress: async () => {
            setLoadingCache(true);
            try {
              await CacheManager.clearAll();
              await loadCacheStats();
              Alert.alert('成功', '缓存已清除');
            } catch (error) {
              console.error('清除缓存失败:', error);
              Alert.alert('错误', '清除缓存失败');
            } finally {
              setLoadingCache(false);
            }
          },
        },
      ]
    );
  };

  const handleClearExpiredCache = async () => {
    setLoadingCache(true);
    try {
      await CacheManager.clearExpired();
      await loadCacheStats();
      Alert.alert('成功', '过期缓存已清除');
    } catch (error) {
      console.error('清除过期缓存失败:', error);
      Alert.alert('错误', '清除过期缓存失败');
    } finally {
      setLoadingCache(false);
    }
  };

  const handleSave = async () => {
    try {
      const config = {
        enabled: proxyEnabled,
        host: proxyHost,
        port: proxyPort,
        type: proxyType,
      };

      await saveProxyConfig(config);
      Alert.alert('成功', '代理配置已保存');
    } catch (error) {
      console.error('保存代理配置失败:', error);
      Alert.alert('错误', '保存代理配置失败');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>设置</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>代理设置</Text>
          <Text style={styles.sectionDesc}>
            如果无法访问漫画网站，可以配置代理
          </Text>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>启用代理</Text>
            <Switch
              value={proxyEnabled}
              onValueChange={setProxyEnabled}
              trackColor={{ false: '#ccc', true: '#6200EE' }}
              thumbColor={proxyEnabled ? '#fff' : '#f4f3f4'}
            />
          </View>

          {proxyEnabled && (
            <>
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>代理类型</Text>
                <View style={styles.radioGroup}>
                  {['http', 'https', 'socks5'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.radioButton,
                        proxyType === type && styles.radioButtonActive,
                      ]}
                      onPress={() => setProxyType(type)}
                    >
                      <Text
                        style={[
                          styles.radioButtonText,
                          proxyType === type && styles.radioButtonTextActive,
                        ]}
                      >
                        {type.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>代理地址</Text>
                <TextInput
                  style={styles.input}
                  value={proxyHost}
                  onChangeText={setProxyHost}
                  placeholder="例如: 127.0.0.1"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>代理端口</Text>
                <TextInput
                  style={styles.input}
                  value={proxyPort}
                  onChangeText={setProxyPort}
                  placeholder="例如: 7890"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.hint}>
                <Text style={styles.hintText}>
                  💡 提示: 请确保代理服务正在运行
                </Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>缓存管理</Text>
          <Text style={styles.sectionDesc}>
            缓存可以提升加载速度，减少网络请求
          </Text>

          {cacheStats && (
            <>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>缓存项数</Text>
                <Text style={styles.infoValue}>{cacheStats.active} 项</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>过期缓存</Text>
                <Text style={styles.infoValue}>{cacheStats.expired} 项</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>缓存大小</Text>
                <Text style={styles.infoValue}>{cacheStats.sizeMB} MB</Text>
              </View>
            </>
          )}

          <View style={styles.cacheButtons}>
            <TouchableOpacity
              style={[styles.cacheButton, loadingCache && styles.cacheButtonDisabled]}
              onPress={handleClearExpiredCache}
              disabled={loadingCache}
            >
              {loadingCache ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.cacheButtonText}>清除过期缓存</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cacheButton, styles.cacheButtonDanger, loadingCache && styles.cacheButtonDisabled]}
              onPress={handleClearCache}
              disabled={loadingCache}
            >
              {loadingCache ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.cacheButtonText}>清除全部缓存</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>关于</Text>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>应用名称</Text>
            <Text style={styles.infoValue}>漫画阅读器</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>版本</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>保存设置</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  sectionDesc: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLabel: {
    fontSize: 16,
    color: '#000',
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  radioButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#f5f5f5',
  },
  radioButtonActive: {
    backgroundColor: '#6200EE',
  },
  radioButtonText: {
    fontSize: 13,
    color: '#666',
  },
  radioButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  inputGroup: {
    marginTop: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000',
  },
  hint: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
  },
  hintText: {
    fontSize: 13,
    color: '#856404',
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 16,
    color: '#000',
  },
  infoValue: {
    fontSize: 16,
    color: '#666',
  },
  saveButton: {
    margin: 16,
    backgroundColor: '#6200EE',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  cacheButtons: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
  },
  cacheButton: {
    flex: 1,
    backgroundColor: '#6200EE',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cacheButtonDanger: {
    backgroundColor: '#f44336',
  },
  cacheButtonDisabled: {
    opacity: 0.5,
  },
  cacheButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
});

export default SettingsScreen;
