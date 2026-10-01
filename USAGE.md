# 智能体桌面插件使用说明

`dsh-agent-desktop` 0.1.0，针对 DSH 0.1.7-rc.2 和 Ubuntu 24.04 amd64 验证。

## 这是什么

插件为每个 DSH 会话建立自己的 Xvfb 显示、Openbox 窗口管理器、最小 D-Bus 和后台应用进程。应用仍是本机已安装的软件；源码、Conda/Node 等开发环境继续来自宿主，不需要 VM 或容器。

它不是权限沙箱。同一用户的文件、网络、GPU 和其他资源仍共享。应用启动的图形路由被固定到私有显示，但拥有任意 shell 权限的程序并不被该插件隔离。

本版使用 **私有 stdio 控制 + PNG 画面，上限 2 帧/秒**。Selkies 2.0 的原生串流已做独立 PoC，但不是本版正在使用的监控/输入后端；不启用它的未认证 Computer-Use HTTP 监听器。

## GUI 入口

插件装入当前 DSH Web profile，不另起替代 DSH 服务。入口是右侧栏的 **“开始”页 → 智能体桌面**；已有标签时可通过加号打开开始页。若页面在安装前已打开，刷新当前 DSH URL。详见 [验收范围](<docs/validation.md>)。

## 在其他安装位置准备运行时

1. 使用正常桌面用户，不要使用 root。
2. 本机需要已有 `/usr/bin/python3` 3.12、venv、xterm、D-Bus、xauth、XKB/font 支撑与相应系统动态库。设置脚本会检查并在缺失时明确停止，不会自动执行 sudo。
3. 在解包后的插件根目录运行：

```bash
bash scripts/setup-native.sh --prepare-only
# 检查 .runtime/native/audit 和 .runtime/wheels-audit 的包/依赖清单
bash scripts/setup-native.sh --offline
```

脚本只下载校验过的 Ubuntu 包并解压到插件自己的 `.runtime`，不执行系统包维护脚本、不修改系统 Xorg/GDM/驱动；Python 支撑库装到插件自己的小型 venv。这份 venv 只是截图/输入适配器的依赖，不取代业务应用使用的 Conda/Node 环境。

不要在桌面会话运行时重新执行设置脚本，避免覆盖正在使用的原生组件。

### 安装 DSH 插件

对于源码目录或解压目录：

```bash
dsh plugin --profile web add /absolute/path/to/dsh-agent-desktop
```

Git 仓库和预构建 tgz 均包含 `lib` 入口，普通安装不需要开发依赖，也没有自动运行的 prepare/install 脚本。修改源码的开发者使用固定版本的公开 npm 依赖：`pnpm install --frozen-lockfile`，再执行 `pnpm run check`。无需相邻的 DSH 源码仓库。

没有全局 `dsh` 时，使用当前 DSH checkout 的标准启动方式，并从该 checkout 执行，避免 TypeScript alias 解析到不同版本：

```bash
pnpm dsh plugin --profile web add /absolute/path/to/dsh-agent-desktop
```

要卸载：

```bash
dsh plugin --profile web remove dsh-agent-desktop
```

先保存所有 AI 桌面内的工作，再卸载、更新 Host 插件或重启 DSH。

### 直接安装 Git 或 tarball

推荐本地 clone + link，运行时位置清楚且便于升级。也可以使用预构建 Git 包；生产安装建议把 `<commit>` 换成已审阅的完整提交号：

```bash
dsh plugin --profile web add 'github:VectorWang2015/dsh-agent-desktop#<commit>' --ignore-scripts
# 或安装自己构建、校验过的 tarball
dsh plugin --profile web add /absolute/path/to/dsh-agent-desktop-0.1.0.tgz
```

Git 直装请保留 `--ignore-scripts`：pnpm 可能因为包中有开发用 `build` 命令而把 Git 包标记为需要构建，即使没有 prepare 钩子。这里已随 Git 提供构建产物，不需要授权该步骤。固定提交的 GitHub 包已用此方式验证入口和 locale 导出。

