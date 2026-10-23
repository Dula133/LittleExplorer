# Cockpit V3.4 — 巡航与真实音乐获取

日期：2026-10-23（Asia/Shanghai）。分支：`feature/car-cockpit-desktop-v3`。
核验基线：`22b53b928dbcd23d7ca4ee6b597693bdd0b57e31`。

## Git 与保护

开始时工作区 clean，本地 HEAD 与 `git ls-remote` 返回的远程真实 HEAD 均精确匹配基线。最初本地远程跟踪引用仍滞后在 V3.2，使用显式正常 fetch 将其快进更新；更新后 `origin/feature/car-cockpit-desktop-v3...HEAD` 为 `0 0`，没有分支分歧、reset 或强制覆盖。

除汽车驾驶舱 HTML 和音乐许可文档外，全部基线文件逐 Git blob 校验不变。原 315 个 key、638 个 MP3 与 V3.3 的 96 个 MP3 均保持原始 SHA256；包括映射/清单在内，共 738 个语音路径记录在 [cruise-report.json](qa/cockpit-desktop-v3/v34/cruise-report.json) 的 protection.hashes 中。

`js/cockpit-audio.js`、`js/cockpit-v33.js`、`pages/cockpit-v33.css`、原 3D 汽车、首页与其他 19 场景均未修改。本次没有重新加载全部 3D 场景；字节保护检查不是新的全场景运行验收。

## WP1：PASS

新增的速度表图标按钮位于原驾驶页底部喇叭/门锁同一行；将原两列局部变为三列，不增加页面分区。仪表下方增加绿色巡航图标与设定速度。

- 条件为发动机运行、系安全带、松开驻车制动与脚刹、D 或 S、实际速度至少 20 km/h，并在该挡模拟速度范围内。
- 启用时保存完整精度的当前实际速度，不采用显示整数反写速度，自动结束持续油门加速。显示值按现有仪表规则取整。
- 原 requestAnimationFrame、车速、RPM 和景物距离积分继续使用同一车速；巡航只在原物理分支之前提供保持速度的分支。没有另造道路动画或音频总线。
- 控制器使用最多 6 km/h/s 的有限校正，不把速度直接设为目标，因此切换不跳速。正常保持时当前速度等于保存目标，没有校正步进。
- **采用任务允许的简化油门规则：先取消巡航，再踩油门。** 巡航期间按油门仅给出简短提示，不开始加速。
- 再次点击或脚刹立即取消；任何更新若发现发动机关闭、未系带、驻车制动、脚刹、退出 D/S 或无效设定速度，均清除巡航。正常速度下 D↔S 保持；S 的设定值超过 D 的 100 km/h 模拟上限时，切 D 会取消并平滑滑行，不瞬间降至 100。
- 取消不恢复旧的油门锁定，不保留自动加速；下一帧恢复原 5 km/h/s 滑行、38 km/h/s 脚刹与原挡位加速逻辑。
- 新巡航提示是**图文提示**，未增加/替换任何中文 MP3，也不调用系统 TTS。现有讲解保持独立预生成通道；发动机声音继续随实际 RPM 平滑变化。
- 仅为儿童模拟，不是自动驾驶或真实车辆巡航系统。

实际产品文件：

| 文件 | 改动 |
| --- | --- |
| `pages/cockpit.html` | V3.4 标识、新按钮/仪表状态、新局部 CSS/控制器引入、两项巡航状态；在 update/tick/油门处加入精确小入口 |
| `js/cockpit-cruise.js` | 资格检查、设定/取消、油门守卫、有限速度保持及仪表按钮渲染 |
| `pages/cockpit-v34.css` | 仅新底部按钮行、巡航按钮和绿色仪表标记的局部样式 |

原启停/换挡/脚刹/驻车制动/系带等安全函数保留；旧油门函数仅增加一条明确的巡航阻止加速入口。旧速度/刹车/加速物理和双雨刮函数通过去除这项精确新增入口后的字节比较，未放宽其断言。

## 真实浏览器巡航 QA

Chromium 151.0.7922.173 / Playwright 1.58.2，真实受信任点击与键盘。巡航观察使用真实经过时间与 rAF，没有时间快进、产品 state 赋值或直接调用产品动作。

| 项目 | 1366×768 | 1920×1080 |
| --- | --- | --- |
| 停车不能启用 | PASS | PASS |
| R 挡达到 20 km/h 仍不能启用 | PASS | PASS |
| 低于 20 km/h 拒绝且不改变原油门状态 | PASS（6 km/h） | PASS（6 km/h） |
| 正常启用，结束持续油门 | PASS | PASS |
| 主观察挡位、显示设定车速 | D，35 km/h | S，36 km/h |
| 真实观察时间 | 约 10.05 秒 | 约 10.07 秒 |
| 观察期间仪表速度范围 | 35–35 | 36–36 |
| 指针、RPM、景物运动保持同步 | PASS | PASS |
| 巡航期间油门不加速；先取消再加速 | PASS | PASS |
| 再点取消，恢复原滑行减速 | 约 35→31，900 ms | 约 36→31，900 ms |
| 脚刹立即取消，红灯同步；无速度瞬跳 | PASS | PASS |
| 移动中 N/熄火/手刹/解安全带仍被原守卫拒绝 | PASS | PASS |
| 正常范围 D/S 切换保持巡航 | PASS | PASS |
| 停稳→N→驻车→P→熄火，巡航不重新激活 | PASS | PASS |
| 四 tab、按钮≥44 px、无整页/面板滚动 | PASS | PASS |

