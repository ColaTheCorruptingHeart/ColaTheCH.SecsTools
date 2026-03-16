export interface ToolItem {
  id: string;
  name: string;
  desc: string;
  path: string;
  icon: string;
  color: string;
  componentPath: string;
}

export interface ToolCategory {
  id: string;
  name: string;
  icon: string;
  tools: ToolItem[];
}

export const toolsConfig: ToolCategory[] = [
  {
    id: 'dev-tools',
    name: '开发工具',
    icon: 'Tools',
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
        id: 'secs-sml',
        name: 'SECS SML 格式化',
        desc: '粘贴原始报文日志，自动输出简洁层级格式，支持层级路径点选。',
        path: '/tools/secs-sml',
        icon: 'Document',
        color: '#f59e0b', // amber-500
        componentPath: 'SecsSmlFormatter'
      },
      {
        id: 'base64',
        name: 'Base64 编码/解码',
        desc: '在线进行字符串及文件的 Base64 编码、解码操作。',
        path: '/tools/base64',
        icon: 'Document',
        color: '#3b82f6', // blue-500
        componentPath: 'Base64'
      },
      {
        id: 'regex',
        name: '正则表达式测试',
        desc: '在线校验正则表达式匹配情况，包含常用正则参考。',
        path: '/tools/regex',
        icon: 'Help',
        color: '#f59e0b', // amber-500
        componentPath: 'Regex'
      }
    ]
  }
];

export const flatTools = toolsConfig.flatMap(category => category.tools);