直接安装后仍需在实际包目录运行设置脚本。默认 Web profile 的包目录通常为 `$DSH_HOME/profiles/web/node_modules/dsh-agent-desktop`（默认 DSH_HOME 是用户 `.dsh` 目录）；使用自定义 Home/Profile 时替换为实际路径。安装期不自动拉取 Xvfb、下载 Python wheels 或启动桌面。

另一种方式是在稳定的 checkout 准备运行时，再通过下方 `runtimeRoot` 配置让已安装插件引用它。不要复制 venv 或手改 Xauthority。包声明不代表已经发布到 npm registry；本项目当前提供 Git/目录/tarball 安装。

## 侧边栏

1. 在目标 DSH 会话的右侧栏添加 **智能体桌面**。
2. 点击 **启动桌面**。默认启动一个本机 xterm；没有新窗口出现在用户物理桌面上。
3. 画面默认只读，点击预览不会抢输入权。侧栏尺寸变化只缩放预览，不改变远端分辨率。
4. **暂停输入**：使 AI 和人工输入失效，但保留应用。
5. **人工接管**：服务器撤销旧输入、释放按键，授予本页独有控制令牌。等待新画面确认后，点击预览聚焦，才能操作键鼠。
6. 中文/输入法使用下面的人工文本框，组合输入结束后点击发送。浏览器保留的快捷键可能仍由浏览器处理。
7. **Shift+Escape**、失焦或隐藏页面会释放本页接管。断线时服务器默认约 10 秒后撤销人工输入权。
8. **释放接管**后保持暂停，不会自动让 AI 继续；点击 **恢复智能体**才交还输入。
9. **停止桌面**会关闭其中全部应用，必须确认未保存内容的风险。

关闭侧栏、切换 DSH 会话或断开预览不会停止桌面。**卸载/重载 Host 插件和退出 DSH 会停止其拥有的桌面**；原生 worker 故障或超时也会 fail-closed 回收 owned 进程，避免迟到输入，而不是降级操作用户桌面。请及时保存工作；0.1 不提供跨 Host 重启或崩溃的桌面恢复。

## AI 工具

- `desktop_start`：启动本会话独立桌面；已有暂停/人工桌面不会因此恢复。
- `desktop_status`：查看状态和当前 epoch。
- `desktop_screenshot`：返回实际图像 attachment、尺寸和 epoch；无需有人打开预览。
- `desktop_action`：一次有界的移动、点击、按键、滚轮或文本；必须使用最新 epoch。
- `desktop_launch`：用 executable + argv 启动本机软件，可指定已有项目目录和所需开发环境变量。
- `desktop_stop`：只停止本会话桌面，要求明确确认，且不能在人工接管或暂停状态下由 AI 强行停止。

启动、输入、启动应用和停止这些 Host 原生写操作要求当前 DSH 会话为 `danger-full-access`。插件不会自动请求或绕过权限提升。截图要求当前模型声明图像输入能力。

截图如果被 DSH attachment 层缩小，工具返回 `coordinates.multiplyImageXBy/multiplyImageYBy`；点击坐标必须换算回原桌面像素。绿色小光标是私有画面上的指针标记，不是用户的物理鼠标。

## 应用与开发环境

