import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:video_player/video_player.dart';

enum VideoFitMode { contain, cover, fill }

class CustomVideoControls extends StatefulWidget {
  const CustomVideoControls({
    super.key,
    required this.controller,
    this.onNext,
    this.onPrevious,
  });

  final VideoPlayerController controller;
  final VoidCallback? onNext;
  final VoidCallback? onPrevious;

  @override
  State<CustomVideoControls> createState() => _CustomVideoControlsState();
}

class _CustomVideoControlsState extends State<CustomVideoControls> {
  bool _showControls = true;
  bool _isPortrait = true;
  bool _isFullscreen = false;
  double _currentSpeed = 1.0;
  VideoFitMode _fitMode = VideoFitMode.contain;
  
  static const List<double> _speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_updateState);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_updateState);
    super.dispose();
  }

  void _updateState() {
    if (mounted) {
      setState(() {});
    }
  }

  void _togglePlayPause() {
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

    return GestureDetector(
      onTap: () {
        setState(() {
          _showControls = !_showControls;
        });
      },
      child: Container(
        color: Colors.transparent,
        child: Stack(
          children: [
            Center(
              child: AspectRatio(
                aspectRatio: widget.controller.value.aspectRatio,
                child: FittedBox(
                  fit: _fitMode == VideoFitMode.fill
                      ? BoxFit.fill
                      : _fitMode == VideoFitMode.cover
                          ? BoxFit.cover
                          : BoxFit.contain,
                  child: SizedBox(
                    width: widget.controller.value.size.width == 0
                        ? MediaQuery.of(context).size.width
                        : widget.controller.value.size.width,
                    height: widget.controller.value.size.height == 0
                        ? MediaQuery.of(context).size.width / widget.controller.value.aspectRatio
                        : widget.controller.value.size.height,
                    child: VideoPlayer(widget.controller),
                  ),
                ),
              ),
            ),
            if (_showControls)
              Container(
                color: Colors.black.withOpacity(0.3),
                child: Column(
                  children: [
                    AppBar(
                      backgroundColor: Colors.transparent,
                      elevation: 0,
                      iconTheme: const IconThemeData(color: Colors.white),
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
                                child: SliderTheme(
                                  data: SliderThemeData(
                                    trackHeight: 12,
                                    thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 10),
                                  ),
                                  child: Slider(
                                    value: progress.clamp(0.0, 1.0),
                                    onChanged: (value) {
                                      final newPosition = duration * value;
                                      widget.controller.seekTo(newPosition);
                                    },
                                    activeColor: Colors.white,
                                    inactiveColor: Colors.white.withOpacity(0.3),
                                  ),
                                ),
                              ),
                              Text(
                                _formatDuration(duration),
                                style: const TextStyle(color: Colors.white, fontSize: 12),
                              ),
                            ],
                          ),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const SizedBox(width: 36),
                              Center(
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  spacing: 6,
                                  children: [
                                    if (widget.onPrevious != null)
                                      IconButton(
                                        icon: const Icon(Icons.skip_previous, color: Colors.white, size: 28),
                                        onPressed: widget.onPrevious,
                                      ),
                                    IconButton(
                                      icon: Icon(
                                        isPlaying ? Icons.pause_circle_filled : Icons.play_circle_filled,
                                        color: Colors.white,
                                        size: 40,
                                      ),
                                      onPressed: _togglePlayPause,
                                    ),
                                    if (widget.onNext != null)
                                      IconButton(
                                        icon: const Icon(Icons.skip_next, color: Colors.white, size: 28),
                                        onPressed: widget.onNext,
                                      ),
                                  ],
                                ),
                              ),
                              SingleChildScrollView(
                                scrollDirection: Axis.horizontal,
                                child: Row(
                                  spacing: 4,
                                  children: [
                                    _buildIconButton(
                                      icon: _fitMode == VideoFitMode.contain
                                          ? Icons.fit_screen
                                          : _fitMode == VideoFitMode.cover
                                              ? Icons.photo_size_select_large
                                              : Icons.crop_16_9,
                                      onPressed: _showFitModeDialog,
                                    ),
                                    _buildIconButton(
                                      icon: _isPortrait ? Icons.screen_rotation : Icons.screen_lock_rotation,
                                      onPressed: _toggleOrientation,
                                    ),
                                    _buildIconButton(
                                      icon: _isFullscreen ? Icons.fullscreen_exit : Icons.fullscreen,
                                      onPressed: _toggleFullscreen,
                                    ),
                                    _buildIconButton(
                                      icon: Icons.speed,
                                      onPressed: _showSpeedDialog,
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
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
  }
}
