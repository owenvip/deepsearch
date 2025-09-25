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

  constructor(content: string) {
    this.role = 'assistant'
    this.content = content
  }
}
