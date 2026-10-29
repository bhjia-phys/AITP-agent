---
description: "原生设置中的科研套件偏好与实际运行能力。"
kind: "package-reference"
---

# AITP 科研设置

[English](README.md) | 中文

## 概述

`@deepseek-ai/dsh-client-ui-aitp-settings` 向原生设置页贡献科研选项。在 Skills、浏览科研资料和完整科研工作台三种组合中均保留此入口。页面分别显示观察到的当前运行能力，以及为下次启动保存的选择。

## 使用

AITP 启动器通过 Web overlay 开启此插件。选择组合和可选的文献库、知识库、代码库后保存，再重启 `aitp-agent` 应用选择。显式 `--research-suite` 和 `--research-libraries` 参数优先于对应的已保存值。会话的 Research 选择和工具预设仍各自独立。

现有 Settings 表单与 ConfigEditor 负责校验，并将四个偏好字段原子保存到当前 profile 的 `cordis.patch.yml`。字段采用 volatile，使表单能够接收新的保存值而不重新加载科研插件。本插件的设置不会直接改变运行中的组合；启动器在下次启动时读取同一行，并生成已有的能力 overlay。没有保存偏好时，沿用此前启动行为。

## 架构

Host 部分声明偏好 schema，并向页面公开加载时实际解析出的自动 Research 开关快照。Client 部分复用 ConfigForm、原生插件清单与 `settings.section` 扩展位。草稿与错误提示仅属于界面状态，profile 是唯一偏好存储。保存不访问科研记录或历史 Session。Skills 模式保留此设置页，便于重新开启工作台。

## 模型体验

无；本插件保存 profile 偏好并显示运行能力，不向模型请求添加内容。下次启动后，由所选科研插件各自决定上下文与工具行为。

#### KV Cache 影响

无；本插件不组装模型请求。

## 已知限制与后续工作

- 能力组合需要重启生效。运行插件清单可重新检查；自动 Research 显示页面加载时的配置，重启 Host 后需要重新加载页面。若 home patch 或显式 overlay 替换了偏好行，原生 profile 保存会拒绝被覆盖的编辑。启动偏好使用字面值；底层科研插件配置仍支持延迟 YAML 表达式。此设置服务于 AITP Web 启动器，不适用于任意原生 DSH profile。
