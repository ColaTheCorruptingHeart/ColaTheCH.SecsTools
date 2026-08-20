# SML 解析支持矩阵

四个功能共用 `src/views/tools/secs-log/sml.ts`：

- SECS SML 格式化
- SECS 日志时间线分析
- SECS 日志语义差异分析
- S1F12 SVID 提取

## 支持的 SML 形式

| 能力 | 示例 |
| --- | --- |
| 标准短类型 | `L B BOOLEAN A JIS8 I1 I2 I4 I8 U1 U2 U4 U8 F4 F8` |
| 宽泛短类型 | `I U F J` |
| 长类型别名 | `LIST BINARY BOOL ASCII INT8..64 UINT8..64 FLOAT32 FLOAT64` |
| 逗号计数 | `<L,3`、`<U4,1 100>` |
| 方括号计数 | `<L [3]`、`<ASCII[4] "TEMP">` |
| 裸列表计数 | `<L 3` |
| 字段标签 | `<U4 [CEID] 5>`、`<U4 {CEID} 5>` |
| 紧凑与多行结构 | `<L,1<A "OK">>` 或逐行缩进 |
| 字符串引号 | 单引号、双引号，以及字符串内的 `>` |
| 注释 | 节点之间的 `//`、`--`、`/* ... */` |
| 报文终止符 | `.` 或 `;`，包括无数据报文 |
| 多根节点 | 同一输入中的连续 SML 根节点 |

解析器默认使用宽松模式：可恢复问题生成警告并保留 AST。严格模式将可恢复警告提升为错误。结构无法可靠恢复的问题始终为错误。

## 日志包裹形式

支持行内时间戳和方括号时间戳，日期可使用 `-`、`/`、`.` 或 `YYYYMMDD`，小数秒可使用 `.` 或 `,`。方向标记支持：

`SEND RECV SENT RECEIVED TX RX H->E E->H HOST->EQUIPMENT EQUIPMENT->HOST`

时间戳与方向之间允许有一个或多个级别、线程标记，例如 `[worker-7]`、`(thread-2)`、`INFO`。也支持时间戳行与独立 `SxFy` 行组合的日志。

## 诊断契约

每条 `SmlDiagnostic` 都包含稳定的 `code`、`severity`、`line`、`column`、`start` 和 `end`。业务功能的处理原则：

- 格式化：始终展示恢复后的结果和完整诊断。
- 时间线：返回消息级诊断；不可用 AST 不参与路径取值。
- 语义差异：致命诊断生成 `parse_error`；可恢复警告随语义事件保留并汇总。
- S1F12：返回结构化诊断和兼容的警告文案，诊断可跳转到源码。

## 资源限制

默认单次解析限制为 8 MiB 字符文本、100,000 个节点和 256 层嵌套。调用方可以通过 `SmlParseOptions` 下调 `maxInputLength`、`maxNodes` 或 `maxDepth`，但不应在 UI 线程直接处理大输入。

新增厂商类型时优先传入 `additionalTypes`，不要直接扩大根节点识别范围。新增语法或日志包裹形式时，应同时补充解析器测试和至少一个业务消费测试。
