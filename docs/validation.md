# 测试与实测范围

## 已验证环境

DSH 0.1.7-rc.2、Ubuntu 24.04 amd64、系统 Python 3.12、X11 用户桌面。图形基线为软件渲染，不以宿主 NVIDIA/CUDA 可见推断 GUI 或编码硬件加速。

## 实施阶段验证

- 91 个 JavaScript/React/HTTP/控制器测试及 3 个 Python 清理测试通过。
- 4 个显式原生 GUI 测试通过：无 viewer 截图与终端输入、延迟接收连续 Unicode、detached 后代回收，以及本机 VS Code 文档编辑/保存。
- 真实 DSH 六个 desktop_* 工具通过；模型收到实际图像 attachment，私有终端复用了现有 Miniforge Python。
- 已认证的原 DSH 页面验证了正式侧栏入口、中文控件、只读 PNG、人工鼠标/键盘/中文文本输入、无令牌 403、释放/暂停/恢复、隐藏后继续运行和确认停止。
- 测试完成后所有 owned 演示桌面停止；未修改显卡驱动、GDM/Xorg 或既有 KVM。

公开仓库保留测试源码和脱敏结论，不上传原用户桌面截图、主机路径、会话记录或实际进程回执。安装者应在自己环境中重跑；上述实测不是其他操作系统或任意 GUI 软件的兼容承诺。

## 常规检查

```bash
pnpm install --frozen-lockfile
pnpm run check
```

默认测试不会启动桌面；原生烟测为 opt-in。公开演示程序另有 3 项无 GUI 的标准库测试，确认有效 marker 输出、错误 marker 不写入、已存在目录不覆盖。

```bash
# 需要先完成 native setup
pnpm run test:smoke
# 还需 /usr/bin/code；受安装版本的窗口标题和首启界面影响
pnpm run test:ide
```

IDE 烟测使用单独 UI profile、禁用扩展并明确设置 password-store=basic，仅用于无账号测试；该选项没有系统 keyring 的静态凭据保护，不应成为一般应用的默认策略。

## 发布检查

[包检查脚本](<../scripts/check-package.mjs>) 验证官方清单位置、入口/locale/icon、明确载荷白名单、没有 install/prepare 钩子、没有邻仓 link:、构建文件不含 source map 引用、公共文件没有主机特定路径或显式凭据。

Git 包含三个预构建文件；普通安装无需构建许可。开发检查使用 registry 固定版本和 lockfile，并在干净目录验证构建/包安装，不通过本机相邻 checkout 的偶然类型解析宣称可移植。

## 尚未承诺的范围

- Windows/macOS 或所有 Linux 发行版。
- GPU OpenGL/Vulkan/NVENC、RViz/Gazebo/Blender 和任意工具包/IME。
- 跨 DSH Host 重启恢复或防恶意同 UID 程序。
- 全部常用应用共用 UI profile 并行，以及任意既有窗口迁移。
- 高帧率串流；Selkies 2.0 仅完成独立 PoC，没有接入 0.1 的实际控制链。

[示例任务](<../examples/first-task.zh.md>) 是新 agent 的推荐试用路径，比直接运行版本相关的 IDE 烟测更合适。
