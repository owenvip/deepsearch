import type { Tool } from '../component/Tools';

export const currentTimeTool: Tool = {
  type: 'function',
  function: {
    name: 'GetCurrentTime',
    description: '获取当前日期',
  },
  func: async () => {
    return new Date().toLocaleDateString();
  },
};
