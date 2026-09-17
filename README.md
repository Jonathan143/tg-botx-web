# React + TypeScript + Vite + shadcn/ui

This is a template for a new Vite project with React, TypeScript, and shadcn/ui.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `src/components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button"
```

## 发布

使用 `pnpm release` 发布新版本。默认递增 patch 版本，也可以指定递增级别或完整版本号：

```bash
pnpm release                 # 0.0.1 -> 0.0.2
pnpm release minor           # 递增 minor 版本
pnpm release 1.2.3           # 使用指定版本
pnpm release --dry-run       # 仅查看计划，不修改或推送
```

脚本会更新 `package.json`，提交当前工作区全部改动，推送当前分支，然后创建并推送 `v<version>` tag。运行前请确认工作区改动和 Git 远端配置符合预期。


## 任务执行次数与消息库

任务的执行频率区域新增“执行次数”，默认 1。仅随机窗口允许改为 1–1000 的整数；
切换回固定时间自动恢复 1。按每个符合频率的日期生成严格递增、互不重复且在窗口内的随机时间，
支持每天、每 N 天、每周和每月指定日期；预览仍显示未来 5 个时间点。
次数是计划次数，不保证成功发送；服务离线、任务运行过久或聊天忙碌导致的过期时间点沿用后端跳过策略。

侧边栏“消息库”提供分组搜索、新建、改名、删除与消息管理，每组最多 1000 条，
每条支持多行且不能是空白文本，长度限制为 4096 个 UTF-16 字符单位。
消息编辑器按页显示，避免大量文本框拖慢页面；未保存草稿不会被后台刷新覆盖。
并发编辑冲突保留当前草稿，可确认放弃后重新读取最新版本。

执行步骤“发送消息”支持：

- **固定消息**：保持原有文本发送方式。
- **随机消息 → 手动列表**：手工添加候选文本，也可从分组一次性导入并追加；
  导入后独立保存在任务中，不随分组更新。
- **随机消息 → 实时分组**：仅保存分组 ID，后端每次发送前读取最新分组再随机选择一条；
  分组更新无需重新发布任务。被引用分组不可直接删除或清空。

每次步骤执行随机发送一条，允许重复选择相同消息。候选消息支持已有上游变量模板，
普通步骤、嵌套分支以及 YAML 提交均执行数据校验。

依赖配套后端 `Jonathan143/tg-botx` 的随机窗口多次执行与分组消息库功能，
上线应先升级后端。API 路径为 `/api/message-library/groups`，沿用 Cookie 会话、CSRF 和同源访问。
旧后端无法识别新字段，回退前应将相关任务改回固定文本及单次执行。

## 提交前检查

```bash
pnpm exec biome format .
pnpm lint
pnpm typecheck
pnpm build
```

PR CI 使用与现有发布流程一致的 Node.js 24、pnpm 11，固定锁文件安装后执行上述检查。
