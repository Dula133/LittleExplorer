# LittleExplorer · Cockpit V3 / V3.1 集成与验收

基准：`feature/car-simple-plus` / `cfbe268081a094050152054d26f70297b58da385`。
工作分支：`feature/car-cockpit-desktop-v3`。从启动时 clean、fetch 后精确匹配的 Phase 3 提交创建。V3 尚未提交时收到 V3.1 追加要求，本次交付包含该基准之上的 V3 集成与 V3.1 改进。未使用已否决的旧驾驶舱分支。

## 实现范围

`pages/cockpit.html` 直接来自附件 `LittleExplorer_驾驶舱交互原型_v3_电脑横屏.html`。保留其 SVG 道路、仪表、方向盘、四 tab、P/R/N/D/S、安全守卫和浏览器中文朗读。附件来源及 SHA256 见 [来源记录](qa/cockpit-desktop-v3/prototype-provenance.json)，完整差异见 [原型到当前版本 diff](qa/cockpit-desktop-v3/prototype-integration.diff)。V3.1 的新需求优先于原型的单雨刮和旧天气档位。

V3 集成改动：

- 汽车页仅增加四行局部 CSS 和一个 74×62 px 的图标双语入口。入口绝对定位，不参与原顶部 flex 排版，不改变画布、相机、三大按钮或车体。
- 驾驶舱直接显示；删除虚构外观页。入口是真实 `pages/cockpit.html` 导航，返回链接是真实 `car.html` 导航。
- 修复原型空调温度改变后数字未刷新的问题；短暂提示移入挡风玻璃景物容器，避免遮挡操作控件。补充键盘焦点、44 px 返回目标和讲解英文对比度。
- 更新过时说明，保留明确的“儿童模拟”。音乐按钮是模拟状态，不播放歌曲。离开页面取消本页朗读。

V3.1 改动：

- 两套 SVG 雨刮分别具有转轴、连杆和刷片。两轴使用同一连续相位，摆角分别为 66° 和 64°，保持协调且不相交；SVG 和挡风玻璃均裁剪，刷片不会进入仪表区域。
- OFF / LOW / MEDIUM / HIGH 四档，低、中、高完整往返目标周期为 2.60 / 1.55 / 0.85 秒。换速保持相位；OFF 完成回程并停驻下缘，避免瞬移。
- 雨刮按真实经过时间推进，与驾驶物理原有时间步上限分离；因此低帧率不会把高速雨刮拖成中速。驾驶加减速逻辑不变。
- NONE / LIGHT / MEDIUM / HEAVY / STORM 的雨滴元素启用数为 0 / 18 / 45 / 90 / 180。STORM 下落周期约为 HEAVY 的 0.537 倍；只适度调暗景物，道路保持可见。
- 仅从其他天气切入 STORM 时默认 HIGH。手动选择后，持续渲染或再次点同一 STORM 不会覆盖该选择；离开 STORM 也保留雨刮档位，再次切入才重新默认 HIGH。
- 保留 75 个雪花。雨雪隐藏切换立即生效，避免淡出期间重叠。
- 桌面左区约 44% 为挡风玻璃，56% 为仪表区；压缩反馈栏的讲解按钮排列，腾出道路高度并保留大仪表和方向盘。桌面雨量六按钮（含雪）、雨刮四按钮均为图标主导；小屏雨量为两行。

所有驾驶舱速度、RPM、道路、雨雪及车内设置都是独立儿童认知模拟，不控制真实车辆，不代表实际驾驶规程。没有跨页状态共享、3D 雪景或向 3D API 传入 SNOW/STORM。

## V3.1 真实浏览器验收

Chromium 151.0.7922.173、Playwright 1.58.2，Linux 软件渲染。没有调用产品内部动作制造结果；交互采用可信浏览器输入，雨刮使用真实 rAF 时间采样，雨滴比较实际位置变化。

