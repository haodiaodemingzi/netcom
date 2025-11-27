import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Image,
  Dimensions,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { 
  GestureDetector, 
  Gesture 
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get(
  'window'
);

const ImageViewer = ({ 
  imageUrl, 
  fitMode = 'width',
  onLoadEnd,
  onError,
}) => {
  const [loading, setLoading] = useState(true);
  const [imageDimensions, setImageDimensions] = useState(null);
  
  useEffect(() => {
    console.log(`[ImageViewer] 开始加载图片: ${imageUrl}`);
    setLoading(true);
  }, [imageUrl]);
  
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      console.log(`[ImageViewer] 🤏 开始缩放`);
    })
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      console.log(`[ImageViewer] 🤏 缩放结束, scale: ${scale.value.toFixed(2)}`);
      if (scale.value < 1) {
        scale.value = withSpring(1);
      } else if (scale.value > 3) {
        scale.value = withSpring(3);
      }
      savedScale.value = scale.value;
    });

  const panGesture = Gesture.Pan()
    .enabled(savedScale.value > 1) // 只在放大时启用
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd(() => {
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    });

  // 使用Exclusive，让手势互斥，不阻止外层滑动
  const composed = Gesture.Exclusive(pinchGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  const handleImageLoad = (event) => {
    console.log(`[ImageViewer] ✅ 图片加载成功！`);
    console.log(`[ImageViewer] event对象:`, event.nativeEvent);
    const { width, height } = event.nativeEvent.source;
    console.log(`[ImageViewer] 图片尺寸: ${width}x${height}`);
    setImageDimensions({ width, height });
    setLoading(false);
    console.log(`[ImageViewer] Loading已设置为false`);
    onLoadEnd?.();
  };

  const getImageStyle = () => {
    if (!imageDimensions) {
      console.log(`[ImageViewer] 使用默认尺寸`);
      return {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
      };
    }

    const imageRatio = imageDimensions.width / imageDimensions.height;
    const screenRatio = SCREEN_WIDTH / SCREEN_HEIGHT;

    switch (fitMode) {
      case 'width':
        return {
          width: SCREEN_WIDTH,
          height: SCREEN_WIDTH / imageRatio,
        };
      case 'height':
        return {
          width: SCREEN_HEIGHT * imageRatio,
          height: SCREEN_HEIGHT,
        };
      case 'free':
        if (imageRatio > screenRatio) {
          return {
            width: SCREEN_WIDTH,
            height: SCREEN_WIDTH / imageRatio,
          };
        } else {
          return {
            width: SCREEN_HEIGHT * imageRatio,
            height: SCREEN_HEIGHT,
          };
        }
      default:
        return {
          width: SCREEN_WIDTH,
          height: SCREEN_WIDTH / imageRatio,
        };
    }
  };

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6200EE" />
        </View>
      )}
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.imageContainer, animatedStyle]}>
          <Image
            source={{ uri: imageUrl }}
            style={[styles.image, getImageStyle()]}
            resizeMode="contain"
            onLoad={handleImageLoad}
            onError={(error) => {
              console.error(`[ImageViewer] ❌ 图片加载失败！`);
              console.error(`[ImageViewer] 错误:`, error.nativeEvent);
              console.error(`[ImageViewer] URL: ${imageUrl}`);
              setLoading(false);
              onError?.(error);
            }}
            onLoadStart={() => {
              console.log(`[ImageViewer] ⏳ 开始加载图片...`);
              console.log(`[ImageViewer] URL: ${imageUrl}`);
            }}
            onLoadEnd={() => {
              console.log(`[ImageViewer] 🏁 加载结束`);
            }}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    backgroundColor: '#000',
  },
});

export default ImageViewer;
