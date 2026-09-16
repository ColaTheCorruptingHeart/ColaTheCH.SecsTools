export interface ReleaseNoteSection {
  title: string
  items: readonly string[]
}

export interface ReleaseNote {
  version: string
  date: string
  title: string
  summary: string
  sections: readonly ReleaseNoteSection[]
}

export const RELEASE_ACKNOWLEDGEMENT_STORAGE_KEY = 'secs-tools:last-acknowledged-release'

export const latestRelease = {
  version: '0.3.1',
  date: '2026-09-16',
  title: 'SML 解析与日志分析升级',
  summary: '本次更新统一了多个工具的 SML 解析能力，并增强日志时间线与 S1F12 提取体验。',
  sections: [
    {
      title: 'SML 解析与格式化',
      items: [
        'SECS SML 格式化、日志时间线、语义差异和 S1F12 提取现已共用统一解析能力，兼容更多类型别名、计数写法、字段标签、注释及日志格式。',
        '格式化器新增宽松与严格模式，并提供可定位到原文的错误、警告诊断。',
      ],
    },
    {
      title: '日志时间线',
      items: [
        '新增自定义 CEID 匹配，可配置 Stream、Function 和关键值路径，并可随规则配置导入、导出。',
        '范围起点与终点会直接显示在时间线中；单次日志导入上限提升至 100 MiB、90 万行。',
        '命中报文与报文集导出统一使用机台号、批次号或导出类型、日志日期及内容哈希命名，文件更易归档和追溯。',
      ],
    },
    {
      title: 'S1F12 与稳定性',
      items: [
        'S1F12 SVID 提取新增结构化解析诊断，点击诊断即可定位到对应源码。',
        '增强异常输入恢复、日志方言兼容与自动化测试覆盖，提升大文件及复杂报文处理的可靠性。',
      ],
    },
    {
      title: 'Slot 转换',
      items: [
        '新增有片与空槽的自定义单数字映射，默认有片为 1、空槽为 0，并同步支持普通与反相 map。',
        '新增可编辑的 25 项纵向 U1 List 及其反相视图，支持复制、粘贴，并在严格格式化和校验后应用到槽位。',
      ],
    },
  ],
} as const satisfies ReleaseNote
