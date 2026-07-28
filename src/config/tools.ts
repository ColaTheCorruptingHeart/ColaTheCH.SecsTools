export interface ToolItem {
  id: string;
  name: string;
  desc: string;
  path: string;
  icon: string;
  color: string;
  componentPath: string;
  hidden?: boolean;
}

export interface ToolCategory {
  id: string;
  name: string;
  icon: string;
  tools: ToolItem[];
}

export const toolsConfig: ToolCategory[] = [
  {
    id: 'general-data-processing',
    name: '通用数据处理',
    icon: 'Switch',
    tools: [
      {
        id: 'json',
        name: 'JSON 格式化',
        desc: '在线校验、压缩、格式化 JSON 数据，方便阅读和排错。',
        path: '/tools/json',
        icon: 'ScaleToOriginal',
        color: '#10b981', // emerald-500
        componentPath: 'JsonFormatter'
      },
      {
        id: 'base-converter',
        name: '进制转换',
        desc: '支持同转多个数据，在线进制相互转化，并带有历史记录。',
        path: '/tools/base-converter',
        icon: 'Switch',
        color: '#ec4899', // pink-500
        componentPath: 'BaseConverter'
      },
      {
        id: 'ascii-hex-converter',
        name: 'ASCII / Hex 转换',
        desc: '支持大块纯文本/ASCII码与十六进制 (Hex) 之间的相互转换。',
        path: '/tools/ascii-hex-converter',
        icon: 'Switch',
        color: '#a855f7', // purple-500
        componentPath: 'AsciiHexConverter'
      },
      {
        id: 'general-diff-compare',
        name: '通用差异对比',
        desc: '粘贴两份通用文本内容，使用左右并排视图快速对比差异，适合大文本按需渲染。',
        path: '/tools/general-diff-compare',
        icon: 'Files',
        color: '#0ea5e9', // sky-500
        componentPath: 'GeneralDiffCompare'
      },
    ]
  },
  {
    id: 'secs-message-tools',
    name: 'SECS 报文工具',
    icon: 'Document',
    tools: [
      {
        id: 'secs-sml',
        name: 'SECS SML 格式化',
        desc: '粘贴原始报文日志，自动输出简洁层级格式，支持层级路径点选。',
        path: '/tools/secs-sml',
        icon: 'Document',
        color: '#f59e0b', // amber-500
        componentPath: 'SecsSmlFormatter'
      },
      {
        id: 's1f12-svid-extractor',
        name: 'S1F12 SVID 提取',
        desc: '粘贴 S1F12 报文后自动格式化，并提取 SVID、SVNAME、UNITS 列表。',
        path: '/tools/s1f12-svid-extractor',
        icon: 'Document',
        color: '#0891b2', // cyan-600
        componentPath: 'S1F12SvidExtractor'
      },
      {
        id: 's1f3-generator',
        name: 'S1F3 生成器',
        desc: '导入或粘贴 SVID 列表，按指定数据格式生成 S1F3 W 命令。',
        path: '/tools/s1f3-generator',
        icon: 'EditPen',
        color: '#0d9488', // teal-600
        componentPath: 'S1F3Generator'
      },
      {
        id: 's1f4-parser',
        name: 'S1F4 解析',
        desc: '按 SVNAME 映射顺序解析 S1F4 报文，并将返回值与对应 SVNAME 对齐展示。',
        path: '/tools/s1f4-parser',
        icon: 'Document',
        color: '#14b8a6', // teal-500
        componentPath: 'S1F4Parser'
      },
      {
        id: 'slot-map-converter',
        name: 'Slot 转换工具',
        desc: '支持 25 槽位选择、25 位 map / 反相 map / 区间表达式之间的相互转换。',
        path: '/tools/slot-map-converter',
        icon: 'Grid',
        color: '#06b6d4', // cyan-500
        componentPath: 'SlotMapConverter'
      },
      {
        id: 'recipe-body-analyzer',
        name: 'RecipeBody 分析器',
        desc: '将 PPBODY、Hex、字节数组、文件等输入统一转为原始字节，进行只读分析与无损导出。',
        path: '/tools/recipe-body-analyzer',
        icon: 'Monitor',
        color: '#2563eb', // blue-600
        componentPath: 'RecipeBodyAnalyzer'
      }
    ]
  },
  {
    id: 'log-analysis',
    name: '日志分析',
    icon: 'Histogram',
    tools: [
      {
        id: 'log-timeline-analyzer',
        name: 'SECS日志时间线分析',
        desc: '解析并提取SECS日志中的关键信息，以时间线形式呈现，支持跳转对齐。',
        path: '/tools/log-timeline-analyzer',
        icon: 'Calendar',
        color: '#3b82f6', // blue-500
        componentPath: 'LogTimelineAnalyzer'
      },
      {
        id: 'secs-log-diff-analyzer',
        name: 'SECS日志语义差异',
        desc: '对比两份 SECS/SML 作业日志，按消息块和关键语义进行差异定位。',
        path: '/tools/secs-log-diff-analyzer',
        icon: 'Connection',
        color: '#f59e0b',
        componentPath: 'SecsLogDiffAnalyzer'
      }
    ]
  },
  {
    id: 'hidden-tools',
    name: '隐藏工具',
    icon: 'Hide',
    tools: [
      {
        id: 'scratchpad',
        name: '随手记',
        desc: '支持自动分块、高亮渲染的沉浸式文本便签。',
        path: '/tools/scratchpad',
        icon: 'EditPen',
        color: '#6366f1', // indigo-500
        componentPath: 'ScratchpadView',
        hidden: true
      }
    ]
  }
];

export const flatTools = toolsConfig.flatMap(category => category.tools);
