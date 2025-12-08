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
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  getSettings, 
  saveSettings, 
  clearHistory,
  getCurrentSource,
  setCurrentSource,
  clearAllCache
} from '../../services/storage';
import { getAvailableSources } from '../../services/api';
import downloadManager from '../../services/downloadManager';
import videoDownloadManager from '../../services/videoDownloadManager';
import { useToast } from '../../components/MessageToast';

const ProfileScreen = () => {
  const router = useRouter();
  const toast = useToast();
  const [settings, setSettings] = useState({
    darkMode: false,
    autoLoadHD: false,
    keepScreenOn: true,
  });
  const [currentSource, setCurrentSourceState] = useState(null);
  const [sources, setSources] = useState({});
  const [showSourceMenu, setShowSourceMenu] = useState(false);

  useEffect(() => {
    loadSettings();
    loadSourceData();
  }, []);

  const loadSettings = async () => {
    const data = await getSettings();
    setSettings(data);
  };

  const loadSourceData = async () => {
    try {
      const [sourcesData, savedSource] = await Promise.all([
        getAvailableSources(),
        getCurrentSource(),
      ]);
      setSources(sourcesData);
      
      // 如果有保存的数据源且有效，使用它；否则使用第一个可用的数据源
      const firstAvailableSource = Object.keys(sourcesData)[0];
      const validSource = savedSource && sourcesData[savedSource] ? savedSource : firstAvailableSource;
      
      setCurrentSourceState(validSource);
      
      // 如果没有保存的数据源，保存当前选择的为默认
      if (!savedSource && validSource) {
        await setCurrentSource(validSource);
      }
    } catch (error) {
      // 静默失败
    }
  };

  const handleSettingChange = async (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await saveSettings(newSettings);
    
    // 如果是下载并发数，更新downloadManager
    if (key === 'maxConcurrentDownloads') {
      downloadManager.updateMaxConcurrent(value);
    }
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
            toast.success('历史记录已清除');
          },
        },
      ]
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      '清除缓存',
      '确定要清除所有缓存数据吗？这将删除：\n\n• 安装的数据源\n• 下载的漫画\n• 下载的视频\n• 所有下载记录\n• 阅读历史\n• 收藏记录\n• 搜索历史\n\n此操作不可恢复！',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'destructive',
          onPress: async () => {
            try {
              // 清理下载文件
              await Promise.all([
                downloadManager.clearAllDownloads(),
                videoDownloadManager.clearAllDownloads(),
              ]);
              
              // 清理存储数据
              await clearAllCache();
              
              // 重新加载数据源（因为已清除）
              await loadSourceData();
              
              toast.success('缓存已清除，应用已恢复到初始状态');
            } catch (error) {
              console.error('清除缓存失败:', error);
              toast.error('清除缓存时发生错误，请重试');
            }
          },
        },
      ]
    );
  };

  const handleSourceChange = async (sourceId) => {
    setCurrentSourceState(sourceId);
    await setCurrentSource(sourceId);
    setShowSourceMenu(false);
    toast.success(`已切换到 ${sources[sourceId]?.name}`);
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
  
  const renderNumberSetting = (title, value, onValueChange, min = 1, max = 20) => (
    <View style={styles.settingItem}>
      <Text style={styles.settingTitle}>{title}</Text>
      <View style={styles.numberInputContainer}>
        <TouchableOpacity 
          style={styles.numberButton}
          onPress={() => {
            const newValue = Math.max(min, value - 1);
            onValueChange(newValue);
          }}
        >
          <Text style={styles.numberButtonText}>−</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.numberInput}
          value={String(value)}
          keyboardType="number-pad"
          onChangeText={(text) => {
            const num = parseInt(text) || min;
            onValueChange(Math.min(max, Math.max(min, num)));
          }}
          includeFontPadding={false}
        />
        <TouchableOpacity 
          style={styles.numberButton}
          onPress={() => {
            const newValue = Math.min(max, value + 1);
            onValueChange(newValue);
          }}
        >
          <Text style={styles.numberButtonText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderRadioSetting = (title, value, options, onValueChange) => (
    <View style={styles.radioSettingContainer}>
      <Text style={styles.settingTitle}>{title}</Text>
      <View style={styles.radioGroup}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.radioButton,
              value === option.value && styles.radioButtonActive,
            ]}
            onPress={() => onValueChange(option.value)}
          >
            <Text style={[
              styles.radioButtonText,
              value === option.value && styles.radioButtonTextActive,
            ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
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
          {renderMenuItem('数据源市场', () => {
            router.push('/market');
          })}
          {renderMenuItem('阅读历史', () => {
            router.push('/history');
          })}
          {renderMenuItem('下载管理', () => {
            toast.info('功能开发中...');
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>设置</Text>
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => setShowSourceMenu(!showSourceMenu)}
          >
            <Text style={styles.menuTitle}>数据源</Text>
            <View style={styles.menuRight}>
              <Text style={styles.menuValue}>
                {sources[currentSource]?.name || '加载中...'}
              </Text>
              <Text style={styles.arrow}>{showSourceMenu ? '▲' : '▼'}</Text>
            </View>
          </TouchableOpacity>
          {showSourceMenu && (
            <View style={styles.sourceMenuContainer}>
              {Object.entries(sources).map(([key, source]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.sourceMenuItem,
                    currentSource === key && styles.sourceMenuItemActive,
                  ]}
                  onPress={() => handleSourceChange(key)}
                >
                  <Text style={[
                    styles.sourceMenuText,
                    currentSource === key && styles.sourceMenuTextActive,
                  ]}>
                    {source.name}
                  </Text>
                  {source.description && (
                    <Text style={styles.sourceMenuDesc}>
                      {source.description}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
          {renderRadioSetting(
            '显示模式',
            settings.viewMode || 'card',
            [
              { label: '卡片', value: 'card' },
              { label: '列表', value: 'list' },
            ],
            (value) => handleSettingChange('viewMode', value)
          )}
          {renderRadioSetting(
            '阅读模式',
            settings.scrollMode || 'horizontal',
            [
              { label: '左右滑动', value: 'horizontal' },
              { label: '上下滑动', value: 'vertical' },
            ],
            (value) => handleSettingChange('scrollMode', value)
          )}
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
          {renderNumberSetting(
            '下载并发数',
            settings.maxConcurrentDownloads || 10,
            (value) => handleSettingChange('maxConcurrentDownloads', value),
            1,
            20
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>其他</Text>
          {renderMenuItem('清除缓存', handleClearCache)}
          {renderMenuItem('清除历史记录', handleClearHistory)}
          {renderMenuItem('关于应用', () => {
            toast.info('漫画阅读器 v1.0.0');
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
  numberInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  numberButton: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: '#6200EE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberButtonText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '500',
  },
  numberInput: {
    width: 50,
    height: 32,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 4,
    textAlign: 'center',
    fontSize: 14,
    padding: 0,
    margin: 0,
    color: '#000',
    textAlignVertical: 'center',
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
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuValue: {
    fontSize: 14,
    color: '#999',
    marginRight: 8,
  },
  sourceMenuContainer: {
    backgroundColor: '#f9f9f9',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  sourceMenuItem: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sourceMenuItemActive: {
    backgroundColor: '#e8e0f5',
  },
  sourceMenuText: {
    fontSize: 15,
    color: '#333',
  },
  sourceMenuTextActive: {
    color: '#6200EE',
    fontWeight: '600',
  },
  sourceMenuDesc: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  radioSettingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  radioGroup: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
  },
  radioButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  radioButtonActive: {
    borderColor: '#6200EE',
    backgroundColor: '#6200EE',
  },
  radioButtonText: {
    fontSize: 14,
    color: '#666',
  },
  radioButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default ProfileScreen;
