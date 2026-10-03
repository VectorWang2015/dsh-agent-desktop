# DSH 插件规范核对

适用基线：DSH **0.2.0-rc.2**。本项目是外部插件，不冒用官方 monorepo 包名，也不把社区商店格式当成 DSH 核心加载或权限协议。

## 官方依据

- [插件发布与安装](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/docs/user/develop/basic/publish.md)
- [插件配置](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/docs/user/develop/basic/config.md)
- [Package manifest](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/util/package-manifest/README.md)
- [Client modules](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/client/modules/README.md)
- [右侧栏](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/client/ui-sidebar-right/README.md)
- [展示元数据读取实现](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/boot/app-boot/src/package-meta.ts)

以上依据链接固定到官方 `dsh-v0.2.0-rc.2` tag；本次适配核对了插件实际消费的 Host 和 Client API，并执行类型与无 GUI 回归检查。

## 核对结果

| 项目 | 本项目做法 |
|---|---|
| Bundle | `package.json.dsh.bundle.patch` 指向 YAML 数组；插件行按真实 npm 包名 `dsh-agent-desktop` 加载 |
| Host entry | ESM，named `name` / `inject` / `Config` / `apply`，没有混用 default export |
| Config | 同名 interface 与 Schemastery schema；YAML 覆写；不宣称存在自动 GUI 设置页 |
| Compatibility | 顶层 `engines.dsh`，并保留固定 `0.2.0-rc.2` DSH peers；rc.2 的实际兼容检查依赖 peer 声明 |
| Client entry | `dsh.client.platform=web`、导出 `./client`、Lazy-CJS ModuleLoader 工厂 id 与包名一致 |
| Dependencies | 公共 registry 的固定版本；开发不依赖相邻 DSH checkout；共享库保持 external，不私带另一份 Host 单例 |
| Browser externals | 仅 React 和 DSH 静态 UI 基线库；不滥用 `dsh.client.external` 引用其他功能插件 |
| Sidebar | 正式 `sidebarRightTabs` + keyed `sidebar.right.pane.tab` + `slots.inject`，有 effect disposer |
| Display metadata | `locale/en.json` / `locale/zh.json` 中 `meta.title/description`，manifest-relative SVG icon 与 resource exports |
| Localization | 插件列表提供中英文元数据；桌面 UI 明确为中文-only，不假称双语完整翻译 |
| Auth | HTTP 先使用 DSH Connection admission，再查会话；human input 额外要求当前能力令牌与 epoch |
| Tools | Session-bound，写操作检查当前 permission；图像走附件；不自动绕过人工/暂停所有权 |
| Packaging | 明确文件白名单；无 `.runtime`、`.state`、artifacts、source map、凭据或原始主机研究报告 |
| Git install | 同时提交干净的三个 lib 产物；不定义 prepare/install 钩子，Git 直装显式 `--ignore-scripts`，native setup 是独立动作 |
| Licenses | 保留原代码 MIT、实际内联第三方版权；下载运行时不随源码包分发 |

## 哪些不是必须复制的规范

- 官方 monorepo 的 `@deepseek-ai/dsh-*` 命名、workspace ranges、全仓编译引用/覆盖率门槛不自动变成外部包的加载要求。
- 某些社区插件使用的 `dsh-plugin.json` 不是 rc.2 核心 manifest，也不实施运行权限。本项目不发布未经社区 schema 验证的该文件。
- `dsh.client.inject` 描述包依赖信息；真正服务依赖由 Cordis inject 控制，slot 声明由 slots.inject 等待。
- 源码型 Git 包通常需 prepare 构建；本项目选择显式提交预构建产物，因此不会让用户在安装时运行插件构建或原生安装脚本。

## 维护要求

更改源码后执行 `pnpm run check` 并更新 lib；不要手工只改产物。更换 DSH 版本先核验接口与运行测试，不通过放宽 peers 或加版本豁免掩盖不兼容。公开记录应包含可复现命令与测试范围，不引用未发布的个人机器工件。
