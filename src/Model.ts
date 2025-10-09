import dotenv from 'dotenv';
import { Message, SystemMessage, AssistantMessage, ToolMessage, ToolCall } from './component/Message'
import { Tools } from './component/Tools'

dotenv.config()

interface ResponseFormat {
    type: 'text' | 'json_object';
}

interface LLMConfig {
    model: string
    apiKey: string
    baseUrl: string
    response_format?: ResponseFormat
}

interface ModelUserConfig {
    responseFormat: ResponseFormat
    prompt: string
    tools: Tools
    autoRunTools?: boolean;
}

export class Model {
    private llmBaseConfig: LLMConfig
    private messages: Message[]
    private tools: Tools
    private autoRunTools: boolean = true;

    constructor(config: ModelUserConfig) {
        if (!process.env.MODEL_NAME || !process.env.DEEPSEEK_API_KEY || !process.env.BASE_URL) {
            throw new Error('MODEL_NAME, DEEPSEEK_API_KEY, BASE_URL are not defined');
        }
        this.llmBaseConfig = {
            model: process.env.MODEL_NAME,
            apiKey: process.env.DEEPSEEK_API_KEY,
            baseUrl: process.env.BASE_URL,
            response_format: config.responseFormat || {
                type: 'text',
            },
        }
        this.messages = [new SystemMessage(config.prompt)]
        this.tools = config.tools ?? new Tools([])
        this.autoRunTools = config.autoRunTools !== false
    }

    public async start(messages?: Message[]): Promise<AssistantMessage> {
        const { model, apiKey, baseUrl, response_format } = this.llmBaseConfig;

        this.messages.push(...(messages ?? []))
        
        // 调用 LLM API
        const resp = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                stream: true,
                messages: this.messages,
                response_format
            })
        })

        if (!resp.ok) {
            console.log('Response status:', resp.status);
            console.log('Response statusText:', resp.statusText);
            const errorText = await resp.text();
            console.log('Error response:', errorText);
            throw new Error(`API Error: ${resp.status} ${resp.statusText} - ${errorText}`);
        }

        let buffer = '';
        let assistantMessage = '';
        let tools: Record<number, ToolCall> = {};

        const reader = resp.body?.getReader();
        const decoder = new TextDecoder();

        while (true) {
            // 流式的存储 LLM 的回复以及工具调用指令
            const { done, value } = (await reader?.read()) || {};
            if (done) {
                break;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep the last incomplete line in buffer

            for (const line of lines) {
                if (line.trim() === '') continue;
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') {
                        break;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        const delta = parsed.choices?.[0]?.delta;
                        if (delta?.content) {
                            assistantMessage += delta.content;
                        }
                        // 处理多个工具调用
                        if (delta?.tool_calls) {
                            delta?.tool_calls.forEach((toolCall: any) => {
                                if (tools[toolCall.index]) {
                                    tools[toolCall.index].function.arguments += toolCall.function.arguments;
                                } else {
                                    tools[toolCall.index] = toolCall;
                                }
                            });
                        }
                    } catch (e) {
                        console.log('Failed to parse JSON:', data);
                    }
                }
            }
        }

        let response: AssistantMessage

         // 没有工具调用，会直接回复
        if (assistantMessage && Object.keys(tools).length === 0) {
            console.log(`\n🤖 Assistant:\n${assistantMessage}\n`);
            response = new AssistantMessage(assistantMessage);
            this.messages.push(response);
        }

        // 有工具调用，需要调用工具，自动触发一轮新的对话
        if (Object.keys(tools).length > 0) {
            // 提取参数
            const tool_calls = Object.values(tools).map((tool) => tool);

            if (this.autoRunTools) {
                console.log(`\n🤖 Assistant with Tools:`),
                    assistantMessage && console.log(`📝 Content: ${assistantMessage}`),
                    console.log(`🔧 Tools: ${tool_calls.map((tool) => `${tool.function.name}(${tool.function.arguments})`).join(', ')}`),
                    console.log('')
                response = new AssistantMessage(assistantMessage, tool_calls);
                this.messages.push(response);

                // 执行全部的工具
                const callToolTasks = Object.values(tools).map(async (tool) => {
                    let result = '';
                    try {
                        result = await this.tools.call(tool.function.name, JSON.parse(tool.function.arguments));
                    } catch (error) {
                        result = `${tool.function.name} 执行异常`;
                    }
                    return JSON.stringify(result);
                });
                const toolResults = await Promise.all(callToolTasks);
                // 每个工具的结果，创建一个 tool message 存入对话上下文中
                const toolResultMessages = toolResults.map((result, index) => {
                    console.log(`🛠️  Tool Result: ${result}`);
                    return new ToolMessage(result, tools[index].id);
                });
                this.messages.push(...toolResultMessages);
                // 触发新一轮的对话
                return await this.start();
            } else {
                console.log(`\n🤖 Assistant with Tools (Manual Mode):`),
                    assistantMessage && console.log(`📝 Content: ${assistantMessage}`),
                    console.log(`🔧 Tools: ${tool_calls.map((tool) => `${tool.function.name}(${tool.function.arguments})`).join(', ')}`),
                    console.log('');
                response = new AssistantMessage(assistantMessage, tool_calls);
            }
        }

        return response!
    }

    public getMessages() {
        return this.messages;
    }
}