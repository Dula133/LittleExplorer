# 汽车场景模块与迁移约定

本轮从 `d132f97` 迁移现有驾驶舱，保留几何、零件 ID、儿童文案和状态行为。
继续使用同步经典脚本和当前 Three.js，不引入框架或打包器。

| 文件 | 职责与接口 |
| --- | --- |
| `scenes/car.js` | 场景入口、街景、车身/动力几何、驾驶动画、模块组装；保留 `SCENES.car` 公共接口 |
| `scenes/car/car_controls.js` | 模式常量、每实例状态、受控操作、状态快照；一次性绑定原车门和车窗 |
| `scenes/car/car_lighting.js` | 灯光模式、临时演示、刹车期限、统一闪烁相位；更新传入的灯具引用 |
| `scenes/car/car_weather.js` | 雨量、雨刮、起雾/除雾更新；雨滴仍为最多 360 个实例 |
| `scenes/car/car_cockpit.js` | 驾驶舱/门内饰几何、控件注册、仪表与控件动画、驾驶舱相机数据 |
| `scenes/car/car_audio.js` | 提醒、喇叭防连点、音乐通道、雨声优先级；通过引擎音效接口共用 AudioContext |
| `scenes/car/car_cockpit_ui.js` | 汽车专用分区面板、状态文本、家长弹窗与样式；通过传入的选择和相机接口操作 |

## 状态与生命周期

- 所有模块共用 `createRuntime(api, options)` 创建的一份状态。外部 UI 使用 `SCENES.car.lighting/weather/controls`，不直接写材质。
- `env` 与 `build` 使用同一 `ctx` 的 runtime；同一 `ctx` 重复 `build` 会明确报错，避免重复几何和交互绑定。
- 车门开合和车窗档位继续存放在原节点 `userData`。控件持有这些节点引用，不再包装或覆盖已有 setter。
- 首页通过 `build(ctx, api, {preview:true})` 创建独立实例。预览不替换交互页面的公共接口目标，也不创建音频节点。
- 模型引用保存在模块闭包或显式返回对象，不在 `userData` 中加入 Object3D 引用；维持图标克隆兼容性。
- 帧更新顺序：驾驶动画 → 灯光 → 天气 → 音频 → 驾驶舱。灯光与仪表共用同一帧的 `t` 和闪烁相位。
- 汽车音频的 `dispose()` 释放自身音乐节点。通用音效、静音、后台暂停和声音上下文继续由公共引擎负责。

## 页面与生成

`tools/scene_deps.json` 是汽车依赖顺序的唯一清单；模块定义在 `car.js` 前加载。
`tools/page-template.html` 的 `__SCENE_DEPS__` 插槽负责依赖注入；首页同样从清单生成依赖区块。

只生成汽车页面：

```bash
python -B tools/build_pages.py --scene car
```

该命令更新汽车页面和首页相关脚本版本，不重写另外 19 个场景页面。
语音工具递归扫描场景子目录，迁移不会丢掉已有讲解定义。

## 验证与回滚

```bash
node tools/qa_car_state.cjs
NODE_PATH=/workspace/.littleexplorer-tools/node_modules node tools/qa_car_geometry.cjs
python -m http.server 19765 --bind 127.0.0.1
# 在另一个终端运行以下两个检查；可用 LE_QA_URL 改服务地址。
NODE_PATH=/workspace/.littleexplorer-tools/node_modules node tools/qa_car_architecture.cjs
NODE_PATH=/workspace/.littleexplorer-tools/node_modules node tools/qa_car_cockpit.cjs
```

浏览器脚本依赖 Playwright Core 和 Chromium；可通过 `LE_QA_CHROMIUM` 指定浏览器。
几何对比固定重构前 commit，要求本地保留该提交；新增模型时应显式选择新的 `LE_QA_BASELINE`。
完整回归的截图/报告默认写到 `/tmp/littleexplorer-cockpit-v03`，可用 `LE_QA_OUT` 指定仓库外目录。

迁移按测试基线、状态与加载、几何与更新、音频与面板分别提交。需要回滚时，先检查工作区，按相反顺序 revert 对应提交；依赖清单和生成页面必须随源码一起回滚。不要只删模块脚本或只撤销生成页面。

HarmonyOS 实机帧率、真实声音听感仍须人工验证；软件渲染器的帧时间不能代表手机 GPU 性能。
