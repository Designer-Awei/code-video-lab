---
name: code-video
description: Build polished code-rendered videos and animated explainers from an idea, script or visual reference. Connect research, narration, shot design, procedural models, art direction, deterministic animation, audio and frame-by-frame MP4 rendering. Use for code video creation or substantial motion-design work, rather than ordinary video transcoding.
---

# 用代码完成一条视频，而不是只完成一段动画

目标是把内容、造型、美术、时间和验收连接起来。用户的具体选择优先；已有 brief、认可的镜头或在制工程，直接沿用，不重启一套选择题。

## 把输入变成制作依据

从用户提供的题材、原文和参考中确定受众、核心问题、画幅、时长、配音与视觉方向。只补问会改变设计的信息。参考要拆成构图、素材粒度、镜头、节奏与技术手法，不照搬图片或只复制颜色。

一个工程放在 `opus-video/<slug>/`：`source/` 保存事实和出处，`brief.md` 写当前决定，`script.md` 写口播，`storyboard.md` 写镜头目标，`timeline.json` 连接声音与画面，`previews/` 审片，`qa/` 记验证，`out/` 放交付。生成文件与源码分开。

需要选择风格时，给有明显差别的少量方案和代表帧；方向已定时直接制作。方案与 brief 模板见 [plan-format](references/plan-format.md)、[brief-template](references/brief-template.md)。技术选择见 [code-stack](references/code-stack.md)。

## 先做资产语义，再做视觉风格

每个镜头明确：观众需要理解什么，主体是什么，哪里动，声音如何对应，哪些状态算失败。一个名词对应一个能辨认的资产；不能把同一个模型换机位当成不同材料或不同机构。

机械类主题优先拆出功能零件与装配关系：轴、支架、弯曲臂、踏面、连接杆、孔洞、螺栓和加强筋。连接点与动作支点要真实地共同运动。不同材质通过厚度、轮廓、纹理和结构表达，不只是换填充颜色。详见 [建模与画面评审](references/modeling.md)。

先决定美术语言，再组合材料、灯光、轮廓、排线/网点、文字与相机。Three.js 或 shader 是工具，不是质量证明；不要给粗糙方块套一个滤镜就交付。

在本仓库中，精读案例 `src/scenes/ch1.js`、`ch2.js`、`src/three/models_pedal.js`、`models_history.js` 和 `stage.js`。它们展示从主题到机械、从机械到美术、再到镜头的连接；详细导航见仓库 `docs/ARCHITECTURE.md`。

## 确定性与声画时间

开始实现前读完整 [craft-rules](references/craft-rules.md)。页面暴露 `window.render(t)` 与 `window.ready`。几何、字体和纹理可以初始化缓存；每一帧的可见性、姿态、粒子与相机由 t 重新求值。不要累加上一帧的位置，不使用 CSS 动画或真实时间推动成片。随机使用固定种子。

尽早制作一个代表性镜头，验证所选风格和建模质量；随后按镜头扩展。闭式弹簧、错峰动作、遮罩文字、相机缓动和元素带动的转场应有不同用途，避免所有东西同一时间淡入。

先确定旁白/节拍，再安排镜头与关键动作。文字停留要能读完，不能为了几段历史强行把全部画面挤在两秒内。标明哪些锚点是人工确认，哪些只是字符比例估计。

用代码合成音乐和音效是可选路径；TTS 连接用户选择的音色。对已审核的视频换配音，不重新排整条时间轴；用原录音作参照、静音区分段、保持音高调整，核对额外封面或片头偏移。不要把声学对齐称为转录校对，也不要替用户公开克隆音色样本。

## 抽帧、审核和交付

先检查镜头初始、稳定状态和动作极值；转场另看中间连续帧。检查文字安全区、装配、遮挡、主体占比、素材语义和手机尺寸可读性。自己修最严重的三个问题，再交用户认可，不以“已渲染”代替设计完成。

```sh
python scripts/check_env.py
python scripts/render.py index.html previews/key.png --still 2 --size 1920x1080
python scripts/check_determinism.py index.html --times 1 2 3
python scripts/render.py index.html out/video.mp4 --duration 30 --fps 30 --audio audio/mix.wav
python scripts/analyze_video.py out/video.mp4 --out qa/video --cell-width 360
```

这些路径相对本 skill 文件夹；工程不在这里时使用正确的完整或相对路径。先用小样估算成本，再正式渲染。输出到临时文件，验证帧数、时长、解码和音轨后再替换。已通过的章节不重复渲染。输出静帧、成片与可复用 brief，并说明影响结果的真实限制。

事实陈述依赖真实资料：新闻截图保留原内容、日期和出处，单独登记来源。纯代码示意不是新闻实拍；用户要求生成封面或使用真人素材时，明确它与程序化主体的边界。
