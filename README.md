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
