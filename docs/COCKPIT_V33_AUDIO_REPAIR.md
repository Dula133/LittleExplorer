# V3.3 中文语音与混音修复

任务：LE-V3.3-RESUME-AUDIO-REPAIR。日期：2026-10-22。
分支：`feature/car-cockpit-desktop-v3`；起点：`fea4cd36fc12a84fe8a3619b0552e8ac9eccf23d`。

## 工作区保护

恢复时发现完整的 86 个 V3.3 暂存文件，没有未暂存改动。修改之前，在仓库外 `/tmp/le-v33-before-audio-repair-kzahs3we/` 保存全部文件的压缩备份、逐路径 SHA256、暂存区 binary patch 和未暂存 patch。没有 reset、clean、丢弃或从 V3.2 重建。

WP1 的 `js/cockpit-v33.js`、雾/HVAC 的 `pages/cockpit-v33.css` 以及喇叭包络函数保留。旧 QA 录音和失败报告保留，不能用新结果覆盖此前原生中文满刻度失败的事实。保护明细见 [workspace-preservation.json](qa/cockpit-desktop-v3/v33/audio-repair/workspace-preservation.json)。

## 根因和修复

此前浏览器原生 `speechSynthesis` 通过系统后端输出，不经过应用的 WebAudio 音量、压低背景和限峰器。即使网页朗读音量降至 45%，原生后端输出仍出现峰值 1.0。历史失败文件为 [native-speech-report.json](qa/cockpit-desktop-v3/v33/native-speech-report.json) 与对应 WAV；它们不是修复后结果。

当前驾驶舱不再调用 WebSpeech，也不会在文件缺失时退回原生 TTS。中文提示使用独立目录 `assets/cockpit-voice/`，不占用原 `voice/lines.json` 或 `lines.js`。清单按完整实际提示文本精确查找，使用文本 SHA256 前 16 位作为独立文件 ID，检查重名/冲突。

- 96 个 MP3，云夏 `zh-CN-YunxiaNeural`，语速 `-8%`；94 条可达完整提示、2 条温度边界备用提示。后两条是「温度 16 度。调高一点。」和「温度 30 度。降低一点。」；受当前温度按钮钳位规则限制，不属于可达 UI 分支。
- 通过现有 Edge TTS 7.3.1 正常生成，每条只请求一次，在仓库外 staging 全量验证后集成。保留 certifi 的全部原根证书，进程内追加系统已信任的 `CODEX_PROXY_CERT`；实际 WebSocket 使用同一个 SSLContext，`CERT_REQUIRED` 和主机名校验开启。96 次均通过 `proxy:8080`，TLS 1.3、HTTP 101；没有 403、关闭校验、修改代理或第三方包。
- CA 仅用于仓库外生成，没有复制进仓库。报告只保留来源/身份指纹，不包含证书、令牌或代理凭据。
- 一个 AudioContext，两个可复用 HTMLAudioElement（讲解、播放器各一个）；四个独立总线：中文、发动机、喇叭、播放器。
- 四总线经过既有 DynamicsCompressor，再经过平滑有界 WaveShaper，最后进入统一 master。平滑曲线为 `0.85*tanh(x/0.85)`、4× oversampling；不是把不受控输出放任到系统后再改测试音量。
- 讲解默认 45%，不是恢复原生朗读 85%。发动机默认 28%、播放器默认 30%。实际 playing 时压低背景，ended/取消/错误时恢复；连续提示替换同一个讲解实例。
- 全局静音取消并抑制讲解、关闭全部总线输出；讲解开关和讲解 0 音量可独立停止讲解。后台暂停，离页释放；页面返回不自动重播已取消讲解。
- 保留方向盘中央喇叭图标、大点击目标、首次 5 秒引导及固定双声部包络；不会无限叠加。没有修改系统/音频设备音量，也没有归一化失败录音来取得 PASS。

完整文本、大小、时长和 SHA256 见 [独立语音清单](../assets/cockpit-voice/manifest.json)，真实网络/TLS、FFmpeg 解码见 [generation-report.json](qa/cockpit-desktop-v3/v33/audio-repair/generation-report.json)。96 文件合计 3,113,424 字节。

## 实际音频 QA

Chromium 151.0.7922.173 / Playwright 1.58.2。所有产品操作来自真实点击或键盘，没有直接改写产品 state。音频通过真实 MP3 解码、HTMLMediaElement playing/ended 与输出 PCM 验证，不能仅由节点或按钮状态得出 PASS。

