# SECS Tools

SECS Tools 是一个纯粹的 Vibe Coding 项目，它是一个面向半导体设备联机、调试与日志分析场景的前端工具箱，聚焦 SECS/HSMS 相关报文处理、辅助解析与现场排障效率提升。

项目当前为纯前端应用，基于 Vue 3 + Vite 构建；默认运行在浏览器侧，不依赖仓库内后端服务。

## 项目定位

这个项目的目标不是做一个“泛用在线小工具站”，而是沉淀一组在设备对接、协议分析、现场问题定位中真正高频、可复用的工程化小工具，尽量做到：

- 输入直接可用，减少手工预处理。
- 输出面向现场排障，而不是只做格式展示。
- 多工具并列维护，保持一致的交互和数据处理风格。

## 核心特性

- 面向 SECS 报文、日志与配方体分析的专用工具集合。
- 基于浏览器运行，适合本地部署、内网使用或静态站点托管。
- 支持快捷检索工具入口与统一导航。
- 已启用 PWA 配置，可作为安装式 Web App 使用。
- 代码结构清晰，便于继续扩展新的协议分析或数据处理工具。

## 当前内置工具

### 通用数据处理

- JSON 格式化：校验、压缩、格式化 JSON。
- 进制转换：多数据批量转换，保留历史记录。
- ASCII / Hex 转换：文本与十六进制互转。

### SECS 报文工具

- SECS SML 格式化：将原始报文整理为更易读的层级结构。
- S1F12 SVID 提取：提取 SVID、SVNAME、UNITS 信息。
- S1F3 生成器：按指定格式生成 S1F3 W 命令。
- S1F4 解析：按 SVNAME 映射顺序对返回值进行对齐展示。
- Slot 转换工具：在槽位选择、位图、区间表达式之间互转。
- RecipeBody 分析器：统一解析 PPBODY、Hex、字节数组与文件输入，并支持只读分析与无损导出。

### 日志分析

- SECS 日志时间线分析：提取日志关键事件并按时间线展示，支持跳转对齐。

### 辅助工具

- 随手记：用于现场记录和临时整理文本片段的隐藏工具页。

## 技术栈

- Vue 3
- TypeScript
- Vite
- Vue Router
- Element Plus
- Tailwind CSS 4
- CodeMirror 6
- vite-plugin-pwa

## 快速开始

### 环境要求

- Node.js 20.19.0 及以上，或 22.12.0 及以上
- npm 10+

### 安装依赖

```bash
npm install
```

### 启动开发环境

```bash
npm run dev
```

默认开发地址： http://localhost:63897

### 构建生产版本

```bash
npm run build
```

该命令会先执行 TypeScript 类型检查，再执行 Vite 构建。

### 代码检查

```bash
npm run lint
```

### 自动化测试

```bash
npm test
npm run test:e2e
```

SML 方言、诊断契约和扩展说明见 [SML 解析支持矩阵](docs/sml-parser.md)。

## 可用脚本

| 脚本 | 说明 |
| --- | --- |
| `npm run dev` | 启动本地开发服务器 |
| `npm run build` | 执行类型检查并构建生产包 |
| `npm run build-only` | 仅执行 Vite 构建 |
| `npm run type-check` | 执行 Vue + TypeScript 类型检查 |
| `npm run lint` | 运行全部 lint 流程 |
| `npm run preview` | 预览构建产物 |
| `npm test` | 运行 Vitest 单元与集成测试 |
| `npm run test:watch` | 监听文件并运行相关 Vitest 测试 |
| `npm run test:e2e` | 运行 Playwright 浏览器测试 |

## 目录结构

```text
src/
  config/            工具配置与导航数据
  layout/            主布局
  router/            路由定义
  views/tools/       各工具页面与 worker
  composables/       复用逻辑
  components/        通用组件
public/              静态资源
doc/                 设计说明与领域文档
```

## 开发说明

### 新增一个工具页面的基本方式

1. 在 src/views/tools 下创建对应页面组件；如有较重的解析逻辑，可配套 worker。
2. 在 src/config/tools.ts 中注册工具名称、路径、图标与描述。
3. 路由会根据配置自动生成，无需重复手写每个工具路由。

### 适合这个仓库的贡献方向

- 补充更多 SECS/HSMS 调试工具。
- 优化日志解析性能与大文件处理体验。
- 增强数据导入导出能力。
- 为关键工具补充测试样例与边界输入。
- 改善中英文文案、帮助说明和异常提示。

## 开源协作

欢迎通过 Issue 和 Pull Request 参与改进。在提交变更前，建议至少完成以下检查：

- 能正常启动开发环境。
- `npm run build` 通过。
- `npm run lint` 通过。
- 新增功能附带必要的说明、示例或测试输入。

如果你的改动涉及日志样本、报文片段或现场数据，请先确认不包含敏感信息。

## 路线与边界

这个仓库当前聚焦 SECS 相关实用工具，不追求做成“大而全”的工业协议平台。新功能是否值得进入主仓，优先看两个标准：

- 是否服务于真实的工程问题，而不是一次性脚本需求。
- 是否能沉淀为可维护、可复用、可验证的工具能力。

## License

本项目采用 MIT License 开源。

这意味着你可以在遵守 MIT 协议条款的前提下，自由地使用、复制、修改、合并、发布、分发、再许可和商用本项目。