| 验收项 | 1366×768 | 1920×1080 |
| --- | --- | --- |
| 双独立转轴、协调运动、刷片始终在玻璃内 | PASS | PASS |
| OFF 自动归位并保持静止 | PASS | PASS |
| LOW 实测完整往返周期 | 2.600 秒 | 2.683 秒 |
| MEDIUM 实测周期 | 1.567 秒 | 1.583 秒 |
| HIGH 实测周期 | 0.850 秒 | 0.850 秒 |
| 五级雨量及 STORM 默认 HIGH | PASS | PASS |
| 手动改档、相同 STORM 不覆盖、离开保持、重新进入自动 HIGH | PASS | PASS |
| 雪天可见，雨雪互斥 | PASS | PASS |
| 整页无需滚动，雨刮不进入仪表 | PASS | PASS |

1366×768 实测 HEAVY / STORM 的雨滴下落速度中位数为约 337 / 610 px/s；1920×1080 为约 456 / 887 px/s。STORM 的启用雨滴数均为 HEAVY 两倍，道路本体不透明度保持 1，雨层背景透明。

V3.1 下重新检查了系带→脚刹→启动→D→松驻车→松脚刹→油门，切换 S 加速，两根仪表指针随速度和 RPM 改变，以及松油门→脚刹停稳→驻车→P→熄火→松脚刹。未踩刹车启动、行驶中 P/熄火/驻车和停稳前错误顺序均被守卫拒绝。P/R/N 的原逻辑和其他车内/灯光实现保留，原 V3 专项已有覆盖。

- [V3.1 完整采样报告](qa/cockpit-desktop-v3/v31/qa-report.json)：每帧双刷角度、边界和周期、雨滴数/实际速度、雪及驾驶流程。
- [V3.1 布局补测](qa/cockpit-desktop-v3/layout-v31.json)：四个桌面尺寸、减少工具栏高度、390×844、窄横屏及真实 125% 缩放，共 14 组；四个 tab 和全部按钮可达。
- 真 125% 缩放在一次性 Chromium 配置目录设置，CDP 验证 `zoom=1.25` 且 `scale=1`；不是 CSS transform 或捏合缩放。宽 ≥1000 且高 ≥620 CSS px 时一屏；低于阈值允许文档滚动，内部面板可滚动。

## 原版和 Simple+ 回归

状态：V3.1 请求范围通过。19 个其他场景已在本轮逐一加载并检查 WebGL；本轮完成报告无新增 JS、console、HTTP 或 context-loss 错误。旧资源逐路径保护通过。

原测试文件逐字节保留。第一次完整回归已完成首页、原汽车两种竖屏、桌面相机/结构/截图、灯光和天气 API、四组 Phase 2 原生触控与拆装等检查；在实时媒体场景的取点和触控之间发生视角移动而中断。首次已完成项保留原日志、截图、[基础证据](qa/cockpit-desktop-v3/phase3-regression/foundation-api-evidence.json) 和 [像素对比](qa/cockpit-desktop-v3/phase3-regression/visual-comparison.json)，没有将第一次中断写成全量 PASS。

按照继续任务“不重复已有完整证据”的要求，适配器通过显式 `--resume-media-scenes` 只继续未完成的讲解期间按钮锁定、19 场景、错误与基准保护检查。两套 20 key 的完整原生播放证据在精确基准提交中已经存在，原代码、映射和音频文件均不变，因此通过显式 `--reuse-unchanged-phase3-audio` 验证并复用该证据，不宣称本轮重新播放完全部 40 条。每套原证据实际含 26 次样音播放，覆盖全部 20 个新增 key，均有可信 playing/ended 且无兜底。本轮的原生讲解锁定、原车灯两套音色播放及驾驶舱往返后播放另有实测记录。仅冻结原生取点准备及锁定断言期间的渲染/JS 时钟，推进原帧生成真实控件，并在等待真实 ended 前恢复；原生 Audio 始终按真实时间播放。没有伪造媒体完成、替换音频、直接调用产品动作或修改旧测试源。恢复时的编译源及原始/编译 SHA256、范围见 [恢复出处记录](qa/cockpit-desktop-v3/phase3-remaining/resume-provenance.json)。

