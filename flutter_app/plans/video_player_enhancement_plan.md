# 视频播放器优化计划

## 概述
本计划针对视频详情页面顶部的内嵌播放器进行优化，解决以下问题：
1. 视频封面未集成到播放器中
2. 点击播放器无加载动画
3. 播放器底部缺少竖屏/横屏、播放速度、全屏、画面比例等控制
4. 全屏切换缺少动画过渡

## 当前问题分析
### 1. 封面显示问题
- 当前实现：在 `video_detail_page.dart` 中，内嵌播放器区域在视频未加载时显示封面，但视频加载后封面被替换为视频画面。
- 用户期望：封面应作为播放器背景，视频加载后封面淡出，提供更平滑的视觉过渡。

### 2. 加载动画缺失
- 当前实现：点击播放后，`_playInline` 方法直接初始化 `VideoPlayerController`，期间界面无任何加载指示。
- 用户期望：在视频初始化、缓冲期间显示加载动画（如旋转圆形进度条）。

### 3. 控制按钮不全
- 当前实现：内嵌播放器仅提供播放/暂停、进度条、全屏按钮，缺少竖屏/横屏切换、播放速度选择、画面比例调整等功能。
- 用户期望：内嵌播放器应具备与全屏播放器 (`CustomVideoControls`) 一致的控制按钮，提升操作便利性。

### 4. 全屏动画缺失
- 当前实现：点击全屏按钮直接导航到 `VideoPlayerPage`，使用默认页面过渡动画，无定制化视觉衔接。
- 用户期望：全屏切换使用 Hero 动画，实现播放器区域平滑放大至全屏的视觉效果。

## 优化目标
1. **封面集成**：播放器初始化前显示封面背景，初始化完成后封面淡出。
2. **加载动画**：视频初始化、缓冲期间显示旋转进度条，提升用户感知。
3. **完整控制**：内嵌播放器集成 `CustomVideoControls`，提供竖屏/横屏、播放速度、画面比例、全屏等控制按钮。
4. **动画过渡**：全屏切换使用 Hero 动画，实现视觉连续性。

## 具体优化项

### 1. 增强 CustomVideoControls
- 添加 `coverUrl` 可选参数，用于传递封面图片 URL。
- 当 `controller.value.isInitialized` 为 `false` 时，显示封面背景。
- 封面使用 `FadeTransition` 在视频初始化完成后淡出（透明度从 1 到 0）。
- 在 `controller.value.isBuffering` 为 `true` 或 `controller.value.isInitialized` 为 `false` 时，显示居中旋转进度条。
- 保持现有控制按钮（竖屏/横屏、播放速度、画面比例、全屏）不变。

### 2. 重构视频详情页面内嵌播放器
- 将 `video_detail_page.dart` 中的内嵌播放器区域（第 247–426 行）替换为 `CustomVideoControls`。
- 传递 `coverUrl` 为视频详情中的 `detail.cover`。
- 将 `_inlineController` 传递给 `CustomVideoControls`，复用现有控制器生命周期。
- 移除冗余的自定义控制层，统一使用 `CustomVideoControls` 的控制逻辑。

### 3. 实现 Hero 动画过渡
- 为内嵌播放器添加 Hero 标签，例如 `hero-video-${videoId}-${episodeId}`。
- 修改全屏按钮的 `onPressed` 逻辑，导航时使用 `Hero` 动画跳转到 `VideoPlayerPage`。
- 在 `VideoPlayerPage` 中，将 `CustomVideoControls` 用相同 Hero 标签包裹。
- 确保动画过程中视频画面连续（可能需传递同一控制器，或允许页面切换后重新加载）。

### 4. 加载动画集成
- 在 `CustomVideoControls` 的 `build` 方法中，根据控制器状态显示 `CircularProgressIndicator`。
- 缓冲期间在控制栏上方显示“缓冲中…”提示。

## 实施步骤
1. **修改 `CustomVideoControls`** (`lib/features/videos/widgets/custom_video_controls.dart`)
   - 添加 `coverUrl` 参数。
   - 在 `Stack` 中添加封面层和淡出动画。
   - 添加加载指示器层。
2. **更新 `video_detail_page.dart`** (`lib/features/videos/video_detail_page.dart`)
   - 将内嵌播放器区域替换为 `CustomVideoControls`。
   - 传递 `coverUrl`、`controller` 等参数。
   - 调整全屏按钮的导航逻辑，支持 Hero 动画。
3. **更新 `video_player_page.dart`** (`lib/features/videos/video_player_page.dart`)
   - 在 `CustomVideoControls` 外层包裹 `Hero` 标签。
   - 确保 Hero 标签与详情页一致。
4. **测试与验证**
   - 在 Android/iOS 模拟器及真机上测试封面显示、淡出效果。
   - 测试加载动画的显示与隐藏。
   - 验证所有控制按钮功能正常。
   - 测试 Hero 动画过渡的流畅性。

## 成功标准
- [ ] 视频加载前封面显示为播放器背景，加载后封面淡出。
- [ ] 点击播放后，播放器区域显示旋转加载动画，直到视频可播放。
- [ ] 内嵌播放器底部显示竖屏/横屏、播放速度、画面比例、全屏等控制按钮。
- [ ] 点击全屏按钮，播放器区域平滑放大至全屏页面（Hero 动画）。
- [ ] 所有控制功能正常工作，无回归错误。

## 风险与应对
- **Hero 动画与控制器状态不同步**：可能导致画面闪烁或重复加载。应对：若动画期间视频中断可接受，则允许全屏页面重新加载视频；若需无缝衔接，可考虑共享控制器（复杂度较高）。
- **封面图片加载性能**：若封面图过大可能影响页面渲染。应对：使用 `cached_network_image` 或现有 `proxyImageUrl` 进行缓存和优化。
- **多控制器生命周期管理**：内嵌播放器与全屏播放器可能同时存在，需确保控制器正确释放。应对：保持现有生命周期逻辑，全屏页面使用新控制器。

## 后续步骤
1. 用户审核本计划，提供修改意见。
2. 切换到 **Code 模式** 开始实施。
3. 分阶段测试并交付优化。

---
*计划创建日期：2025-12-24*