# Cockpit V3.3 集成与验收

日期：2026-10-22。分支：`feature/car-cockpit-desktop-v3`。
基线：`fea4cd36fc12a84fe8a3619b0552e8ac9eccf23d`。

本轮在完整保留的未提交 V3.3 工作上修复中文音频。独立于音乐的已实现功能通过 QA；用户 LE-V3.3-RESUME-AUDIO-REPAIR 已允许这些功能提交/推送。WP5 继续 **ASSET_BLOCKED**，不宣称 V3.3 音乐已交付。

| 工作包 | 状态 | 交付 |
| --- | --- | --- |
| WP1 道路运动 | PASS | D/S 前进、R 反向；标线与树木/房屋/路灯均透视运动；速度联动、滑行/刹车减速、停止与分层视差 |
| WP2 发动机与中文混音 | PASS | 启动、怠速、D/S 加速、松油门/刹车回落、熄火实际 PCM；独立预生成中文通道与背景压低、统一限峰和静音；真实后台/离页验证 |
| WP3 雾天 | PASS | FOG 与雨雪互斥，远景低对比/模糊、近路可辨；雾灯照近路，不消除室外雾、不改变雨刮 |
| WP4 空调 | PASS | 五种互斥出风分配；人体/前窗/箭头；三档风速动画差异，关闭停止；仅模拟清理内侧水汽 |
| WP5 音乐 | ASSET_BLOCKED | 正式音乐 0 首；完整播放器架构、测试输入传输及混音通过，不代表正式音乐或许可验收通过 |
| 喇叭补充项 | PASS | 中央图标/大点击目标、首次引导、可听度提升、固定双声部不无限叠加、背景压低与统一静音 |

## 本轮音频修复

完整根因、架构、96 条清单、真实网络、PCM 峰值与功能证据见 [COCKPIT_V33_AUDIO_REPAIR.md](COCKPIT_V33_AUDIO_REPAIR.md)。机器汇总见 [delivery-summary.json](qa/cockpit-desktop-v3/v33/delivery-summary.json)。

之前的原生 WebSpeech 绕过 WebAudio 限峰，45% 朗读音量仍达到满刻度 1.0，故此前未提交。历史 [失败报告](qa/cockpit-desktop-v3/v33/native-speech-report.json)、[原始 WAV](qa/cockpit-desktop-v3/v33/native-chinese-engine-mix.wav) 保留。当前移除驾驶舱 WebSpeech 调用，不再依赖原生中文后端或自动 TTS 兜底。没有恢复 85%、关闭保护或修改音频设备音量。

独立预生成语音与发动机、喇叭、播放器进入同一个 WebAudio 图，经压缩器、平滑有界限峰和 master。一个讲解播放器、一个音乐播放器；默认讲解 45%、发动机 28%、音乐 30%。讲解实际 playing/ended 驱动背景压低/恢复；全局静音、0 讲解音量、快速替换、后台暂停和离页释放均有实际 PCM 或真实生命周期证据。

96 个新增 MP3 是云夏中文提示，覆盖 94 条可达完整运行时文案，另 2 条温度边界备用文案。它们是独立驾驶舱通道，不修改原 315 key、638 MP3 或旧映射；不是音乐资源。

## 产品文件

- `pages/cockpit.html`：原布局中的景物、FOG/HVAC、播放器、中央喇叭/引导、全局静音及独立中文提示入口。
- `js/cockpit-v33.js`：有方向距离积分/透视投影/分层视差、气流/内侧水汽。恢复音频任务前后逐字节不变。
- `pages/cockpit-v33.css`：现有区域内的雾、空调、播放器、中央喇叭样式。恢复任务前后逐字节不变。
- `js/cockpit-audio.js`：单惰性音频图，发动机/喇叭/中文/播放器总线、音量/压低/限峰/静音/生命周期。
- `assets/cockpit-voice/manifest.json` 与 96 MP3：独立文本映射、文件大小/时长/SHA256。
- `assets/music/manifest.json`：`ASSET_BLOCKED` 空清单，不含歌曲。

其他变更仅为本报告、[音乐许可记录](MUSIC_LICENSES.md)、测试工具和证据。[完整文件清单](qa/cockpit-desktop-v3/v33/changed-files.txt)；[完整产品 diff](qa/cockpit-desktop-v3/v33/product.diff)。CA 和生成环境没有进入仓库。

## 回归与范围

Chromium 151.0.7922.173、Playwright 1.58.2。真实产品输入，没有直接赋值 state 或用产品内部动作伪造通过。

- 新 [功能回归](qa/cockpit-desktop-v3/v33/audio-repair/core-report.json)：WP1/WP3/WP4、四 tab、P/R/N/D/S、刹车/倒车灯、非法操作守卫、灯光/转向/双闪、昼夜及车内控制。
- 新 [音频回归](qa/cockpit-desktop-v3/v33/audio-repair/audio-repair-report.json)、[原生生命周期](qa/cockpit-desktop-v3/v33/audio-repair/native-lifecycle-report.json)、[浏览器设备实际输出](qa/cockpit-desktop-v3/v33/audio-repair/device-output-report.json)。没有伪造 speech 开始/结束，没有只看播放按钮判定成功。
- 1366×768、1920×1080 四 tab 无整页和面板滚动；390×844 允许纵向滚动、无横向溢出，返回按钮可达。
- 原双雨刮机械函数、驾驶/停车安全函数逐字节保持，原 V3.3 的机械/雨雪采样 [regression-report.json](qa/cockpit-desktop-v3/v33/regression-report.json) 继续保留，本次不重复历史 V3.1 审计。
- 原版汽车、首页、公共 JS 和其他 19 场景未修改。相对基线除 cockpit.html 外 936 个原文件 Git blob 一致；641 个原 voice 路径 SHA256 一致。
- 原 638 个 MP3/315 key 的保护结论来自逐字节检查，不冒充本次重新播放全部旧音频或重新加载全部场景。

## 音乐阻塞和人工验收

正式音乐 **0 首**。[音乐许可记录](MUSIC_LICENSES.md) 保留来源访问代理 403 和未知许可事实，没有绕过。测试清单临时注入两条原语音，只用于实际播放器传输、seeked/ended 和四总线混音测试；正式清单不含它们。相应录音含 `fixture`/`NOT-MUSIC`，不能充当儿童器乐或许可证明。

真人/儿童中文听音、发音、真实扬声器舒适度、HarmonyOS、其他浏览器、真实 GPU/设备体验仍未验收。新增 MP3 解码、浏览器实际输出和真人听音分别记录。不合并 main、不修改 Simple+、不部署 Netlify/GitHub Pages；本次保存后等待人工验收。
