# DSH Agent Desktop

Host-native background graphical sessions for AI, with a DSH sidebar monitor and explicit human takeover.

**智能体使用独立桌面，软件和开发环境仍在原宿主上。** 不需要虚拟机或容器，也不承诺安全沙箱。

- **插件版本**：0.1.0
- **已验证 DSH**：0.1.7-rc.2，暂不放宽到未测试版本
- **运行环境**：Ubuntu 24.04 amd64、系统 Python 3.12；侧栏目前为中文 UI
- **监控方式**：PNG 预览，最高 2 FPS；不是高帧率远程桌面产品

## 功能

- 每个 DSH 会话独立的 Xvfb、Openbox、最小 D-Bus 和应用进程。
- 复用本机已有程序、Python/Conda/Node 等环境与项目文件。
- 官方右侧栏 **智能体桌面**：默认只读、启动、暂停、恢复、人工接管、释放、确认停止。
- `desktop_start`、`desktop_status`、`desktop_screenshot`、`desktop_action`、`desktop_launch`、`desktop_stop` 六个工具。
- 无人观看时仍能截图/输入；关闭侧栏不停止应用。
- DSH 认证、会话权限、输入 epoch、人工控制令牌和断线租约共同保护正常控制通道。
- 只管理自己的子进程，不修改 GDM/Xorg、显卡驱动或已有虚拟机。

Selkies 2.0 的原生串流已经做过独立概念验证，但 **不是 0.1 后端**。本版不启用它独立且未认证的 Computer-Use HTTP 接口。

## 安装：推荐克隆后本地链接

先安装 DSH 0.1.7-rc.2，并使用其正常 Web profile。Node 版本需满足 `^22.19.0 || >=24.0.0`。

```bash
git clone https://github.com/VectorWang2015/dsh-agent-desktop.git
cd dsh-agent-desktop

# 仅在最终安装位置准备本插件的图形支撑组件；不重建业务开发环境
bash scripts/setup-native.sh --prepare-only
# 检查 .runtime/native/audit 与 .runtime/wheels-audit
bash scripts/setup-native.sh --offline

dsh plugin --profile web add "$PWD"
```

仓库包含复核后的 [Host bundle](<lib/index.js>)、[Client bundle](<lib/client.js>) 和 [CSS](<lib/client.css>)；普通用户不必执行 `pnpm install` 或安装期 `prepare`。如果不用本地 clone 而直接安装 Git URL，请按 [USAGE](<USAGE.md>) 添加 `--ignore-scripts`，避免 pnpm 将开发用 build 当成安装步骤。原生设置仍需显式执行；首次 `--offline` 前必须准备下载缓存。

设置脚本限定 Ubuntu 24.04 amd64，要求已有系统 Python 3.12/venv、xterm、D-Bus、xauth 等基础库，使用固定包版本和 SHA256。缺少先决条件或仓库不再提供固定版本时会报错，不自动 sudo、升级驱动或绕过哈希。运行时含绝对路径，**不要复制其他机器的 `.runtime`**。

安装后刷新原 DSH 页面，进入 **右侧栏 → 开始页 → 智能体桌面**。没有全局 `dsh` 时，可从 DSH checkout 使用其规范 `pnpm dsh ...` 启动方式。

完整的 Git/tarball 安装、配置和卸载说明见 [USAGE](<USAGE.md>)。

## 给新 agent 试用

新建以本项目为工作区的 DSH 会话，选择支持图像输入的模型，并由用户明确选择 **完全权限**。复制 [示例任务](<examples/first-task.zh.md>)；它通过原宿主 xterm/Python 运行一个标准库演示，必须真正接收 GUI 输入后才生成合成 CSV 和结果回执。

没有登录操作，不读取真实文档/凭据，不安装应用，也不连接物理桌面。示例包含保存结果后停止本次新建桌面的明确授权。

## 开发

开发依赖使用公开的固定版本，**不依赖相邻 DSH monorepo checkout**。

```bash
pnpm install --frozen-lockfile
pnpm run check

# 可选：会启动独立测试桌面，需要先 setup-native
pnpm run test:smoke
# 可选：还需要本机 /usr/bin/code；包含版本相关的首次启动界面操作
pnpm run test:ide
```

提交前重新构建，并同时提交源码与三个预构建文件。`pnpm package:check` 检查发布白名单、入口、元数据和依赖可移植性。源码、测试和锁文件留在 Git；运行包不带研究原稿、图形运行时、账户信息、会话记录或测试截图。构建产物不含 source map。

## 限制与安全

- **不是权限沙箱**：应用使用同一 UID，文件、网络和 GPU 等资源共享。
- 复用已安装程序不等于迁移已有窗口；浏览器/IDE 等单实例应用通常需要独立 UI profile。
- 默认软件渲染；不承诺 NVIDIA OpenGL/Vulkan/NVENC 或全部 GUI 软件兼容。
- Unicode 使用私有 X11 的有限键位；容量不足会明确拒绝，大文本应使用文件导入。
- 默认无宿主 portal/keyring 自动激活，也不转发剪贴板、音频、摄像头或 gamepad。
- 停止、Host 插件重载或 DSH 退出会关闭 owned 应用；**不提供跨重启恢复**。请先保存工作。

## 文档

- [使用与配置](<USAGE.md>)
- [架构和生命周期](<docs/architecture.md>)
- [DSH 规范核对](<docs/plugin-compliance.md>)
- [测试与实测范围](<docs/validation.md>)
- [示例任务](<examples/first-task.zh.md>)
- [第三方声明](<THIRD_PARTY_NOTICES.md>)、[MIT 许可证](<LICENSE>)
