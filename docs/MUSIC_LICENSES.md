# Cockpit V3.3 音乐资产与许可审计

审计日期：2026-10-22（Asia/Shanghai）。状态：**ASSET_BLOCKED**。正式音乐数量：**0**。

仓库仅有原 638 个讲解 MP3，没有可核实公开再分发许可的器乐音乐。现有 MIT 项目许可证不被当作外部音乐的授权证明。没有将讲解音频、合成蜂鸣或提示音列入正式音乐库。

尝试通过云环境正常代理访问候选音乐来源 `https://freepd.com/`，在 HTTPS CONNECT 阶段收到 **403 Forbidden**；尚未连接来源服务器，无法读取或核实该站任何曲目的许可，也没有下载音乐。不将此结果描述为音乐来源服务器拒绝。没有取消代理、换用代理、绕过域名策略或改用镜像获取受阻资源。

| 正式曲目 | 作者/来源 | 原始来源 URL | 许可名称/版本及原文 | 公开再分发 | 署名要求 | 获取日期 | 大小/SHA256 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 无 | 未核实 | 不适用 | 未核实 | 未核实 | 未核实 | 未获取 | 无文件 |

播放器读取 [manifest](../assets/music/manifest.json)，当前为空且明确标记 `ASSET_BLOCKED`。页面显示「音乐待添加 / No licensed tracks yet」，播放操作禁用，未伪装成音乐已交付。

后续纳入至少 3 首曲目前，每项必须具备：`title`、`author`、`source`（原始 URL）、`license.name`（含版本）、`license.url`（可核验许可原文链接或归档）、`redistributionApproved: true`、`attribution`（明确是否需要）、`acquiredDate`、`file`、`sha256`、`bytes`。音乐还需人工核实适合儿童、实际结构与旋律，再通过 MP3 解码和浏览器实际输出 QA。默认音乐音量为 30%，不会自动播放。

自动测试使用原仓库的两条**讲解**音频作为仅用于播放器传输测试的输入，清单由测试路由临时替换；正式清单不变。此测试证明播放、暂停、切换、音量、静音、进度和结束续播的代码路径，不证明音乐资产、音乐许可或正式音乐播放通过。报告和录音均明确标记 `fixture / NOT MUSIC`。

## V3.4 候选获取：2026-10-23

本轮优先核查用户指定的三个 OpenGameArt 候选。通过继承的云端代理请求第一个作品原始页面时，在 **HTTPS CONNECT 代理阶段收到 403 Forbidden**，尚未连接作品服务器。当前环境策略没有允许 `opengameart.org`。该域名访问受阻后停止获取，没有更换域名、镜像、代理或绕过限制，也没有把代理拒绝描述为作品服务器拒绝。

[实际访问证据](qa/cockpit-desktop-v3/v34/music-source-access.json)。下面的曲名、作者和文件名来自用户指定候选，**不是本轮已独立核验的许可/作者/文件身份**。用户说明页面标注 CC0；由于页面未取得，许可与原始文件的一致性仍未核验，因此均不进入正式清单。

| 中文 / 英文候选名 | 用户指定作者 | 作品原始页面 | 所需原始文件 | 本轮取得/核验 | 原始 SHA256 / MP3 SHA256 |
| --- | --- | --- | --- | --- | --- |
| 快乐时光 / Happy Moments | Centurion_of_war | https://opengameart.org/content/happy-moments | `piano1.4.ogg` | 页面请求被代理拒绝；文件未取得，许可未核验 | 未取得 / 未转换 |
| 小镇漫游 / Loop Town | Fupi | https://opengameart.org/content/loop-town | `loopcity.ogg` | 同域名受阻后未再次请求；文件和许可未核验 | 未取得 / 未转换 |
| 新的一天 / A New Day | SpiderDave | https://opengameart.org/content/a-new-day | `49.ogg` | 同域名受阻后未再次请求；文件和许可未核验 | 未取得 / 未转换 |

候选许可参考链接为 https://creativecommons.org/publicdomain/zero/1.0/ ，这不能替代作品页面将该许可授予对应原始文件的证据。当前公开再分发授权、署名要求与获取日期均未核实/未取得；不能凭用户候选说明直接设 `redistributionApproved: true`。

WP2 状态：**BLOCKED**。正式音乐仍为 0 首，`assets/music/manifest.json` 保持 V3.3 的 `ASSET_BLOCKED` 空清单，没有集成替代音频或测试语音。需要用户从上列作品原始页面下载并上传三个原始 OGG，最好同时提供原始页面的许可存档；之后再核查许可、作者、文件一致性并记录原始/转换 SHA256、转换与实际播放证据。
