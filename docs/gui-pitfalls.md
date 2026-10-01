# AI 驱动 GUI 的常见坑

## 1. 一次按键不等于按住

普通按键和快捷键使用原子 `press`，一次调用内完成按下、抬起；不把两个事件拆到两轮模型推理中：

```json
{"type":"press","key":"Enter"}
{"type":"press","key":"s","modifiers":["Control"]}
```

为兼容简单调用，`{"type":"key","key":"Enter"}` 省略 down 时也表示 press。**显式 `down:true` 仍然表示按住，不是一次击键。** 需要立即配对 down:false；不要等待 0.9 秒再抬起。旧版在 Linux 默认重复延迟后已经会连发。

0.2 对 agent 的原始按住额外实施两道保护：只在本私有显示上关闭该键的自动重复，且默认 1500ms 后释放；对应设置在 release 后恢复。重复发送相同 down 不会延长这个期限。人工接管的键盘保持正常重复行为，由人工租约管理。高级自动化如需按住，应在同一短脚本内配对，不依赖长时间 raw hold。

`{"type":"release"}` 释放本 worker 记录的按键/鼠标键，不抢控制权，也不强行清除其他客户端的 grab。若输入失败且释放无法确认，会禁用输入并回收这个 owned backend；这可能关闭未保存应用，避免失控按键继续作用。

## 2. 文本中的控制字符会执行动作

```json
{"type":"text","text":"DSH_DESKTOP_OK 中文✓\n"}
```

这会输入文字并执行**一次完整的 Enter**，适合演示程序或单条终端命令；不是宿主剪贴板粘贴。`\n` 和 `\r` 各自映射为 Enter，`\t` 映射为 Tab，每个都成对按下/抬起。因此不要无意发送 CRLF（会产生两次 Enter），也不要把含换行的文本发给不应提交的对话框。其他受禁止的控制字符会报错。

## 3. 点不动不一定是第一击被吃掉

先获取 `desktop_windows`，检查：当前输入焦点、active 顶层窗口、modal/transient 关系、本通道仍按住的键/鼠标键。raw X 焦点可以是控件子窗口，不必等于顶层窗口 id。

需要激活时用 `desktop_focus(epoch, windowId)` 请求正常 WM 激活，或先单击目标标题栏，再观察新截图、单击控件。工具返回 `requested` 与 `confirmed`，WM 可以拒绝或把焦点保留给模态对话框。`focusable` 仅是 ICCCM hint，不是“没有 grab”的证明。

**不要自动双击补偿，不要反复盲按 Enter/Escape，不要使用强制 ungrab 或另一个 DISPLAY 绕过。** Hover 高亮只说明某些指针事件到了，不证明键盘/按钮路径正常，更不能单凭它判定 grab。

针对本次反馈的有界基线实验：新建/失焦/modal GTK 对话框共 25/25 首击成功，Openbox 有正常 ReplayPointer；GIMP 2.10.36 的简单 Script-Fu 连续求值和 Browse 首击成功。观察到真实的短暂键盘 grab，随后在 Return 释放后由 GIMP 自行解开；**未复现原反馈的持久失去输入**。原始脚本、历史和更长序列仍需最小复现，不能把键盘修复等同于已解决所有 GIMP 输入问题。

## 4. 启动进程、窗口和文档是不同对象

`applications[].running` 由持有的 Popen 进程句柄刷新，表示**原始启动进程是否仍活着**，并给出 exitCode/observedAt。不是 `PID 存活 AND 有窗口`：

- 无窗口的后台脚本也可能活着。
- 包装进程退出后，GUI 子进程可以继续存在。
- 一个 GIMP 进程可以包含多张图像；应用内标签/图层不是 X11 顶层窗口。

状态工具和侧栏定期刷新。最近退出记录保留最多 32 条，以便定位失败，不在退出时静默抹掉证据。窗口的 PID 是客户端声明的匹配线索，不是整个应用家族的可信身份或终止权限。

清理时先保存需要的文件，再刷新窗口列表。`desktop_close_window` 必须 confirm=true，只向指定当前窗口发送 WM_DELETE_WINDOW；应用可以拒绝、显示保存提示，或按自己的逻辑关闭多个文档。返回 `requested:true` **不表示已经关闭**，应重新观察。窗口 id 可能快速复用，不要使用旧列表。没有 XKillClient、强杀/全关应用或自动丢弃回退。

如果需要关掉 GIMP 内部图像/标签，应使用应用自己的关闭/保存功能；不能拿整个进程当一张草稿。明确授权停止整个本会话桌面时才用 desktop_stop。

## 5. 相同图片不等于没有重新截图

模型的 `desktop_screenshot` 默认 fresh=true，绕过短缓存；返回 frame.id、capturedAt、cached。fresh=false 明确允许复用，侧栏仍保留低帧率缓存。静态画面即使重新采集，PNG hash 仍然可能相同。

fresh 也不等于“应用已经完成异步操作”：等待可见状态并再次观察，不用固定长 sleep 或图片 hash 单独断言操作成功。

## 6. 裁剪与像素是补充证据

`desktop_screenshot(region={x,y,width,height}, cursor=false)` 可以读取局部细节。区域使用完整桌面的绝对像素；模型 attachment 如有缩小，点击换算为：

```text
desktopX = offsetX + imageX * multiplyImageXBy
desktopY = offsetY + imageY * multiplyImageYBy
```

`desktop_probe(epoch, points=[{x,y}, ...])` 在一次新采集中读取 1–32 个点，返回 RGBA 与独立的 frameId/capturedAt，不包含绿色合成指针。它不是先前截图的同一帧，也不是 GIMP 图像坐标或某个图层的像素。

这些是 X11 桌面合成后的 8-bit RGB（alpha 为 255），不保证源图像的色彩空间/透明度语义。应用缩放、平移、遮挡、抗锯齿都会影响结果；验证源文件应读导出的图像或应用采样器。数值检查可以发现预期肤色实际是背景色，但**不能保证“画面语义正确”**，仍需局部截图、参考目标和多点/文件验证。

## 7. 分辨率、cwd 与权限

绘图/IDE 可在启动**新桌面**时指定 `desktop_start(width=1600,height=1000)`。宽高必须成对，在允许范围内；不自动调整已有桌面。首次默认保持 1280×800，本会话停止后未指定尺寸的重启沿用最近尺寸。

应用的实际工作目录就是 launch.cwd（省略时使用会话工作目录）。GIMP 的相对保存路径、Python open() 等都按它解析；优先用本任务明确的输出绝对路径。

写操作被拒时，请由用户在当前会话的权限/访问模式菜单中选择“完全权限”。暂停/人工所有权不是权限不足：即使完全权限也不能绕过，必须由用户明确恢复。
