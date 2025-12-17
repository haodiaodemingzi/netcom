import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

const FullScreenLoader = ({ message = '加载中' }) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#6200EE" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  text: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
});

export default FullScreenLoader;