另在 1366 下以真实点击加速到 S 挡 110 km/h 以上后启用巡航，再切 D：巡航取消、车速没有瞬跳。启用/手动取消的点击前后针位逐项相同。

现有安全守卫要求先刹停才能退出 D/S 或熄火，因此真实合法停车流程中首先由脚刹取消。移动中强行换 N/熄火等操作被拒绝，并不伪造为已发生的挡位/发动机改变；没有绕过这些守卫来制造取消证据。

[完整巡航数据与音频指标](qa/cockpit-desktop-v3/v34/cruise-report.json) 包含每帧速度/指针、景物深度、实际音频 PCM 频率/RMS/峰值、点击切换和所有 tab 布局。巡航发动机实际音频峰值约 0.0831（D）/0.1120（S），无 ≥0.98 样本；不是仅检查节点存在。

## V3.3 功能与音频回归

[回归适配器](../tools/qa_cockpit_v34_regression.cjs) 在内存中复用未修改的 V3.3 测试源。只适配精确基线、允许的变更路径，并在比较原安全函数时去除精确的新增巡航按钮/油门入口。测试交互与断言不放宽，原/编译源码哈希记录于 [adapter-provenance.json](qa/cockpit-desktop-v3/v34/regression/adapter-provenance.json)。没有修改旧测试或历史证据。

- [功能回归](qa/cockpit-desktop-v3/v34/regression/core-report.json)：D/S/R 景物相对运动、速度联动/滑行/刹车/停止、雾与独立雾灯、五种空调方向/三档风速、P/R/N/D/S、尾灯、原安全流程、车灯/转向/双闪、昼夜、四 tab、390×844 返回可达。
- [音频与机械回归](qa/cockpit-desktop-v3/v34/regression/audio-repair-report.json)：发动机实际 PCM、原生点击的双雨刮三速/归位、全部雨量/暴雨默认高速/手动保持/雪天；现有中文与发动机/喇叭实际输出、峰值、静音、快速替换与 96 条浏览器解码。精确指标以报告为准。
- 没有新增 JS、console 或资源加载错误。
- 原音频图/全局静音/生命周期代码逐字节不变。沿用 V3.3 已有的真实后台/离页验证，不冒充本轮重跑的后台测试。

## WP2：BLOCKED

通过继承代理请求 `https://opengameart.org/content/happy-moments` 时，HTTPS CONNECT 阶段收到 403；没有连接作品服务器。当前域名策略未允许 OpenGameArt；本轮没有修改策略、代理或尝试镜像/绕过。

[下载失败证据](qa/cockpit-desktop-v3/v34/music-source-access.json) 与 [候选许可状态](MUSIC_LICENSES.md) 已保留。三个作品页面及对应文件/CC0 授权一致性尚无法独立核验。正式音乐仍为 **0 首**，`assets/music/manifest.json` 不变；没有把既有语音测试输入当作音乐，也没有报告正式音乐播放/解码通过。

所需原始文件为：

1. Happy Moments — Centurion_of_war：[原页面](https://opengameart.org/content/happy-moments)，`piano1.4.ogg`。
2. Loop Town — Fupi：[原页面](https://opengameart.org/content/loop-town)，`loopcity.ogg`。
3. A New Day — SpiderDave：[原页面](https://opengameart.org/content/a-new-day)，`49.ogg`。

等待用户从原始作品页面下载后上传上述文件，最好附许可页存档。核实后再转换、记录原始/MP3 SHA256、更新清单，并开展三首正式音乐的真实播放和四总线混音测试。候选页被描述为 CC0 不是本轮核验结论。

## 截图、保存与未验证事项

- [1366×768 D 挡巡航](qa/cockpit-desktop-v3/v34/cruise-active-1366x768.png)
- [1920×1080 S 挡巡航](qa/cockpit-desktop-v3/v34/cruise-active-1920x1080.png)
- [音乐缺口 1366](qa/cockpit-desktop-v3/v34/music-blocked-1366x768.png) / [1920](qa/cockpit-desktop-v3/v34/music-blocked-1920x1080.png)
- [修改路径清单](qa/cockpit-desktop-v3/v34/changed-files.txt) / [产品 diff](qa/cockpit-desktop-v3/v34/product.diff)

按本轮授权，巡航通过后独立提交/推送驾驶舱分支；音乐阻塞单独记录，不阻塞独立巡航成果。没有修改 main、Simple+ 或部署网站。

尚未验证：真人/儿童巡航体验、中文听音与实体扬声器舒适度、HarmonyOS 和其他实体设备/浏览器/GPU；正式音乐内容、授权与播放。真实浏览器解码/音频输出不等于真人听音。新增巡航提示未预录配音，不宣称其语音已交付。

复现：将 Playwright 1.58.2 安装在仓库外，设置 `PLAYWRIGHT_MODULE` 后运行 `node tools/qa_cockpit_v34.cjs`；运行必要回归时使用 `node tools/qa_cockpit_v34_regression.cjs --wp1 --wp3 --wp4 --layout --core` 和 `--wp2 --audio-repair --regression`。报告写入本版本独立证据目录。

[机器交付汇总](qa/cockpit-desktop-v3/v34/delivery-summary.json) 保存当前保护范围、各报告源码 SHA 对应关系和明确的阻塞。最终仅将底部说明细化为「中文语音使用独立预录资源；巡航新增提示为图文」，并重测桌面/小屏布局；旧报告保留真实被测 SHA，汇总验证除此一句说明外字节一致，没有改写旧证据为当前哈希。