- 同一软件可执行文件、解释器、项目与模型数据可以直接复用；通常需要在 AI 桌面新启动该软件，不能一般化地搬走既有窗口。
- `desktop_launch` 的 `env` 允许开发环境变量，但禁止覆盖 DISPLAY、XAUTHORITY、D-Bus/runtime、LD_PRELOAD 等图形路由字段。
- 显式环境参数只用于子应用；不把含有 API key/token/password 等名称的 Host 环境变量自动转发给应用。
- 浏览器、VS Code 等单实例程序使用**独立 UI profile/新实例参数**，避免把请求送回用户当前窗口。共享一个正在使用的 Chrome profile 不受支持。
- 初始 xterm 会运行本机 shell；如果 shell 初始化脚本自行覆盖 DISPLAY 或连接其他图形会话，需要先修正该应用启动配方。
- 默认 D-Bus 没有宿主桌面服务自动激活目录，避免悄悄启动 keyring、portal、通知/音频守护程序。依赖这些服务的软件可能报告 ServiceUnknown；不自动回退到用户 bus。
- VS Code 烟测的 `--password-store=basic` 仅用于隔离测试 profile，**没有系统 keyring 的凭据静态保护**。不要把它当所有应用的默认安全策略，也不要在烟测 profile 登录重要账号。

### 文本与 Unicode 边界

文本不是通过宿主剪贴板同步输入。已有键位直接使用 XTEST；缺少的 Unicode 字符分配私有 X server 的空闲键位并保持到该显示结束，以保证忙碌应用稍后处理按键时仍能解码。

X11 键位数量有限。新增不同字符超过剩余槽位时，整次文本请求在发送文字前明确失败，不会静默丢字。大量多语言文本优先通过文件编辑/应用导入，而不是模拟数千个键位；需要更多字符时可在保存工作后重新启动桌面。组合字、特定 IME 和特殊工具包需要逐应用验证。

## 配置

插件 Config 支持：

| 字段 | 默认 | 含义 |
|---|---|---|
| `runtimeRoot` | 插件根的 `.runtime` | 包含 `native.json` 的用户级运行时目录 |
| `stateRoot` | 用户 `.local/state/dsh-agent-desktop` | 私有会话日志/authority/runtime 根 |
| `width` / `height` | 1280 / 800 | 固定桌面像素；允许 320–2560 / 240–1600 |
| `maxSessions` | 2 | 同时活跃或尚未清理完的桌面上限，最大 4 |
| `humanLeaseMs` | 10000 | 人工控制断线超时，3–60 秒 |
| `frameCacheMs` | 300 | 短暂帧缓存，100–2000 ms |
| `startTerminal` | true | 启动后打开初始本机 xterm |

当前没有自动生成的 GUI 设置页。通过用户 profile 的 `cordis.patch.yml` 按插件 id 覆写 Config，例如：

```yaml
- id: agent-desktop
  config:
    runtimeRoot: /absolute/path/to/dsh-agent-desktop/.runtime
    width: 1280
    height: 800
    maxSessions: 2
```

DSH patch 对 `config` 是整体替换，不是深合并；未指定字段由 Config schema 填默认值。配置修改可能热重载 Host 插件并关闭其 owned 应用，修改前先保存。

不要给模型输入一个任意宿主 DISPLAY，也不要用 `xhost +`、Xvfb `-ac` 或全局 uinput/ydotool 绕过控制权。

## 当前限制

- Linux/Ubuntu 24.04 amd64、X11 原生应用为验证范围；不是 Windows/macOS 通用双桌面方案。
- 低帧率 PNG 监控适合办公/开发验证，不是 60 FPS 远程桌面产品。
- 默认软件图形路径。已验证本机 VS Code 在独立 UI profile 中打开、截图、编辑和保存中文；NVIDIA CUDA 计算环境可复用不等于 GUI OpenGL/Vulkan/NVENC 已加速，RViz/Gazebo/Blender 尚需专项实测。
- 应用启动记录不是完整的进程/窗口生命周期管理器。
- 日志保留在私有 stateRoot；应用可能向其自身日志写入敏感内容。停止后再按需清理，避免删除运行中的 authority/socket。
- 不提供剪贴板、音频、摄像头、gamepad 转发。程序如果绕过配置直接访问共享硬件，仍是同 UID 权限下的宿主程序。
- Host 认证与控制令牌保护正常插件入口，不能约束同 UID 的任意恶意代码。
