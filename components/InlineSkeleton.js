import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const getThemeVisual = (theme) => {
  if (theme === 'dark') {
    return {
      baseColor: '#1f1f1f',
      highlightColors: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0)'],
    };
  }
  return {
    baseColor: '#e6e6e6',
    highlightColors: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0)'],
  };
};

const SkeletonBlock = ({ shimmerX, style, baseColor, highlightColors }) => {
  const translateX = useMemo(() => {
    if (!shimmerX) {
      return 0;
    }
    return shimmerX.interpolate({
      inputRange: [0, 1],
      outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
    });
  }, [shimmerX]);

  return (
    <View style={[styles.block, { backgroundColor: baseColor }, style]}>
      <Animated.View style={[styles.shimmerWrap, { transform: [{ translateX }] }]}>
        <LinearGradient
          colors={highlightColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.shimmer}
        />
      </Animated.View>
    </View>
  );
};

const InlineSkeleton = ({
  theme = 'light',
  variant = 'block',
  lines = 3,
  size = 44,
  blockStyle,
  style,
}) => {
  const shimmerX = useRef(new Animated.Value(0)).current;
  const visual = useMemo(() => getThemeVisual(theme), [theme]);

  useEffect(() => {
    shimmerX.setValue(0);
    const anim = Animated.loop(
      Animated.timing(shimmerX, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => {
      shimmerX.stopAnimation();
    };
  }, [shimmerX]);

  if (variant === 'text') {
    const safeLines = Number.isFinite(lines) && lines > 0 ? Math.min(lines, 8) : 3;
    const items = Array.from({ length: safeLines }).map((_, i) => i);

    return (
      <View style={[styles.textWrap, style]}>
        {items.map((i) => (
          <SkeletonBlock
            key={i}
            shimmerX={shimmerX}
            baseColor={visual.baseColor}
            highlightColors={visual.highlightColors}
            style={i === safeLines - 1 ? styles.textLineShort : styles.textLine}
          />
        ))}
      </View>
    );
  }

  const resolvedSize = Number.isFinite(size) && size > 0 ? size : 44;
  const resolvedRadius = resolvedSize / 2;

  return (
    <View style={[styles.wrap, style]}>
      <SkeletonBlock
        shimmerX={shimmerX}
        baseColor={visual.baseColor}
        highlightColors={visual.highlightColors}
        style={[
          styles.defaultBlock,
          {
            width: resolvedSize,
            height: resolvedSize,
            borderRadius: resolvedRadius,
          },
          blockStyle,
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    width: '100%',
    gap: 10,
  },
  block: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  shimmerWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 180,
  },
  shimmer: {
    flex: 1,
  },
  defaultBlock: {
  },
  textLine: {
    height: 12,
    borderRadius: 10,
    width: '100%',
  },
  textLineShort: {
    height: 12,
    borderRadius: 10,
    width: '68%',
  },
});

export default React.memo(InlineSkeleton);
