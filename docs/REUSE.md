# 运行与复用

## 环境与最短验证

在仓库根目录执行：

```powershell
python -m pip install -r requirements.txt
python -m playwright install chromium
python skills/code-video/scripts/check_env.py
```

FFmpeg 需要作为系统工具可运行；不要假设 Python 包会安装它。重建 vendor bundle 时：

```powershell
cd opus-video/brake-pedal-history
npm ci
npm run bundle
```

仓库带现有 bundle，直接浏览或抽帧不必先重建。系统需有可显示中文的字体；本地可选字体说明在案例 `assets/fonts/README.md`。

## 看一帧与看一段

以下在案例目录执行，所有时间为正文绝对秒：

```powershell
python tools/stills.py study 27.4 65 113 148 251 360 397
python ../../skills/code-video/scripts/render.py index.html previews/ch2-study.mp4 --start 60 --duration 4 --size 1920x1080 --fps 30
python ../../skills/code-video/scripts/check_determinism.py index.html --times 65 148 397
```

`index.html` 本身不播放时间；控制台调用 `window.render(t)` 才画指定帧。可用 `npm run preview` 在 localhost 查看，再在控制台定位。正文时间轴约 412.857 秒；本地最终交付额外添加了两秒封面。

不要直接全片渲染：先看主体、动作极值和转场中间帧，再确认节奏与文本可读性。没有新闻原图的占位版只能验证布局，不能作为事实类成片交付。

## 配音和章节渲染

复制 `audio/vo/segments.example.json` 为 `audio/vo/segments.json`，将 profile 改成你自己的 Voicebox 音色名。Voicebox 服务地址由适配器设置，默认本机 17493 端口。

```powershell
python tools/voicebox_tts.py audio/vo/segments.json
python tools/build_timeline.py
python tools/mix.py
python tools/render_rest.py --output out/body.mp4
```

这套命令用于**新生成完整案例**，会按新音频时长生成时间轴。若只是替换已经审核的视频声音，使用下节方法，不能运行 build_timeline 改动已有切点。

配乐是可选能力：`tools/soundtrack.py` 用振荡器、包络和噪声合成；本例最终版本的 `mix.py` 仅使用口播。想叠加配乐，应先修改混音、做旁白 ducking，再测响度，不要把生成了 score.wav 等同于已经混入成片。

## 在已完成的视频里换声

本地必须同时有原配音 WAV、新配音 WAV 和原时间轴。新音频放入 `audio/vo/replacement/<原段落id>.wav`，使用同一篇文稿生成。保持原 timeline 不变：

```powershell
python tools/replace_voice.py
python tools/mux_voice.py out/input.mp4 audio/mix/mix_replacement.wav out/new-voice.mp4 --offset 2
```

offset 是成片在正文之前额外增加的时长。只有本案例最终交付为 2 秒；新项目应通过画面和原音轨验证自己的值。mux 工具将视频流原样复制，验证时长、帧数和编码包哈希后再保存。它不覆盖输入，不依赖私人音色名，也不会重建已删除的旧版 final。

对齐报告在 `qa/voice_alignment.json`。只在新旧录音都安静的位置分段变速；保留新录音中的气口样本，避免把短呼吸无限拉长。试听开场、数字、英文缩写和结尾，声学对齐不是文字核对。

## 重建 README 动态展示

本地有完整交付视频时，在案例目录执行 `python tools/build_showcase.py --video out/final_leibus.mp4 --offset 2`。它按 `docs/gallery/clips.json` 对应的正文时间范围生成四份优化 GIF，并制作 1280×720、30fps、约 25 秒的合集 MP4。所有切片均去掉音轨，完整影片仍不上传。

GIF 为网页展示进行了缩放、轻微降噪和调色板压缩；合集 MP4 保留较高质量。参数与时间段见 tools/build_showcase.py。更换影片时重新核对片头 offset。

## 换主题而不是只换标题

复制案例的组织方式，再重做事实表、口播、主视觉、模型结构和分镜。可移植 `src/lib.js` 与 `src/three/stage.js` 的工具，但模型的支点、比例、材质和时代外形要随新主题改变。

让模型先阅读 `skills/code-video/SKILL.md`，然后精读第一、第二章。要求它为每个镜头说明：观众此刻理解什么、主体是什么、怎样变化、声音在哪个时刻发生、什么状态算错误。不要只要求“高级一点”或“加入 Three.js”。
