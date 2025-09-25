import { Message, SystemMessage, AssistantMessage } from './Message'

interface ResponseFormat {
    type: 'text' | 'json_object';
}

interface LLMConfig {
    model: string
    apiKey: string
    baseUrl: string
    response_format?: ResponseFormat
}

interface ModelConfig {
    responseFormat: ResponseFormat
    introduction: string
}

export class Model {
    private llmBaseConfig: LLMConfig
    private message: Message[]

    constructor(config: ModelConfig) {
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
        this.message = [new SystemMessage(config.introduction)]
    }

    public async start(messages?: Message[]): Promise<AssistantMessage> {
        const { model, apiKey, baseUrl, response_format } = this.llmBaseConfig;
        let response: AssistantMessage

        this.message.push(...(messages ?? []))

        const resp = await fetch(baseUrl, {

        })
        
        return response
    }
}
