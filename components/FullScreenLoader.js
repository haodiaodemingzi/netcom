import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TopProgressBar = ({ color = '#6200EE', trackColor = 'rgba(98,0,238,0.15)' }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    if (!barWidth) {
      return;
    }

    translateX.setValue(-barWidth);
    const anim = Animated.loop(
      Animated.timing(translateX, {
        toValue: barWidth,
        duration: 1100,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => {
      translateX.stopAnimation();
    };
  }, [barWidth, translateX]);

  return (
    <View
      style={[styles.topBarTrack, { backgroundColor: trackColor }]}
      onLayout={(e) => {
        const w = e?.nativeEvent?.layout?.width;
        if (Number.isFinite(w) && w > 0) {
          setBarWidth(w);
        }
      }}
    >
      <Animated.View style={[styles.topBarThumb, { backgroundColor: color, transform: [{ translateX }] }]} />
    </View>
  );
};

const SkeletonBlock = ({ shimmerX, style, baseColor = '#e6e6e6', highlightColors }) => {
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
    <View style={[styles.skeletonBlock, { backgroundColor: baseColor }, style]}>
      <Animated.View style={[styles.shimmerWrap, { transform: [{ translateX }] }]}>
        <LinearGradient
          colors={highlightColors || ['rgba(255,255,255,0)', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.shimmerGradient}
        />
      </Animated.View>
    </View>
  );
};

const ListSkeleton = ({ shimmerX, baseColor, highlightColors }) => {
  const items = useMemo(() => Array.from({ length: 8 }).map((_, i) => i), []);
  return (
    <View style={styles.skeletonContent}>
      {items.map((i) => (
        <View key={i} style={styles.listRow}>
          <SkeletonBlock shimmerX={shimmerX} style={styles.listCover} baseColor={baseColor} highlightColors={highlightColors} />
          <View style={styles.listInfo}>
            <SkeletonBlock shimmerX={shimmerX} style={styles.lineLg} baseColor={baseColor} highlightColors={highlightColors} />
            <SkeletonBlock shimmerX={shimmerX} style={styles.lineMd} baseColor={baseColor} highlightColors={highlightColors} />
            <SkeletonBlock shimmerX={shimmerX} style={styles.lineSm} baseColor={baseColor} highlightColors={highlightColors} />
          </View>
        </View>
      ))}
    </View>
  );
};

const DetailSkeleton = ({ shimmerX, baseColor, highlightColors }) => (
  <View style={styles.skeletonContent}>
    <View style={styles.detailTop}>
      <SkeletonBlock shimmerX={shimmerX} style={styles.detailCover} baseColor={baseColor} highlightColors={highlightColors} />
      <View style={styles.detailInfo}>
        <SkeletonBlock shimmerX={shimmerX} style={styles.lineXl} baseColor={baseColor} highlightColors={highlightColors} />
        <SkeletonBlock shimmerX={shimmerX} style={styles.lineMd} baseColor={baseColor} highlightColors={highlightColors} />
        <SkeletonBlock shimmerX={shimmerX} style={styles.lineSm} baseColor={baseColor} highlightColors={highlightColors} />
        <SkeletonBlock shimmerX={shimmerX} style={styles.lineSm} baseColor={baseColor} highlightColors={highlightColors} />
      </View>
    </View>

    <View style={styles.sectionGap} />
    <SkeletonBlock shimmerX={shimmerX} style={styles.lineXl} baseColor={baseColor} highlightColors={highlightColors} />
    <SkeletonBlock shimmerX={shimmerX} style={styles.paragraphLine} baseColor={baseColor} highlightColors={highlightColors} />
    <SkeletonBlock shimmerX={shimmerX} style={styles.paragraphLine} baseColor={baseColor} highlightColors={highlightColors} />
    <SkeletonBlock shimmerX={shimmerX} style={styles.paragraphLineShort} baseColor={baseColor} highlightColors={highlightColors} />

    <View style={styles.sectionGap} />
    <SkeletonBlock shimmerX={shimmerX} style={styles.lineXl} baseColor={baseColor} highlightColors={highlightColors} />
    <ListSkeleton shimmerX={shimmerX} baseColor={baseColor} highlightColors={highlightColors} />
  </View>
);

const ReaderSkeleton = ({ shimmerX, baseColor, highlightColors }) => {
  const lines = useMemo(() => Array.from({ length: 14 }).map((_, i) => i), []);
  return (
    <View style={styles.skeletonContent}>
      <SkeletonBlock shimmerX={shimmerX} style={styles.readerTitle} baseColor={baseColor} highlightColors={highlightColors} />
      {lines.map((i) => (
        <SkeletonBlock
          key={i}
          shimmerX={shimmerX}
          baseColor={baseColor}
          highlightColors={highlightColors}
          style={i % 6 === 5 ? styles.readerLineShort : styles.readerLine}
        />
      ))}
    </View>
  );
};

const FullScreenLoader = ({
  message = '加载中',
  variant = 'list',
  showMessage = false,
  theme = 'light',
  accentColor = '#6200EE',
}) => {
  const shimmerX = useRef(new Animated.Value(0)).current;

  const visual = useMemo(() => {
    if (theme === 'dark') {
      return {
        backgroundColor: '#0b0b0b',
        baseColor: '#1f1f1f',
        textColor: 'rgba(255,255,255,0.65)',
        highlightColors: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0)'],
        trackColor: 'rgba(255,255,255,0.12)',
      };
    }
    return {
      backgroundColor: '#f5f5f5',
      baseColor: '#e6e6e6',
      textColor: '#666',
      highlightColors: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0)'],
      trackColor: 'rgba(98,0,238,0.15)',
    };
  }, [theme]);

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

  return (
    <View style={[styles.container, { backgroundColor: visual.backgroundColor }]}>
      <TopProgressBar color={accentColor} trackColor={visual.trackColor} />
      <View style={styles.body}>
        {variant === 'detail' ? (
          <DetailSkeleton shimmerX={shimmerX} baseColor={visual.baseColor} highlightColors={visual.highlightColors} />
        ) : variant === 'reader' ? (
          <ReaderSkeleton shimmerX={shimmerX} baseColor={visual.baseColor} highlightColors={visual.highlightColors} />
        ) : (
          <ListSkeleton shimmerX={shimmerX} baseColor={visual.baseColor} highlightColors={visual.highlightColors} />
        )}
        {showMessage ? <Text style={[styles.text, { color: visual.textColor }]}>{message}</Text> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBarTrack: {
    height: 3,
    overflow: 'hidden',
  },
  topBarThumb: {
    width: 120,
    height: '100%',
    borderRadius: 2,
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  text: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  skeletonContent: {
    flex: 1,
  },
  skeletonBlock: {
    backgroundColor: '#e6e6e6',
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
  shimmerGradient: {
    flex: 1,
  },
  listRow: {
    flexDirection: 'row',
    paddingVertical: 10,
  },
  listCover: {
    width: 64,
    height: 84,
    borderRadius: 10,
  },
  listInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  lineXl: {
    height: 18,
    borderRadius: 10,
    marginBottom: 12,
    width: '72%',
  },
  lineLg: {
    height: 16,
    borderRadius: 10,
    width: '80%',
  },
  lineMd: {
    height: 12,
    borderRadius: 10,
    width: '60%',
  },
  lineSm: {
    height: 10,
    borderRadius: 10,
    width: '40%',
  },
  detailTop: {
    flexDirection: 'row',
    marginBottom: 18,
  },
  detailCover: {
    width: 110,
    height: 150,
    borderRadius: 14,
  },
  detailInfo: {
    flex: 1,
    marginLeft: 14,
  },
  sectionGap: {
    height: 14,
  },
  paragraphLine: {
    height: 12,
    borderRadius: 10,
    marginBottom: 10,
    width: '96%',
  },
  paragraphLineShort: {
    height: 12,
    borderRadius: 10,
    marginBottom: 10,
    width: '72%',
  },
  readerTitle: {
    height: 18,
    borderRadius: 10,
    width: '68%',
    marginBottom: 18,
  },
  readerLine: {
    height: 12,
    borderRadius: 10,
    marginBottom: 10,
    width: '100%',
  },
  readerLineShort: {
    height: 12,
    borderRadius: 10,
    marginBottom: 10,
    width: '70%',
  },
});

export default FullScreenLoader;
