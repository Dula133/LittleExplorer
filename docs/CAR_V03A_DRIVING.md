# V0.3-A 驾驶核心区

基线：`edabab57fdc4aeeb149889adf412c7907a1699a5`。
开发分支：`feature/car-v0.3-driving`。沿用 V0.2 的六个模块与受控接口。

| 功能 | 原有实现 | 本轮改进 / 新增 |
| --- | --- | --- |
| 方向盘 | 三辐圆轮圈；与前轮同步 | 皮革质感 D 形轮圈、缎面辐条与自然中心盖；位置下移，减少仪表遮挡 |
| 中央喇叭 | 独立点选、短音、500ms 防连点、按压 | 扩大中心命中盒；事件立即按压并缓动恢复；喇叭图形标识；独立真实声音与音量联动 |
| 左拨杆 | 杆身只切左转；左右目标悬在仪表上 | 杆身 OFF → LEFT → RIGHT → OFF；左右箭头整合到端部，随杆身旋转；同侧再点关闭 |
| 右拨杆 | 已有 OFF / SLOW / FAST 与实际雨刮动画 | 独立可辨认的杆身与扩大命中面；“关 / 慢 / 快”档位文字随状态高亮 |
| 仪表 | 双表、P/D、油量条、前灯/转向/双闪/门指示 | 罩体、边框和程序绘制刻度；演示速度与刻度匹配；运行与档位指示读取原状态 |
| 视角与触控 | 驾驶舱、分区、触控代理、48px 面板入口 | 驾驶视角调整，看清方向盘、仪表、中控；横屏按右侧栏预留画面，收窄侧栏至 420px；自然实体命中面扩大 |
| 灯光、天气、启动 | lighting / weather / controls 已完整存在 | 复用原状态，不增加第二套转向、雨刮或车辆状态 |
| 导航、座椅、车窗 | 已有 V0.2 功能 | 不扩展新功能，保留原模型与行为 |

## 声音来源和范围

喇叭为本地 WebAudio 程序合成：420Hz / 525Hz 两个三角波，约 220ms 包络，节点约 240ms 后停止。
不包含真实 SUV 录音，不下载外部音频，不修改原有讲解 MP3 或映射。
四档 `volumeLevel` 同时控制演示音乐与短喇叭声；发动机、提醒声沿用原轻音量。
全局静音仍由公共引擎统一执行。音量为零、静音、后台及预览均不发出喇叭声。

驾驶舱驾驶/灯光/视野/中控分区仅对明确声明的核心控件应用命中优先级，解决箭头与门板大代理的重叠；左/右门分区及其他场景仍取原最近代理。

`selectSound:false` 仅对喇叭关闭通用选中提示音，避免叠加尖锐点击声；其他场景沿用默认行为。
按压反馈在静音时仍然存在，行程为 12mm，盖面保持在底座之外。500ms 防连点使用原 `hornUntil`，没有新增循环或并行状态。

## 仪表与资源约束

速度、转速、油量明确标为“示意 / 演示”，不连接真实传感器。
速度针与 `controls.getState().speed` 对应；P 档、停止或刹车恢复零速，D 档读取原运动状态。
转速针从原 `pistonSpd` 与油门演示计算。油量为固定演示值，不假装实时测量或消耗。
前灯、转向、双闪、门及 P/D 指示读取已有实际交互状态。
空调说明明确是设定温度，不是实测气温。

不引入模型文件、CDN、框架或新 Three.js 版本。用两张刻度纹理替代原独立刻度网格，保持可控网格数量。
驾驶改动只允许七个零件：steer / horn / instruments / turnStalk / turnControlLeft / turnControlRight / wiperControl。
其余零件几何、材质、位置、拆开目标由基线对比检查保护。

## QA 与人工验收

```bash
node tools/qa_car_state.cjs
NODE_PATH=/workspace/.littleexplorer-tools/node_modules node tools/qa_car_geometry.cjs --driving
# 启动本地服务后：
NODE_PATH=/workspace/.littleexplorer-tools/node_modules LE_QA_URL=http://127.0.0.1:19766 node tools/qa_car_driving.cjs
NODE_PATH=/workspace/.littleexplorer-tools/node_modules LE_QA_URL=http://127.0.0.1:19766 node tools/qa_car_cockpit.cjs
```

`qa_car_driving.cjs --baseline` 从固定基线 commit 读取汽车模块与公共引擎，保存 V0.2 截图，无需 checkout；`--skip-capture` 仅复用已保存截图，交互和音频仍实测。
输出目录默认在仓库外：`/workspace/LittleExplorer-artifacts/v03-driving`。
对比截图固定 1100×820、同一相机、P 档、停止、无雨、灯光关闭。固定相机仅用于截图；交互使用正常驾驶视角。
音频通过 AudioWorklet 采集原生 AudioContext 输出，同时保留真实 destination 播放，验证幅度、频谱、时长与静音。
仅讲解语音被测试替身抑制，喇叭、渲染时钟、射线、点按和声音节点不替换。

人工路径：进入驾驶舱 → 点中心喇叭 → 灯光/双闪 → 左右箭头与杆身 → 右侧雨刮 → 启动 P → D → 刹车 → 停止 → 透视/拆开/装回。
请检查声音是否舒适、图标是否容易发现、握持手机时是否容易误点。
数字音频输出测试不能替代真实扬声器听感；HarmonyOS 实机、触控手感与手机 GPU 性能仍需人工验收。
