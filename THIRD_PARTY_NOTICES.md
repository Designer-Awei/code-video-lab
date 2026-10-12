# 来源与许可

本仓库原创代码与文档采用根目录 MIT 许可证；这不改变第三方材料的许可。

- `skills/code-video/scripts/{render,analyze_video,audio_tools,check_env}.py` 和该 skill 的基础 references 来自 [Kianzzz/xilo-opus-video](https://github.com/Kianzzz/xilo-opus-video)，MIT，原许可保存在 [licenses/xilo-opus-video-MIT.txt](licenses/xilo-opus-video-MIT.txt)。本仓库扩展了制作决策、案例导航和验证流程。
- [Vincentwei1021/mg-styles-15](https://github.com/Vincentwei1021/mg-styles-15) 是动效、美术和评审方法的参考，未把其整个仓库作为依赖或重新打包。
- [Jamie Pine / Voicebox](https://github.com/jamiepine/voicebox) 是本片口播使用的本地语音合成服务。仓库提供调用该服务的适配器，不包含 Voicebox 程序、模型权重或私人音色；上游程序与各语音模型的许可分别适用。
- Three.js 及其扩展为 MIT 许可；保留于 `src/vendor/three.bundle.js` 的构建产物和 [licenses/three-MIT.txt](licenses/three-MIT.txt)。源码入口与 npm 锁文件均保留，便于重建。
- 新闻截图的来源登记于案例 `source/screenshots/sources.json`，版权属于原发布者；公开源码不包含新闻原图。安装原图时保留内容、日期和出处，不把示意动画当作事件实拍。
- 本地字体文件未随源码再分发；默认使用系统字体兜底。需要复现本机字体时自行提供合法可用的字体。
- 克隆音色、声纹样本、生成口播与完整成片均不随公开源码发布。作者明确要求公开的无声展示切片保存在 `docs/gallery/`。TTS 工具可连接用户自己的 Voicebox 音色。

创作参考推文和模型协作分工见 [项目复盘](docs/MAKING_OF.md)。
