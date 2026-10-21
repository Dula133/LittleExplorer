# Simple+ Phase 3：两套新增预生成语音

基准：`ee31b3a33535d2e3926af81ba4f61e6a7ff8fa2f`，分支 `feature/car-simple-plus`。

## 生成与集成

以 Phase 2 的 20 条完整语音 key 为合同，包含名称、句号及动态反馈全文。
按完整文本 MD5 前 8 位生成 ID；20 条之间及与原 295 条之间无 ID 冲突。
新增云夏 `zh-CN-YunxiaNeural`、小依 `zh-CN-XiaoyiNeural` 各 20 个 MP3，语速均为 `-8%`。
原 295 条映射及 ID 保留，当前共 315 条。原 598 个 MP3 SHA256 全部保留。
两音色目录当前各有 319 个 MP3（含原 sample 和原先已存在的额外文件）。

全部音频先在仓库外 staging 生成，每个文件校验非空、时长及 FFmpeg 解码后才集成。
40 次请求均经原云端代理，每个音频一次请求，无重试；TLS 验证开启、WebSocket 均返回 101。
时长 2.688–9.456 秒，共 1,137,744 字节。

运行环境为 Python 3.12.14、edge-tts 7.3.1。临时启动脚本核对平台提供的
`CODEX_PROXY_CERT` 身份，在进程内向 edge-tts 原有 SSLContext 调用
`load_verify_locations()`，保留全部 certifi 根证书，并追加平台 CA。
证书验证及主机名验证始终开启；实际 WebSocket 使用同一上下文。
未修改第三方包、系统证书或代理配置，未将平台证书放入仓库。

仅更新音频、两份映射、汽车页的映射版本参数和检查工具。
`scenes/car.js`、`js/app.js`、首页、其余 19 页均与 Phase 2 基准逐字节一致。
汽车页只改 `voice/lines.js` 查询参数，避免继续命中旧映射缓存。

## QA 方法

```sh
PLAYWRIGHT_MODULE=/path/to/playwright-core LE_QA_OUT=/tmp/le-phase3-qa \
  node tools/qa_car_simple_plus.cjs --candidate-phase3
python -B tools/check_voice.py
```

使用原固定 Chromium 151.0.7922.173、Playwright 1.58.2、字体、DPR、时钟和随机种子。
Phase 3 模式继承 Phase 2 全部行为、视觉、横竖屏、原 MP3 与十九场景回归，
新增精确文件范围、315 条映射一致性、原 598 个 SHA256 及 40 个新音频解码检查。
旧 Phase 2 模式保留其“尚缺正式配音”的历史门槛；完成配音后使用 Phase 3 模式。
Phase 0、1、2 原证据不重录、不覆盖。

新增浏览器测试使用真实触控与模型射线点选小灯、雾灯及左右转向灯；
动态按钮覆盖灯光档位、双闪、转向开关、四档雨量、独立雨刮和电池演示反馈。
两套音色均要求真实、可信的 `playing` 和 `ended` 事件；未模拟媒体完成。
系统 TTS 的观察器调用原生实现，仅记录是否意外兜底，不屏蔽其行为。
电池演示反馈单列为受控时钟用例：只在原生点按准备阶段暂停测试时钟，
静音启动演示、选择车灯后取消静音并点灯光按钮，再恢复时钟观察真实播放。
这避免软件渲染耗时超过 3.5 秒演示窗口；不直接设置场景状态，不修改 busy 守卫或产品代码，
不模拟音频完成，也不把该受控时序用例称为真实设备上的自然操作验收。

## 验收边界

文件解码与浏览器原生播放完成是自动化证据，不代表真人听音验收。
多音字、停顿、语气和音色偏好仍需真人逐条听测；不声称已验证发音无异常。
HarmonyOS 实机的触控命中、扬声器听感、后台恢复、缓存更新及 GPU 性能尚未验证。
不 merge main，不发布 GitHub Pages，不部署 Netlify。

## 最终自动 QA 结果

完整 Phase 3 模式最终 PASS：24 组检查、227 条原生输入记录。
两套音色各 20 条新增 key 均有真实 playing/ended，包含 52 次讲解/反馈播放记录；
系统 TTS 意外兜底为 0。四种横竖屏及其余十九场景加载均通过。
40 个新文件和原 598 个 MP3 全部解码；集成后再次核验全部 SHA256。
原 295 条映射 ID 保持不变；两份映射语义一致。
无新增 JS、WebGL 或资源错误；仅单列原版 favicon.ico 缺失的已知 404。

八张原版对照图通过：首页像素完全一致。
其中一张图在批准局部区域外有 458 个像素出现最多 2/255 的通道舍入差异，
符合既有 Phase 2 软件合成容差；其余七张范围外差异为 0。
场景、交互脚本、首页与 Phase 2 基准逐字节一致，汽车 HTML 仅映射缓存参数变化。

证据见 [完整报告](qa/simple-plus-phase3/qa-report.json)、
[真实播放](qa/simple-plus-phase3/phase3-playback.json)、
[生成/解码清单](qa/simple-plus-phase3/generation.json)、
[原语音保护](qa/simple-plus-phase3/original-voice-baseline.json)、
[视觉比较](qa/simple-plus-phase3/visual-comparison.json)。
真人听音及 HarmonyOS 实机仍未验收；不发布网站。
