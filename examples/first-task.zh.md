# 新 agent 的安全试用任务

前置条件：插件和 native runtime 已安装；以本仓库为工作区创建新 DSH 会话，选择图像模型，由用户明确选择“完全权限”。不应靠试用任务自动提升权限或安装系统组件。

以下内容可直接复制：

> 请用已安装的 `dsh-agent-desktop` 完成一次独立桌面试用，目标是证明“真正经 GUI 输入、复用本机 Python、生成并验证合成结果”，而不是只在 shell 中生成结果。
>
> 1. 先读取本项目的 [使用说明](<../USAGE.md>) 和 [演示程序](<desktop-demo.py>)。确认当前工作目录以及本机已有 xterm、Python 的绝对路径、版本。只读取这些必要信息，不读取凭据、浏览器 profile 或完整环境变量；缺少依赖就报告，不安装。
> 2. 选定 `artifacts/` 下本次独有、尚不存在的输出目录。不要覆盖已有结果。先调用 `desktop_status`；若已有桌面，或归人工/暂停控制，停止并询问，不接管既有工作。
> 3. 调用 `desktop_start`，cwd 使用当前项目目录；立即 `desktop_screenshot`。后续只用返回的 epoch，按图像缩放乘数换算坐标，不能猜测固定显示号。
> 4. 用 `desktop_launch` 启动本机 xterm，并以 argv 让它运行刚才选定的原宿主 Python：`examples/desktop-demo.py --output <本次输出目录> --wait`。例：command 为 xterm 的绝对路径，args 为 `["-title", "DSH desktop demo", "-e", "<Python绝对路径>", "<演示程序绝对路径>", "--output", "<本次输出目录绝对路径>", "--wait"]`。
> 5. 看新截图确认演示程序在等待输入。按截图定位该终端，通过 `desktop_action` 输入 `DSH_DESKTOP_OK 中文✓` 并按 Enter；不得从 bash/stdin/API 直接喂入 marker，不能伪造回执。再次截图确认可见 PASS。
> 6. 用文件工具读回该目录的 CSV、结果 JSON 和摘要，确认 CSV 有 3 行、总数为 10、marker 原样匹配；将结果中的解释器 realpath/版本与桌面外预检比较，确认复用了原环境。报告“GUI输入成功”和“文件验证成功”两项，不只看 launch 返回成功。
> 7. 可请我通过 DSH 侧栏人工接管或暂停；一旦 owner 不再是 agent，停止所有 GUI 输入、launch 和 stop，不绕过检查。只有我明确恢复且状态重新归 agent 时，再截图获取新 epoch 继续。若我未参与，将人工接管测试标注为未测，不冒充通过。
> 8. 本任务明确授权你在保存、核验结果后，使用 `desktop_stop(confirm:true)` 停止**本次新建且仍归 agent 的桌面**。若已归人工/暂停则留给我处理，不使用 kill/pkill/raw DISPLAY 绕过。确认 stopped、owner=none，仅保留本次合成工件。
> 9. 最后给出逐项结果、工件链接和关键截图；注明没有安装软件、登录账户、修改系统配置或操作物理桌面。

演示只用 Python 标准库。默认会在输入 marker 成功后创建输出目录，并拒绝覆盖已有目录；`--wait` 让 PASS 保持可见。生成结果包含这次进程的解释器/工作目录，不会 dump 环境变量；这些本机结果留在 Git 忽略的 `artifacts`，不要提交到公开仓库。