- [audio-repair-report.json](qa/cockpit-desktop-v3/v33/audio-repair/audio-repair-report.json)：1366×768、1920×1080，实际 post-master AudioWorklet 浮点 PCM 与 MediaRecorder/FFmpeg 双重检查；默认中文+发动机、最高用户音量中文+发动机+喇叭、取消/快速替换、静音、0 讲解音量、单图/固定声部、96 条浏览器解码。判定上限保持峰值 <0.8、无 ≥0.98 样本；未降低要求。
- [voice-coverage-report.json](qa/cockpit-desktop-v3/v33/audio-repair/voice-coverage-report.json)：全部 94 条可达中文提示通过原生点击实际启动其精确 MP3，覆盖安全守卫、P/R/N/D/S、天气、灯光、风量/出风分配及全部可达温度文案。2 条备用提示单列，没有虚报为已通过 UI 点击。
- [device-output-report.json](qa/cockpit-desktop-v3/v33/audio-repair/device-output-report.json)：从 Chromium 的实际 PulseAudio 输出设备监视器采集 WAV，中文自然 ended，发动机和喇叭同时存在；静音输出为 0。使用仓库外独立测试音频设备，保持原始增益，没有校准/降低设备音量来掩盖峰值。不是实体扬声器测试。
- [native-lifecycle-report.json](qa/cockpit-desktop-v3/v33/audio-repair/native-lifecycle-report.json)：原生 CDP + Xvfb/Openbox，真实切换窗口/标签触发可信 visibilitychange；背景中文和播放器 paused、上下文 suspended；观察页保留旧对象，只读确认离页后 closed、语音 paused 且 src 已释放；真实历史返回后无自动续播，点击能恢复。
- [fixture-mix-report.json](qa/cockpit-desktop-v3/v33/audio-repair/fixture-mix-report.json)：中文、发动机、喇叭与播放器四总线实际混音；播放器输入是两条原有语音，仅作测试，不是音乐。播放器增益约 0.30 → 0.079 → 0.30，混音峰值约 0.6513、无满刻度。
- [horn-report.json](qa/cockpit-desktop-v3/v33/audio-repair/horn-report.json)：发动机完整声学回归、双桌面喇叭与引导；新默认下喇叭+发动机 RMS 约 0.0966，怠速约 0.0298，相差约 10.2 dB；峰值约 0.3363，8 次连续点击没有额外声部，静音 RMS 为 0。
- [wp5-report.json](qa/cockpit-desktop-v3/v33/audio-repair/wp5-report.json)：正式空音乐清单明确阻塞；仅测试输入下验证播放/暂停/切换/进度/静音、自然结束续播与可信 seeked。异步 seek 检查等待实际媒体完成，不使用固定 180 ms 来推断完成。

所有原始 WAV/WebM 保存在上述证据目录，没有归一化处理。精确峰值以机器报告为准。

## 功能和资源回归

[core-report.json](qa/cockpit-desktop-v3/v33/audio-repair/core-report.json) 包含本轮 WP1、WP3、WP4、四 tab 布局和原控制回归：D/S/R 运动方向/速度/减速/停止；雾和独立雾灯；五种空调模式/三档气流/关闭/内侧水汽；挡位和刹车/倒车灯；驾驶与停车守卫。两种桌面尺寸无整页或面板滚动，390×844 可纵向滚动、返回可达。

没有重做 V3.1/V3.2 历史开发或整套审计。既有双雨刮/天气机械证据继续保留；本次保护原机械/安全函数，重新运行的是受新混音影响的 V3.3 音频与必要功能回归。原 315 个 key、638 MP3 和 641 个 voice 路径逐路径 SHA256 一致。原版汽车、其他 19 场景和公共 JS 保持不变；没有把字节保护表述为本轮重新加载全部场景/播放全部旧音频。

截图：[1366 车内](qa/cockpit-desktop-v3/v33/audio-repair/final-cabin-1366x768.png)、[1920 车内](qa/cockpit-desktop-v3/v33/audio-repair/final-cabin-1920x1080.png)、[雾天](qa/cockpit-desktop-v3/v33/audio-repair/final-fog-lights-1366x768.png)、[喇叭引导](qa/cockpit-desktop-v3/v33/audio-repair/horn-guide-1366x768.png)。

## 未交付和未验证

WP5 **ASSET_BLOCKED**：正式音乐 0 首；未找到可核实公开再分发许可的音乐，既有来源访问被代理 403 拒绝的证据保留，没有绕过或新下载。`assets/music/manifest.json` 继续为空。[音乐许可记录](MUSIC_LICENSES.md) 不变，语音测试输入不能作为音乐授权或音乐体验验收。

真人/儿童听音、中文读音自然度、实体扬声器舒适度、HarmonyOS、其他浏览器和真实 GPU 性能仍待人工验收。实际解码和输出测试 PASS 不等于这些项目 PASS。本次仅提交/推送允许独立交付的 V3.3 功能，不合并 main、不修改 Simple+、不部署网站。

## 测试复现

Playwright 1.58.2 安装在仓库外；设置 `PLAYWRIGHT_MODULE` 指向它。`LE_V33_QA_OUT` 指定独立证据目录，避免覆盖历史报告。

```sh
export PLAYWRIGHT_MODULE=/tmp/le-v33-qa/node_modules/playwright-core
export LE_V33_QA_OUT=/tmp/le-v33-audio-recheck
node tools/qa_cockpit_v33.cjs --audio-repair
node tools/qa_cockpit_v33.cjs --voice-coverage
node tools/qa_cockpit_v33.cjs --wp2 --horn
node tools/qa_cockpit_v33.cjs --wp1 --wp3 --wp4 --layout --core
node tools/qa_cockpit_v33.cjs --wp5
node tools/qa_cockpit_v33.cjs --fixture-mix
```

`--device-output` 需要隔离的 PulseAudio Unix socket（`PULSE_SERVER`）；`--lifecycle` 使用真实桌面浏览器/Xvfb，可设置 `DISPLAY`。测试不调整设备音量或产品 state。最后一次文案小改将「发动机声音」状态改为更准确的「驾驶舱声音」；汇总逐报告核验源码哈希并明确仅这一文字差异，最终音频/发动机/喇叭/播放器报告已匹配当前源码。
