# Cockpit V3.2 — 刹车灯与倒车灯集成验收

日期：2026-10-22。分支：`feature/car-cockpit-desktop-v3`。
已通过 fetch 核验的起点：`fcffdc29f0761f3d066efd07d815fe818a43b019`。

## 实际变更

唯一产品文件是 `pages/cockpit.html`（22 行新增、4 行删除）：在原有中央后视镜内，用被动 SVG 车尾示意替换原汽车 emoji；加入两侧红色刹车灯、两侧白色倒车灯及「刹车 Brake / 倒车 Reverse」说明；版本标记改为 V3.2。

在现有 `update()` 开头追加渲染：`state.brake` 控制 `.braking`，`state.gear === 'R'` 控制 `.reversing`，两组互不排斥，并更新可访问状态说明。没有新增控制开关或产品状态。其余原有 JavaScript 与基线逐字节相同，因此没有改写驾驶守卫、语音、雨雪、雨刮、仪表或物理逻辑。新增 CSS 仅作用于后视镜内部。

[产品 diff](product.diff)；[新增自动测试源码](qa.cjs)。其他新增文件都是本目录中的验收证据；没有改动既有工具和既有 QA 证据。

## 本轮真实浏览器测试：PASS

Chromium `151.0.7922.173`，Playwright `1.58.2`，本地 HTTP 服务提供真实产品 HTML。灯光测试在 1366×768、1920×1080 各完整执行一次，累计 84 次受信任的原生点击、46 个灯光状态记录。仅观察 DOM、SVG 和原有按钮状态，没有直接赋值产品 state，也没有用脚本触发产品按钮。驾驶时间测试推进原始 requestAnimationFrame；雨雪和雨刮周期测试使用真实经过时间。

| 验收项 | 结果及证据 |
| --- | --- |
| 踩下/松开脚刹 | 两侧红灯点亮/熄灭；P/R/N/D/S 全覆盖，包含发动机未启动时 |
| 进入/退出 R | 两侧白灯点亮/熄灭；退出至 N 时白灯灭而脚刹红灯保持 |
| R 挡踩刹车 | 两红两白同时点亮；松脚刹后仅白灯保持 |
| 非法换挡 | 未启动挂 R、未踩脚刹 D→R、行驶中 R→D/N/P 和 D→R 均被原守卫拒绝，灯光不误变 |
| 起步与停车 | 原生点击完成 R 和 D 的起步/刹停/驻车/熄火，灯光全程正确；原 V3.1 D/S 回归通过 |
| 布局 | 两种桌面尺寸无整页滚动；后视镜、道路、雨刮、仪表、方向盘、控制区、返回按钮及所有按钮与基线几何/标记一致，无新增遮挡 |
| 小屏 | 390×844 无横向溢出，返回按钮可发现且命中尺寸至少 44×44；允许纵向滚动 |
| 双雨刮 | 两个雨刮协调运动且始终在玻璃内，OFF 归位后保持静止；三挡实测周期见下表 |
| 天气 | NONE/LIGHT/MEDIUM/HEAVY/STORM 雨滴数 0/18/45/90/180；STORM 实测速度超过 HEAVY 的 1.4 倍，保持道路可见 |
| 暴雨自动/手动 | 进入 STORM 自动 HIGH；手动 LOW/OFF 保持，重复选择当前 STORM 不覆盖；离开再进入 STORM 自动 HIGH |
| 雪天 | 75 片雪花，雨雪互斥，切回雨天后雪层隐藏 |
| 动态仪表与守卫 | D/S 加速、速度/RPM 指针、行驶中禁止 P/熄火/驻车制动、完整停车顺序通过 |
| 错误 | 两份报告均无新增 JS、控制台或资源请求错误 |

| 视口 | 雨刮档位 | 实测周期 |
| --- | --- | --- |
| 1366×768 | LOW | 2649.8 ms |
| 1366×768 | MEDIUM | 1583.3 ms |
| 1366×768 | HIGH | 850.0 ms |
| 1920×1080 | LOW | 2599.9 ms |
| 1920×1080 | MEDIUM | 1583.2 ms |
| 1920×1080 | HIGH | 866.6 ms |

原 V3.1 测试源码保持不变，仅通过 `LE_V31_QA_OUT` 将本轮新结果保存到独立子目录。报告中的 `version: V3.1` 指该回归测试套件，其 `testedSHA256` 精确指向本轮 V3.2 产品内容。

## 保护结果

相对 fcffdc29 基线，除 `pages/cockpit.html` 外全部 908 个已跟踪文件保持原 Git blob 不变。原版 3D 汽车、其入口、其他 19 个场景、原测试和历史证据均未修改。原 315 条 key 和 638 个 MP3 保持不变，对 641 个 voice 路径逐一复核 SHA256，通过。

本轮没有重新加载全部 20 个 3D 场景或重跑此前完整 Phase 3 音频播放套件；这些文件和既有验收证据逐字节不变，本轮验证范围为车尾灯及驾驶舱 V3.1 回归。不将文件保护检查表述为新的 3D 运行验收。

## 证据

- [灯光状态、受信任点击及布局对比](rear-lights-report.json)
- [V3.1 回归、雨滴/雨刮原始采样](v31-regression/qa-report.json)
- [原资源逐路径 SHA256 及保护范围](protected-files.json)
- [1366 红灯](brake-red-1366x768.png) / [1920 红灯](brake-red-1920x1080.png)
- [1366 红白同时亮](reverse-and-brake-1366x768.png) / [1920 红白同时亮](reverse-and-brake-1920x1080.png)
- [1366 白灯](reverse-white-1366x768.png) / [1920 白灯](reverse-white-1920x1080.png)
- [1366 停车熄灭](parked-off-1366x768.png) / [1920 停车熄灭](parked-off-1920x1080.png)
- [1366 后视镜局部](mirror-both-1366.png) / [1920 后视镜局部](mirror-both-1920.png)
- [390×844](mobile-390x844.png)
- [大暴雨](v31-regression/storm-high-1366x768.png) / [雪天](v31-regression/snow-1366x768.png) / [S 挡行驶](v31-regression/s-driving-1366x768.png)

## 可复现命令

仓库外安装固定版本 Playwright，使用已安装 Chromium；以下命令不会修改产品状态或既有 QA 文件：

```sh
PLAYWRIGHT_MODULE=/tmp/le-v32-qa/node_modules/playwright-core node docs/qa/cockpit-desktop-v3/v32/qa.cjs
PLAYWRIGHT_MODULE=/tmp/le-v32-qa/node_modules/playwright-core LE_V31_QA_OUT="$PWD/docs/qa/cockpit-desktop-v3/v32/v31-regression" node tools/qa_cockpit_desktop_v3.cjs --v31-wipers
```

被测 HTML SHA256：`5133d8c4b705c1889fe9f0ec90817bfe96a4ac2051dae8c3306a72fa9cecd908`。

## 未验证事项与边界

- 本轮关闭浏览器讲解后执行交互 QA，原语音代码逐字节不变。云端浏览器先前存在 `synthesis-failed`，本轮未重测听音，不声称浏览器 TTS 已恢复或真人听音通过。未新增/修改预生成 MP3。
- 截图已由自动化生成并检查关键画面；儿童体验、真人视觉/中文听音验收尚待用户完成。
- HarmonyOS 实机、其他浏览器、真实 GPU、真实设备缩放尚未测试。
- 不代表真实车辆控制或实际驾驶规程；没有跨页状态同步、3D 尾灯改造、部署或分支合并。
