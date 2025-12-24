import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:video_player/video_player.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../../../core/network/image_proxy.dart';

enum VideoFitMode { contain, cover, fill }

class CustomVideoControls extends StatefulWidget {
  const CustomVideoControls({
    super.key,
    required this.controller,
    this.onNext,
    this.onPrevious,
    this.coverUrl,
    this.heroTag,
    this.onFullscreenPressed,
  });

  final VideoPlayerController controller;
  final VoidCallback? onNext;
  final VoidCallback? onPrevious;
  final String? coverUrl;
  final String? heroTag;
  final VoidCallback? onFullscreenPressed;

  @override
  State<CustomVideoControls> createState() => _CustomVideoControlsState();
}

class _CustomVideoControlsState extends State<CustomVideoControls> with TickerProviderStateMixin {
  bool _showControls = true;
  bool _isPortrait = true;
  bool _isFullscreen = false;
  double _currentSpeed = 1.0;
  VideoFitMode _fitMode = VideoFitMode.contain;
  bool _wasPlaying = false;
  
  static const List<double> _speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
  
  late AnimationController _coverAnimationController;
  late Animation<double> _coverFadeAnimation;
  
  Timer? _hideControlsTimer;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_updateState);
    _wasPlaying = widget.controller.value.isPlaying;
    
    // 初始化封面动画控制器
    _coverAnimationController = AnimationController(
      duration: const Duration(milliseconds: 800),
      vsync: this,
    );
    
    _coverFadeAnimation = Tween<double>(
      begin: 1.0,
      end: 0.0,
    ).animate(CurvedAnimation(
      parent: _coverAnimationController,
      curve: Curves.easeInOut,
    ));
    
    // 监听视频初始化状态，初始化完成后淡出封面
    if (widget.controller.value.isInitialized) {
      _coverAnimationController.forward();
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_updateState);
    _coverAnimationController.dispose();
    _cancelHideControlsTimer();
    super.dispose();
  }

  void _updateState() {
    if (!mounted) {
      return;
    }
    final isPlaying = widget.controller.value.isPlaying;
    if (isPlaying && !_wasPlaying) {
      if (_showControls) {
        _startHideControlsTimer();
      }
    } else if (!isPlaying) {
      _cancelHideControlsTimer();
    }
    _wasPlaying = isPlaying;
    setState(() {});

    // 视频初始化完成后淡出封面
    if (widget.controller.value.isInitialized &&
        !_coverAnimationController.isCompleted) {
      _coverAnimationController.forward();
    }
  }

  void _startHideControlsTimer() {
    _cancelHideControlsTimer();
    _hideControlsTimer = Timer(const Duration(seconds: 3), () {
      if (mounted && widget.controller.value.isPlaying) {
        setState(() {
          _showControls = false;
        });
      }
    });
  }

  void _cancelHideControlsTimer() {
    _hideControlsTimer?.cancel();
    _hideControlsTimer = null;
  }

  void _togglePlayPause() {
    setState(() {
      _showControls = true;
    });
    if (widget.controller.value.isPlaying) {
      widget.controller.pause();
    } else {
      widget.controller.play();
    }
  }

  void _toggleOrientation() {
    setState(() {
      _isPortrait = !_isPortrait;
    });
    if (_isPortrait) {
      SystemChrome.setPreferredOrientations([
        DeviceOrientation.portraitUp,
        DeviceOrientation.portraitDown,
      ]);
    } else {
      SystemChrome.setPreferredOrientations([
        DeviceOrientation.landscapeLeft,
        DeviceOrientation.landscapeRight,
      ]);
    }
  }

  void _toggleFullscreen() {
    if (widget.onFullscreenPressed != null) {
      widget.onFullscreenPressed!.call();
      return;
    }
    setState(() {
      _isFullscreen = !_isFullscreen;
    });
    if (_isFullscreen) {
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    } else {
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    }
  }

  void _showFitModeDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('屏幕比例'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            RadioListTile<VideoFitMode>(
              title: const Text('原比例'),
              value: VideoFitMode.contain,
              groupValue: _fitMode,
              onChanged: (value) {
                if (value != null) {
                  setState(() {
                    _fitMode = value;
                  });
                  Navigator.pop(context);
                }
              },
            ),
            RadioListTile<VideoFitMode>(
              title: const Text('填充'),
              value: VideoFitMode.cover,
              groupValue: _fitMode,
              onChanged: (value) {
                if (value != null) {
                  setState(() {
                    _fitMode = value;
                  });
                  Navigator.pop(context);
                }
              },
            ),
            RadioListTile<VideoFitMode>(
              title: const Text('拉伸'),
              value: VideoFitMode.fill,
              groupValue: _fitMode,
              onChanged: (value) {
                if (value != null) {
                  setState(() {
                    _fitMode = value;
                  });
                  Navigator.pop(context);
                }
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showSpeedDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('播放速度'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: _speedOptions.map((speed) {
            return RadioListTile<double>(
              title: Text('${speed}x'),
              value: speed,
              groupValue: _currentSpeed,
              onChanged: (value) {
                if (value != null) {
                  setState(() {
                    _currentSpeed = value;
                  });
                  widget.controller.setPlaybackSpeed(value);
                  Navigator.pop(context);
                }
              },
            );
          }).toList(),
        ),
      ),
    );
  }

  String _formatDuration(Duration duration) {
    final minutes = duration.inMinutes;
    final seconds = duration.inSeconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  Widget _buildIconButton({
    required IconData icon,
    required VoidCallback onPressed,
  }) {
    return IconButton(
      onPressed: onPressed,
      icon: Icon(icon, color: Colors.white),
      style: IconButton.styleFrom(
        padding: const EdgeInsets.all(10),
        shape: const CircleBorder(side: BorderSide(color: Colors.white54)),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
      visualDensity: VisualDensity.compact,
    );
  }

  @override
  Widget build(BuildContext context) {
    final isPlaying = widget.controller.value.isPlaying;
    final position = widget.controller.value.position;
    final duration = widget.controller.value.duration;
    final progress = duration.inMilliseconds > 0 
        ? position.inMilliseconds / duration.inMilliseconds 
        : 0.0;
    final isInitialized = widget.controller.value.isInitialized;
    final isBuffering = widget.controller.value.isBuffering;

    Widget content = GestureDetector(
      onTap: () {
        setState(() {
          _showControls = true;
        });
        if (widget.controller.value.isPlaying) {
          _startHideControlsTimer();
        }
      },
      child: Container(
        color: Colors.transparent,
        child: Stack(
          children: [
            // 封面层
            if (widget.coverUrl != null && widget.coverUrl!.isNotEmpty)
              Positioned.fill(
                child: FadeTransition(
                  opacity: _coverFadeAnimation,
                  child: CachedNetworkImage(
                    imageUrl: proxyImageUrl(widget.coverUrl!),
                    fit: BoxFit.cover,
                    placeholder: (context, url) => Container(
                      color: Colors.grey.shade900,
                      child: const Center(
                        child: CircularProgressIndicator(color: Colors.white54),
                      ),
                    ),
                    errorWidget: (context, url, error) => Container(
                      color: Colors.grey.shade900,
                      child: const Icon(Icons.broken_image, color: Colors.white54, size: 48),
                    ),
                  ),
                ),
              ),
            
            // 视频播放器层
            if (isInitialized)
              Center(
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final videoWidth = widget.controller.value.size.width;
                    final videoHeight = widget.controller.value.size.height;
                    final videoAspect = widget.controller.value.aspectRatio;

                    BoxFit fit;
                    Alignment alignment;
                    switch (_fitMode) {
                      case VideoFitMode.contain:
                        fit = BoxFit.contain;
                        alignment = Alignment.center;
                        break;
                      case VideoFitMode.cover:
                        fit = BoxFit.cover;
                        alignment = Alignment.center;
                        break;
                      case VideoFitMode.fill:
                        fit = BoxFit.fill;
                        alignment = Alignment.center;
                        break;
                    }

                    return Container(
                      width: constraints.maxWidth,
                      height: constraints.maxHeight,
                      child: FittedBox(
                        fit: fit,
                        alignment: alignment,
                        child: SizedBox(
                          width: videoWidth > 0 ? videoWidth : constraints.maxWidth,
                          height: videoHeight > 0 ? videoHeight : constraints.maxWidth / videoAspect,
                          child: VideoPlayer(widget.controller),
                        ),
                      ),
                    );
                  },
                ),
              ),
            
            // 加载指示器层
            if (!isInitialized || isBuffering)
              Positioned.fill(
                child: Container(
                  color: Colors.black.withOpacity(0.3),
                  child: const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        CircularProgressIndicator(color: Colors.white),
                        SizedBox(height: 16),
                        Text(
                          '缓冲中...',
                          style: TextStyle(color: Colors.white, fontSize: 14),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            
            // 控制层
            if (_showControls && isInitialized)
              Container(
                color: Colors.black.withOpacity(0.3),
                child: Column(
                  children: [
                    AppBar(
                      backgroundColor: Colors.transparent,
                      elevation: 0,
                      iconTheme: const IconThemeData(color: Colors.white),
                      leading: _isFullscreen
                          ? IconButton(
                              icon: const Icon(Icons.arrow_back, color: Colors.white),
                              onPressed: () {
                                if (_isFullscreen) {
                                  setState(() {
                                    _isFullscreen = false;
                                  });
                                  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
                                }
                              },
                            )
                          : null,
                      title: _isFullscreen ? const Text('全屏播放', style: TextStyle(color: Colors.white)) : null,
                    ),
                    const Spacer(),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      child: Column(
                        children: [
                          Row(
                            children: [
                              Text(
                                _formatDuration(position),
                                style: const TextStyle(color: Colors.white, fontSize: 12),
                              ),
                              Expanded(
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 12),
                                  child: SliderTheme(
                                    data: SliderTheme.of(context).copyWith(
                                      activeTrackColor: Colors.red,
                                      inactiveTrackColor: Colors.white24,
                                      thumbColor: Colors.white,
                                      thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                                      trackHeight: 4,
                                    ),
                                    child: Slider(
                                      value: progress.clamp(0.0, 1.0),
                                      onChangeStart: (value) {
                                        _cancelHideControlsTimer();
                                      },
                                      onChangeEnd: (value) {
                                        if (widget.controller.value.isPlaying) {
                                          _startHideControlsTimer();
                                        }
                                      },
                                      onChanged: (value) {
                                        final newPosition = Duration(
                                          milliseconds: (value * duration.inMilliseconds).round(),
                                        );
                                        widget.controller.seekTo(newPosition);
                                      },
                                    ),
                                  ),
                                ),
                              ),
                              Text(
                                _formatDuration(duration),
                                style: const TextStyle(color: Colors.white, fontSize: 12),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              _buildIconButton(
                                icon: isPlaying ? Icons.pause : Icons.play_arrow,
                                onPressed: _togglePlayPause,
                              ),
                              const SizedBox(width: 16),
                              _buildIconButton(
                                icon: _fitMode == VideoFitMode.contain
                                    ? Icons.fit_screen
                                    : _fitMode == VideoFitMode.cover
                                        ? Icons.photo_size_select_large
                                        : Icons.crop_16_9,
                                onPressed: _showFitModeDialog,
                              ),
                              const SizedBox(width: 8),
                              _buildIconButton(
                                icon: _isPortrait ? Icons.screen_rotation : Icons.screen_lock_rotation,
                                onPressed: _toggleOrientation,
                              ),
                              const SizedBox(width: 8),
                              _buildIconButton(
                                icon: _isFullscreen ? Icons.fullscreen_exit : Icons.fullscreen,
                                onPressed: _toggleFullscreen,
                              ),
                              const SizedBox(width: 8),
                              _buildIconButton(
                                icon: Icons.speed,
                                onPressed: _showSpeedDialog,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );

    return content;
  }
}
