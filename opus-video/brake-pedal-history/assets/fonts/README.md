# 本地可选字体

源码使用系统字体兜底。原制作机使用以下别名与文件；这些字体二进制不随公开仓库分发：

- `HSBold` → `HarmonyOS_Sans_SC_Bold.ttf`
- `HSRegular` → `HarmonyOS_Sans_SC_Regular.ttf`
- `CMono` → `CascadiaMono.ttf`
- `OutroSong` → `OutroSong.ttf`

需要相同排版时，提供自己合法可用的字体，或修改 index.html 的 @font-face 指向。Microsoft YaHei / Noto Sans CJK SC 是正文兜底；结尾使用系统宋体或 Noto Serif CJK SC。缺少可选文件不应阻止 window.ready。
