> 历史初稿：不是当前制作参数；本机可执行文件路径已移除。

# brief：一块踏板，一百四十年

<role>
你是一位纪录片剪辑师、动态设计师兼创意程序员。用代码把一部汽车科普短片从第一帧做到最后一帧，画面像纪录片预告片一样有电影感，同时每个事实都经得起推敲。
</role>

<inputs>
1. 主题：刹车踏板 1886–2026 的演变，以 2026-10-08 懂车帝测试尊界 V800 刹车踏板支架断裂事件切入。希望观众记住：一辆车上最不起眼的零件，扛着最沉重的责任。
2. 时长与画幅：约 9 分钟（不超过 10 分钟），1920×1080，30fps（先出 960×540 的低清小样）。
3. 风格：画风随时代演变（见 storyboard.md 的风格表），参考 @prasenx 的电子游戏史短片：史诗、动情、多重画风、剪辑卡在音乐节拍上。
4. 配色与字体：每章一套色板（见 storyboard.md）；中文 HarmonyOS Sans SC（Bold / Regular），数字 Cascadia Mono，字体文件放在 assets/fonts/ 本地加载。
5. 声音：配乐和音效全部用 Python 代码合成，不用采样、音频文件和虚拟乐器；口播用 voicebox 本地服务（http://127.0.0.1:17493）的【Awei 原声】克隆音色。
</inputs>

<direction>
- 除下面这条例外，每一帧都用代码生成，不下载任何图片或素材。
- 例外：尊界事件相关的事实（懂车帝测试画面、尊界官方微博原帖、媒体报道、标准条目）一律用 source/screenshots/ 里的真实截图，不加滤镜、不改字、不裁掉日期和来源，左下角标注"来源：xxx · 日期"；出处登记在 source/screenshots/sources.json。不用代码仿画尊界车辆或 Logo。
- 一块"主角踏板"贯穿全片，章节转场从踏板被踩下的动作里长出来，不用默认的淡入淡出。
- 每个镜头只讲一件事，主体占画面一半以上，镜头一直在动（推、拉、跟随、绕转）。
- 屏幕字少而大，至少停留 2.5 秒，同屏不超过 12 个汉字。
- 禁止：居中大字加渐变背景的默认风格、所有元素一起淡入、角落里的多余标签和边框、装饰性发光、满屏小字、任何看起来像模板的东西。
</direction>

<structure>
- 口播文案：script.md（8 段，对应 audio/vo/vo_01…vo_08）
- 分镜：storyboard.md（42 个镜头，每个镜头写了时间、口播锚点、画面、动作、声音）
- 时间轴以配音为准：先生成 8 段配音，测出每段时长和逐句时间戳，写入 timeline.json；章节之间留 2–4 秒纯音乐过渡，配乐按 84 BPM 的节拍网格把过渡段对齐到重拍。
</structure>

<build>
1. 画面：index.html + scenes/ 下每章一个 JS 模块；Canvas 2D、SVG、WebGL 着色器、Three.js 按 storyboard.md 的风格表组合。Three.js 打包到本地，不走 CDN。
2. 页面暴露 window.render(t)，画出第 t 秒；所有画面只由 t 和 timeline.json 算出，随机数带固定种子，不用计时器，帧和帧之间不保存状态。
3. 渲染：.cursor/skills/xilo-opus-video/scripts/render.py（Playwright 逐帧截图 + FFmpeg 合成），按章节分段渲染，最后拼接。
4. 配音：python tools/voicebox_tts.py audio/vo/segments.json，每段输出 audio/vo/<id>.wav，时长写入 audio/vo/manifest.json。
5. 配乐与音效：tools/ 下的 Python 脚本合成到 audio/music/、audio/sfx/，与配音混成 audio/mix/mix.wav，人声出现时配乐侧链压低约 10dB，整体 -14 LUFS。
6. 每做完一个镜头，渲 3 张静帧自查：文字溢出、元素重叠、主体大小、停留时长。
</build>

<gotchas>
- 字体加载完再截图，否则前几帧会用默认字体。
- WebGL / Three.js 场景先渲一帧确认着色器生效，再渲整段。
- 听不到声音，所以要画出音频波形和响度图检查爆音与人声清晰度。
- 9 分钟 × 30fps ≈ 16,200 帧，WebGL 场景单帧可能要 0.2–0.5 秒，整片渲染以小时计；先出低清小样确认节奏。
- 截图要用 2 倍分辨率原图做推近，不要放大低清图；带第三方水印的（信网）保留水印。
- FFmpeg 可执行文件需在 PATH 中。
- 事实只能来自 source/research.md；里面标了【待核】的内容不上屏。
</gotchas>

<start>
1. 用户确认 script.md 后，生成 8 段配音并测时长。
2. 按实际时长重排 storyboard.md，生成 timeline.json。
3. 每章先出一张关键帧给用户看风格，确认后逐章制作，出低清小样，最后渲染 1080p 成片到 out/final.mp4。
</start>
