# 测试与实测范围

## 0.2.1 兼容性验证

兼容目标为 DSH **0.2.0-rc.2**，DSH peer/development/engine 均精确锁定此版本，Cordis 保持 `4.0.4`。在不接触 live profile 的独立 Git clone 中安装依赖、执行 Host/Client typecheck、118 个 JS/组件/HTTP/broker/权限测试、6 个标准库 Python 测试以及 55 个 worker mock/清理测试；构建与 package check 通过。原生 GUI 测试明确跳过，本次没有启动显示、驱动实际桌面或停止任何 live worker。

公开 registry 的固定版本安装/类型与测试检查通过；另将独立副本的开发依赖临时指向新 DSH checkout 的构建产物，Host/Client typecheck 及全部 118 个 JS 测试也通过，交付 manifest/lockfile 不含本机 link。兼容核对涵盖 tools、session、subprocess、sandboxPolicy、attachment、Connection admission、webServer 路由、sidebarRightTabs/slots 及 browser module-table 入口。新增 16 个真实 Cordis 注册测试使用窄服务替身，验证两个受限权限拒绝全部六类写操作、每次调用读取当前 session policy、只读状态不启动 worker，以及缺少 cwd/取消时的拒绝。Host/Client 生产源码与 Python worker 未改，重新构建的三个 lib 文件与 0.2.0 字节一致；原有 owner/epoch、人控令牌/租约、原子按键与有界 hold 逻辑保持不变。

以下 GUI 实测属于旧 DSH 基线，不应读作 DSH 0.2.0-rc.2 的新 GUI 验收；升级后的真实 profile/浏览器验收须在用户保存工作并完成受控切换后单独进行。

## 原生 GUI 实测环境（历史基线）

DSH 0.1.7-rc.2、Ubuntu 24.04 amd64、系统 Python 3.12、X11 用户桌面。图形基线为软件渲染，不以宿主 NVIDIA/CUDA 可见推断 GUI 或编码硬件加速。

## 实施阶段验证

- 91 个 JavaScript/React/HTTP/控制器测试及 3 个 Python 清理测试通过。
- 4 个显式原生 GUI 测试通过：无 viewer 截图与终端输入、延迟接收连续 Unicode、detached 后代回收，以及本机 VS Code 文档编辑/保存。
- 真实 DSH 六个 desktop_* 工具通过；模型收到实际图像 attachment，私有终端复用了现有 Miniforge Python。
- 已认证的原 DSH 页面验证了正式侧栏入口、中文控件、只读 PNG、人工鼠标/键盘/中文文本输入、无令牌 403、释放/暂停/恢复、隐藏后继续运行和确认停止。
- 测试完成后所有 owned 演示桌面停止；未修改显卡驱动、GDM/Xorg 或既有 KVM。

公开仓库保留测试源码和脱敏结论，不上传原用户桌面截图、主机路径、会话记录或实际进程回执。安装者应在自己环境中重跑；上述实测不是其他操作系统或任意 GUI 软件的兼容承诺。

## 0.2 反馈回归

- 常规检查目前为 102 个 JS/组件/HTTP/broker 测试、6 个标准库 Python 测试；另有 55 个 worker mock/清理测试（需要测试用 Pillow/python-xlib，不启动显示）。
- 4 个原生回归覆盖：无 viewer、Unicode 延迟接收、detached 回收，以及新功能完整 Node→worker 链。新回归实际使用 1600×1000，验证原子按键、agent 无连发/超时释放、human 正常重复、Ctrl+S、窗口焦点、退出码、拒绝关闭的窗口仍存在，以及裁剪和 RGBA。
- 私有已知色窗口的原始采样为 `[18,52,86,255]`，即使合成指针停在该点也不污染 probe；裁剪图的 pointer=true/false 确实不同。
- 旧版有界基线复现：Return 按住 1.5s 产生约 22 次激活；新版 1.7s agent hold 只有 1 次且自动释放，human 同时长仍正常重复。
- GTK 新建/失焦/modal 对话框 25/25 首击成功；GIMP 2.10.36 简单 Script-Fu 求值、Browse 首击与礼貌关闭可用，原反馈的持久输入冻结未复现。记录到的短暂 grab 不等于全部问题的根因；详见 [常见坑](<gui-pitfalls.md>)。
- Worker stdin 已改为可停止的 raw reader，失败启动/停止 5 轮正常退出，不再复现旧 buffered-reader 终结 abort。

这些 native 测试只操作新建的私有显示和合成内容，结束时回收 owned 进程；不读取或驱动物理桌面。

## 常规检查

```bash
pnpm install --frozen-lockfile
pnpm run check
```

默认测试不会启动桌面；原生烟测为 opt-in。Vitest 只发现测试目录，忽略研究工件中的历史副本。Worker mock 使用已准备 runtime 时可执行 `pnpm test:worker`；CI 单独创建 Python venv，用 [锁定测试依赖](<../tests/requirements-worker.txt>) 安装纯测试依赖，再运行 worker mocks，不下载/启动 Xvfb。公开演示程序另有 3 项无 GUI 的标准库测试，确认有效 marker 输出、错误 marker 不写入、已存在目录不覆盖。

```bash
# 需要先完成 native setup
pnpm run test:smoke
# 还需 /usr/bin/code；受安装版本的窗口标题和首启界面影响
pnpm run test:ide
```

IDE 烟测使用单独 UI profile、禁用扩展并明确设置 password-store=basic，仅用于无账号测试；该选项没有系统 keyring 的静态凭据保护，不应成为一般应用的默认策略。

## 发布检查

[包检查脚本](<../scripts/check-package.mjs>) 验证官方清单位置、入口/locale/icon、明确载荷白名单、没有 install/prepare 钩子、没有邻仓 link:、构建文件不含 source map 引用、公共文件没有主机特定路径或显式凭据。

Git 包含三个预构建文件；推荐目录安装，Git 直装使用 `--ignore-scripts`，无需构建许可。开发检查使用 registry 固定版本和 lockfile：已经在与项目不相邻的干净临时目录完成安装、全部常规检查，并比对三个构建文件逐字节一致。固定提交的 GitHub 生产安装也已在另一临时目录验证：未运行安装脚本，Host 可导入、locale 可解析，未夹带原生运行时。本机相邻 checkout 不作为隐含依赖。

## 尚未承诺的范围

- Windows/macOS 或所有 Linux 发行版。
- GPU OpenGL/Vulkan/NVENC、RViz/Gazebo/Blender 和任意工具包/IME。
- 跨 DSH Host 重启恢复或防恶意同 UID 程序。
- 全部常用应用共用 UI profile 并行，以及任意既有窗口迁移。
- 高帧率串流；Selkies 2.0 仅完成独立 PoC，尚未接入实际控制链。

[示例任务](<../examples/first-task.zh.md>) 是新 agent 的推荐试用路径，比直接运行版本相关的 IDE 烟测更合适。
