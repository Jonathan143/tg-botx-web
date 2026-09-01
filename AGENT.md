# 项目开发约定

本文档适用于整个项目。新增或修改代码时，请优先遵循以下约定；若某个子目录存在更具体的 `AGENT.md`，以更具体目录中的约定为准。

## 项目概览

- 技术栈：React、TypeScript、Vite、Tailwind CSS、shadcn/ui。
- 源码目录：`src/`。
- 路由页面：`src/pages/<route>/`。
- 全局通用组件：`src/components/`；shadcn/ui 基础组件放在 `src/components/ui/`。
- 全局 Hook：`src/hooks/`；全局工具函数和类型按职责放在 `src/lib/` 等共享目录。

## 页面与模块归属

### 页面私有代码就近放置

- 仅被单个页面使用的业务组件，必须放在对应页面的 `src/pages/<route>/components/` 下。
- 仅服务于单个页面的 Hook、类型或工具函数，也应放在该页面目录内，按需要使用 `hooks/`、`types/`、`utils/` 子目录，或放在页面目录下的相邻文件中。
- 页面私有模块不得为了“方便”放入全局 `src/components`、`src/hooks` 或 `src/lib`。

### 共享代码再上提

- 只有在同一功能的多个页面确实复用时，才将模块上提到全局共用目录。
- 上提前确认调用方至少有两个，并确保模块不依赖某个页面的路由参数、查询状态或页面私有实现。
- 通用 UI（例如按钮、输入框、弹窗基础壳）可放在 `src/components/ui/`；业务组件应保留在对应功能或页面目录中。
- 优先使用 shadcn/ui 已提供的组件；只有现有组件无法满足需求时，才新增或封装组件，并尽量沿用项目已有的变体和设计 token。

### 避免无意义的转发层

- 不要新增只为转发导出的 barrel 文件（例如仅包含 `export { ... }` 的 `index.ts`），以免扩大依赖图和打包范围。
- 需要使用模块时，直接从实际定义文件导入；只有在确有稳定公共 API、且能显著改善模块边界时，才考虑建立导出入口。

## 导入约定

- 跨目录导入统一使用 `@/` 别名，例如：

  ```tsx
  import { Button } from "@/components/ui/button";
  ```

- 同一功能内的邻近模块可以使用相对路径，例如页面组件导入同页面的类型或 Hook。
- 不要为了使用别名而把邻近模块改成跨目录导入，也不要通过 barrel 文件间接转发依赖。

## 样式约定

- 优先使用 Tailwind CSS utility classes 完成布局、间距、颜色、排版、响应式和状态样式。
- 避免新增自定义 CSS class；只有在 Tailwind 无法合理表达、需要复用复杂样式，或必须处理第三方库/浏览器特殊行为时，才在样式文件中定义自定义 class，并说明其必要性。
- 优先复用 shadcn/ui 的样式变量、组件变体和 Tailwind 设计 token，不要在组件中随意引入新的硬编码颜色、间距或阴影值。
- 不要把本可直接写成 Tailwind classes 的样式抽到额外 CSS 文件中。

## 命名约定

- React 组件和 TypeScript 类型使用 PascalCase，例如 `OrderSummary`、`OrderSummaryProps`。
- Hook 名称以 `use` 开头，并使用 camelCase，例如 `useOrderQuery`。
- 事件处理函数使用 `handleXxx`，或使用能清楚表达动作的动词，例如 `handleSubmit`、`openDialog`。
- 布尔值使用 `is`、`has`、`can`、`should` 等前缀，例如 `isLoading`、`hasPermission`、`canEdit`、`shouldRefetch`。
- 命名应表达业务含义，避免使用 `data2`、`temp`、`doThing` 等含义不明确的名称。

## 页面入口职责

页面入口（通常为 `src/pages/<route>/index.tsx`）只负责页面级编排，包括：

- 读取和传递路由参数；
- 页面级查询、提交和状态管理；
- 组合页面区块，并处理区块之间的必要协作。

以下内容必须拆分到 `src/pages/<route>/components/` 中职责单一的组件：

- 独立业务区块；
- 弹窗和抽屉；
- 表格及其列配置、行操作；
- 表单及其校验和提交 UI；
- 复杂展示或较长、可独立理解的 JSX。

禁止把整个页面的查询、表单、弹窗、表格和大段 JSX 全部堆在 `index.tsx`。页面入口应让读者能够快速看懂页面结构；具体业务细节由下层组件、页面私有 Hook 和工具函数承担。

## 新增代码检查清单

在提交修改前，确认：

1. 新组件的复用范围已判断，单页面组件位于对应 `pages/<route>/components`。
2. 页面私有 Hook、类型和工具函数没有无理由上提到全局目录。
3. 跨目录导入使用 `@/`，邻近模块使用相对路径即可。
4. 没有新增仅用于转发导出的 barrel 文件。
5. `index.tsx` 只保留页面级编排、路由参数、查询和状态，不承载大段业务 JSX。
6. 组件、类型、Hook、事件处理函数和布尔值命名符合本文件约定。
7. Avoid using the index of an array as key property in an element

## 常用命令

```bash
pnpm dev       # 启动 Vite 开发服务器
pnpm typecheck # 执行 TypeScript 类型检查
pnpm build     # 类型检查并构建生产包
pnpm lint      # 使用 Biome 检查代码
pnpm format    # 使用 Biome 格式化代码
```
