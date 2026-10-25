# Agent Note: 已安装工作区的 Node 引擎下限

Status: implemented

[English](2026-07-06-node-engine-floor.md) | 中文

## 问题

根 `engines.node` 范围约定的是包含开发工具在内的已安装工作区，而不仅仅是 harness 源码直接调用的运行时 API。它必须符合各个宣传分支上所安装依赖声明的 Node 支持范围；否则 `pnpm install --engine-strict` 会拒绝一个已声明支持的版本，而非严格安装则会在依赖声明的支持范围之外运行。

## 决策

将 `engines.node` 设为 `^22.22.2 || ^24.15.0 || >=26.0.0`。AITP 验证工作流在 `22.22.2` 和 `24.15.0` 上运行不需要密钥的 jsdom 及真实 TypeScript 语言服务器检查，与使用当前 Node 24 的主要验证任务相互独立。

保留的上游兼容性矩阵在其仓库和事件条件满足时覆盖 `['22.22.2', '24.15.0', 26]`。其主要 Node 24 任务负责完整类型检查和单元测试覆盖率；兼容性任务运行 source-worker、Zstandard、source-launch 和 [jsdom 存储](../../archived/testing/2026-07-30-vitest-jsdom-webstorage-ownership.md) 专项冒烟测试，不重复这套检查。真实 API 的 e2e 工作流保持在 Node 24 上，因为它验证 API 集成，而非最低补丁版本。

已安装的开发依赖决定了该范围：根目录的 `jsdom@30.1.1` 声明支持 `^22.22.2 || ^24.15.0 || >=26.0.0`，LSP 提供方的 `typescript-language-server@6.0.0` 声明支持 `>=22.22.2`。这些声明提高了工作区的版本要求，但不能据此认定每个已发布的运行时包都需要相同下限。原生插件清单及[捆绑的主要运行时](../../../../scripts/primary-runtime/lock.json) 保留各自负责的约定；此次工作区变更不重写这些约定。

两个源码运行时要求仍然满足：

- **`node:sqlite`**：`packages/storage/storage-sqlite` 从 `node:sqlite` 导入 `DatabaseSync`，可选 Session-query 提供方在首次搜索时加载它。该模块在 **22.13** 和 **23.4** 取消了 `--experimental-sqlite` 标志要求。
- **原生 TypeScript 类型剥离**：构建模式的 `apps/cli/tests/profiles/headless/tests/keyless-smoke.e2e.ts` 冒烟测试用纯 `node` 启动自己的 `.ts` test-support driver，并加载 `.ts` 测试适配器。类型剥离从 **22.18** 和 **23.6** 起成为默认行为；更早版本需要 `--experimental-strip-types`。

`@types/node` 保持在 22.x 线，使类型检查能拒绝仅较新主版本才有的 API。确切版本继续由根清单维护，本记录不再重复一份版本号。

## 后果

- 根范围覆盖已安装的开发依赖图和 harness 源码要求；Node 23 和 25 不在所选依赖的支持范围内。
- 分支中的活动工作流固定两个受支持的 LTS 最低版本，用于不需要密钥的依赖检查。范围更广的源码兼容性和 Node 26 检查仍留在受独立条件限制的上游矩阵中。仅使用浮动的 `24` 无法验证 24.x 的最低补丁版本。
- 构建模式冒烟测试无需版本条件标志：受支持的下限已默认启用类型剥离，因此示例自有的 TypeScript driver 保持使用纯 `node fixture.ts` 路径。
- 后续依赖或源码 API 若提高工作区下限，必须同步更新根 `engines.node`、兼容性矩阵、开发指南和本 Agent Note。

## 曾考虑的替代方案

- **保持 `^22.19.0 || >=24.0.0`。** 否决：它宣传支持所选 jsdom 和语言服务器声明排除的工作区版本。
- **使用 `>=22.22.2`。** 否决：它同时宣传支持 Node 23、Node 24.0–24.14 和 Node 25，而这些版本不在 jsdom 声明的支持范围内。
- **仅为保留旧工作区下限而维持旧开发依赖。** 否决：选定的依赖升级属于维护中的开发依赖图，而且受支持的 LTS 线仍有兼容的补丁版本。
- **将工作区范围复制到每个已发布包及原生插件。** 否决：开发工具的要求不能证明这些独立维护的包具有相同运行时要求。
- **矩阵 `[22, 24, 26]` 不固定 LTS 下限。** 否决：浮动的主版本条目会逐渐上漂，不再验证所声明的最低补丁版本。
- **保持 `@types/node` 超前于受支持的 LTS 线。** 否决：它会使仅较新主版本才有的 API 编译通过，将其失败留给运行时检查。
