import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  getSettings, 
  saveSettings, 
  clearHistory 
} from '../../services/storage';

const ProfileScreen = () => {
  const router = useRouter();
  const [settings, setSettings] = useState({
    darkMode: false,
    autoLoadHD: false,
    keepScreenOn: true,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const data = await getSettings();
    setSettings(data);
  };

  const handleSettingChange = async (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  const handleClearHistory = () => {
    Alert.alert(
      '清除历史',
      '确定要清除所有阅读历史吗?',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'destructive',
          onPress: async () => {
            await clearHistory();
            Alert.alert('提示', '历史记录已清除');
          },
        },
      ]
    );
  };

  const renderSettingItem = (title, value, onValueChange) => (
    <View style={styles.settingItem}>
      <Text style={styles.settingTitle}>{title}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#ccc', true: '#6200EE' }}
        thumbColor="#fff"
      />
    </View>
  );

  const renderMenuItem = (title, onPress, showArrow = true) => (
    <TouchableOpacity 
      style={styles.menuItem} 
      onPress={onPress}
    >
      <Text style={styles.menuTitle}>{title}</Text>
      {showArrow && <Text style={styles.arrow}>›</Text>}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <ScrollView>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>👤</Text>
          </View>
          <Text style={styles.username}>漫画爱好者</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>我的</Text>
          {renderMenuItem('阅读历史', () => {
            router.push('/history');
          })}
          {renderMenuItem('下载管理', () => {
            Alert.alert('提示', '功能开发中...');
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>设置</Text>
          {renderSettingItem(
            '夜间模式',
            settings.darkMode,
            (value) => handleSettingChange('darkMode', value)
          )}
          {renderSettingItem(
            'WiFi下自动加载高清图',
            settings.autoLoadHD,
            (value) => handleSettingChange('autoLoadHD', value)
          )}
          {renderSettingItem(
            '阅读时保持屏幕常亮',
            settings.keepScreenOn,
            (value) => handleSettingChange('keepScreenOn', value)
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>其他</Text>
          {renderMenuItem('清除缓存', () => {
            Alert.alert('提示', '功能开发中...');
          })}
          {renderMenuItem('清除历史记录', handleClearHistory)}
          {renderMenuItem('关于应用', () => {
            Alert.alert('关于', '漫画阅读器 v1.0.0');
          })}
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
  header: {
    padding: 32,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6200EE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 40,
  },
  username: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },
  section: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 14,
    color: '#999',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingTitle: {
    fontSize: 16,
    color: '#000',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuTitle: {
    fontSize: 16,
    color: '#000',
  },
  arrow: {
    fontSize: 24,
    color: '#ccc',
  },
});

export default ProfileScreen;
