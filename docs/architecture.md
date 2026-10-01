# 架构与生命周期

## 层次

```text
DSH Session
  ├─ desktop_* tools ──┐
  └─ 正式右侧栏 ────────┤ DSH auth / session permission / ownership capability
                       ▼
                 DesktopBroker
                 epoch + 单写者 + 有界队列 + human lease
                       ▼
                 NativeBackend
                 DSH managed subprocess / JSON stdio
                       ▼
                 Python worker
                 private Xvfb + Xauthority + Openbox + minimal D-Bus
                       ▼
                 原宿主安装的软件与开发环境
```

画面由 worker 原子写入私有 PNG 文件，Host 仅读取自己创建的固定路径，检查非符号链接、常规文件、尺寸和 PNG 头。stdio 只承载小型元数据，避免将大图像嵌入控制协议。浏览器通过已经过 DSH 认证的 frame endpoint 取得 PNG，最高约 2 FPS；模型通过工具结果得到持久 attachment。

## 观察与安全输入

模型截图默认重新采集；UI 可以短缓存，每次捕获有 frameId 与真实捕获时间。裁剪仍保留绝对桌面 origin，attachment 缩小时需同时应用偏移与比例。probe 是另一份原始合成 RGB 捕获，不绘制合成指针，不承诺源文件/图层或语义正确性。

普通按键使用原子 press，修复把 Down 误当完整按键的风险。高级 raw agent holds 关闭该私有键位的 repeat 并受截止时间约束，抬起时恢复原设置；human 输入不施加该截止时间。所有权变更/取消仍会释放按住输入。若释放不能确认，只回收本 owned backend 而不保留可用输入租约。

独立 inspect 更新真实启动进程的 poll 结果及当前窗口/焦点；不把窗口存在与否等同于进程存活。focus 只请求正常 EWMH 激活，close 只发送 WM_DELETE_WINDOW，既不越过模态关系，也不强杀应用。

## 三种独立寿命

- **DSH 会话**选择图形会话绑定；不根据“当前活动浏览器标签”选择输入目标。
- **图形会话**由 Host broker 持有，不随一次工具调用结束或预览隐藏而关闭。
- **观看页面**只持有观察状态和短期人工输入能力。关闭/隐藏页面释放该页面控制，不等于停止应用。

本版不恢复跨 Host 重启的图形进程；插件卸载、Host 重载或明确 stop 会清理 owned 应用。故障路径可能关闭应用以阻止迟到输入，未保存工作可能丢失。

## 输入所有权

同一图形会话只有 agent、human、none 三种输入所有权。控制变更立即增加 epoch、禁止旧调用，取消/排空在途操作并释放按住的键或按钮，然后才授予新控制者。

人工接管只向取得控制的页面返回随机令牌；公开 status 不包含令牌。human input、续租和 release 都要求当前 epoch 与令牌。另一个已登录观察者仅知道 epoch 也不能写输入。页面失焦、隐藏或断连撤销本页能力；Host lease 为异常断线提供超时回收。释放后保持 none，用户明确恢复后才变为 agent。

同 UID 的任意 shell 进程仍可能直接连接显示服务器。broker 是正常插件路径的可靠性和授权机制，不是防恶意代码的 OS 沙箱。

## 隔离与复用

- Xvfb、authority、runtime、D-Bus 和窗口焦点独立；不回退宿主 DISPLAY，不创建 kernel uinput 设备。
- 应用二进制、文件、解释器、库、端口和 GPU 仍共享。
- 默认 D-Bus 不读取标准自动激活服务目录，避免应用探测时启动宿主 portal/keyring/音频服务；相关功能可能不可用。
- 浏览器和 IDE 等单实例软件可能需要独立 UI profile；这不要求重新安装开发环境。
- Unicode 缺省键位保持到本显示结束，避免迟处理事件失去含义；键位不足则整次文本预检拒绝，不自动复用映射。

## 进程清理

worker 是 Linux child subreaper，收养双重 fork 或 detached 后代。清理只枚举当前直接子进程，通过 pidfd 固定任务并校验 PPID 后发信号；不按进程名杀软件，不向记忆中的裸 PID/PGID 盲发信号。Host 同时保留 DSH managed subprocess range，清理失败时拒绝覆盖旧 backend。

## 源码位置

- [Host 入口与 HTTP](<../src/index.ts>)
- [输入与会话 broker](<../src/broker.ts>)
- [原生进程适配](<../src/native-backend.ts>)
- [Python worker](<../runtime/desktop_worker.py>)
- [侧栏入口](<../src/client/index.ts>)、[客户端控制器](<../src/client/DesktopController.ts>)
