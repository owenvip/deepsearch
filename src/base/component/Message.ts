export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
}

export class SystemMessage implements Message {
  public role
  public content

  constructor(content: string) {
    this.role = 'system'
    this.content = content
  }
}

export class AssistantMessage implements Message {
  public role
  public content
  public tool_calls?: ToolCall[];

  constructor(content: string, toolCalls?: ToolCall[]) {
    this.role = 'assistant'
    this.content = content
    this.tool_calls = toolCalls
  }
}

export class ToolMessage implements Message {
  public role
  public content
  public tool_call_id

  constructor(content: string, tool_call_id: string) {
    this.role = 'tool'
    this.content = content
    this.tool_call_id = tool_call_id
  }
}

export interface ToolCall {
  id: string;
  type: string;
  index: number;
  function: {
    name: string;
    arguments: string;
  };
}