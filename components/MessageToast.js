import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Toast Context
const ToastContext = createContext(null);

// Toast 类型配置
const TOAST_CONFIG = {
  success: {
    icon: '✓',
    backgroundColor: '#4caf50',
    borderColor: '#388e3c',
  },
  error: {
    icon: '✕',
    backgroundColor: '#f44336',
    borderColor: '#d32f2f',
  },
  warning: {
    icon: '⚠',
    backgroundColor: '#ff9800',
    borderColor: '#f57c00',
  },
  info: {
    icon: 'ℹ',
    backgroundColor: '#2196f3',
    borderColor: '#1976d2',
  },
};

// 单个Toast组件
const ToastItem = ({ message, type = 'info', duration = 3000, onDismiss, index }) => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [translateY] = useState(new Animated.Value(-20));
  
  const config = TOAST_CONFIG[type] || TOAST_CONFIG.info;

  useEffect(() => {
    // 进入动画
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // 自动消失
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -20,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss && onDismiss();
    });
  };

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
          opacity: fadeAnim,
          transform: [{ translateY }],
          top: 50 + index * 60,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.toastContent}
        onPress={handleDismiss}
        activeOpacity={0.8}
      >
        <Text style={styles.icon}>{config.icon}</Text>
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
        <TouchableOpacity onPress={handleDismiss} style={styles.closeButton}>
          <Text style={styles.closeText}>×</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Toast 容器组件
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, duration }]);
    return id;
  }, []);

  const hideToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const success = useCallback((message, duration) => {
    return showToast(message, 'success', duration);
  }, [showToast]);

  const error = useCallback((message, duration) => {
    return showToast(message, 'error', duration);
  }, [showToast]);

  const warning = useCallback((message, duration) => {
    return showToast(message, 'warning', duration);
  }, [showToast]);

  const info = useCallback((message, duration) => {
    return showToast(message, 'info', duration);
  }, [showToast]);

  const value = {
    showToast,
    hideToast,
    success,
    error,
    warning,
    info,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View style={styles.toastWrapper} pointerEvents="box-none">
        {toasts.map((toast, index) => (
          <ToastItem
            key={toast.id}
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            index={index}
            onDismiss={() => hideToast(toast.id)}
          />
        ))}
      </View>
    </ToastContext.Provider>
  );
};

// Hook 用于在组件中使用 Toast
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// 全局Toast实例（用于在非组件环境中使用）
let globalToastRef = null;

export const setGlobalToastRef = (ref) => {
  globalToastRef = ref;
};

export const Toast = {
  success: (message, duration) => globalToastRef?.success(message, duration),
  error: (message, duration) => globalToastRef?.error(message, duration),
  warning: (message, duration) => globalToastRef?.warning(message, duration),
  info: (message, duration) => globalToastRef?.info(message, duration),
  show: (message, type, duration) => globalToastRef?.showToast(message, type, duration),
};

const styles = StyleSheet.create({
  toastWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
    alignItems: 'center',
  },
  toastContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    maxWidth: SCREEN_WIDTH - 40,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  icon: {
    fontSize: 18,
    color: '#fff',
    marginRight: 10,
    fontWeight: 'bold',
  },
  message: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
  },
  closeButton: {
    marginLeft: 10,
    padding: 4,
  },
  closeText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '300',
  },
});

export default ToastProvider;