新分支门禁及入口像素差异由 [回归适配器](../tools/qa_cockpit_phase3_regression.cjs) 处理：旧结构/相机断言不变；只额外允许 74×62 px 新链接及有限阴影范围，其余区域沿用原断言。未重录基线。原基准固有 `/favicon.ico` 缺失不作为新增资源错误。

原 315 key、两套 638 个 MP3、映射及全部其他基准文件逐路径保护；SHA256 见 [保护记录](qa/cockpit-desktop-v3/protected-phase3-sha256.json)。`scenes/car.js`、`js/app.js`、首页和其他 19 场景均未修改。

可复现命令（Playwright 放在仓库外）：

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core \
  node tools/qa_cockpit_desktop_v3.cjs --v31-wipers
PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core \
  node docs/qa/cockpit-desktop-v3/layout-v31.cjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core \
  LE_QA_OUT="$PWD/docs/qa/cockpit-desktop-v3/phase3-remaining" \
  node tools/qa_cockpit_phase3_regression.cjs --resume-media-scenes --reuse-unchanged-phase3-audio
```

不带恢复参数可执行完整旧回归适配器；无需为了本次继续任务重跑已完成项。

最终 [剩余检查报告](qa/cockpit-desktop-v3/phase3-remaining/qa-report.json)、[明确复用的音频证据](qa/cockpit-desktop-v3/phase3-remaining/reused-phase3-audio.json)、[本轮原生讲解锁定](qa/cockpit-desktop-v3/phase3-remaining/ui-touch-evidence.json) 与 [汇总验收](qa/cockpit-desktop-v3/acceptance-report.json) 分开保存。

## 截图

- [V3.1 默认驾驶舱](qa/cockpit-desktop-v3/v31/default-1366x768.png)
- [大暴雨＋高速双雨刮 1366×768](qa/cockpit-desktop-v3/v31/storm-high-1366x768.png)
- [大暴雨＋高速双雨刮 1920×1080](qa/cockpit-desktop-v3/v31/storm-high-1920x1080.png)
- [LOW](qa/cockpit-desktop-v3/v31/wipers-low-1366x768.png) / [MEDIUM](qa/cockpit-desktop-v3/v31/wipers-medium-1366x768.png) / [HIGH](qa/cockpit-desktop-v3/v31/wipers-high-1366x768.png)
- [保留雪天](qa/cockpit-desktop-v3/v31/snow-1366x768.png)
- [S 挡和动态仪表](qa/cockpit-desktop-v3/v31/s-driving-1366x768.png)
- [3D 新入口](qa/cockpit-desktop-v3/car-cockpit-entry-1280x720.png) / [真实返回后的 3D](qa/cockpit-desktop-v3/car-returned-1280x720.png)
- [V3.1 真实 125% 缩放](qa/cockpit-desktop-v3/v31-125percent-1440x900.png)

## 语音及尚未验证事项

原预生成 MP3 的文件解码、浏览器 native playing/ended、浏览器 TTS 调用、真人/儿童听音和 HarmonyOS 实机是不同验收项。

驾驶舱新增提示沿用原型的 `speechSynthesis`，`zh-CN`、rate 0.92，没有新增或重录 MP3。本云端 Chromium 实际返回 `synthesis-failed`，没有可用系统 voice；因此只验证了原生 API 请求、开关和文字反馈，**不能报告新增中文提示已成功发声**。该环境限制在 V3 阶段已确认，V3.1 雨刮测试关闭朗读，未反复重试语音或安装替代服务。原 3D 的两套预录 MP3 独立验证。

真人/儿童中文听音、发音自然度、HarmonyOS 实机、实体浏览器音效与 GPU 性能、其他浏览器及不同系统 emoji/字体尚未验收。统一预录驾驶舱提示、跨页共享状态或 3D 雪景均需要另行授权。

版本保存：按继续任务授权，在新驾驶舱分支完成检查后 commit/push；最终 SHA 和远程验证以交付记录为准。未修改 main、Simple+ 远程分支，未合并、创建预览网站或部署 GitHub Pages/Netlify。
