import { ChatPromptTemplate, MessagesPlaceholder, PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatOllama } from "@langchain/ollama";
import * as dotenv from "dotenv";
import { DynamicStructuredTool } from "@langchain/core/tools";
import z from 'zod'
import mbtiInfo from './info.json'
import { RunnableSequence, RunnableWithMessageHistory } from "@langchain/core/runnables";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import readline from 'readline'
import { ChatMessageHistory } from "langchain/stores/message/in_memory";

dotenv.config();

const mbtiList = [
    "ISTJ",
    "ISFJ",
    "INFJ",
    "INTJ",
    "ISTP",
    "ISFP",
    "INFP",
    "INTP",
    "ESTP",
    "ESFP",
    "ENFP",
    "ENTP",
    "ESTJ",
    "ESFJ",
    "ENFJ",
    "ENTJ",
]

const model = new ChatOllama({
    baseUrl: "127.0.0.1:11434",
    model: 'qwen3:0.6b',
    temperature: 0.7,
});

const prompt = ChatPromptTemplate.fromMessages([
    ["system", "你是一个共情能力非常强的心理医生，并且很了解MBTI（迈尔斯-布里格斯性格类型指标)的各种人格类型，你的任务是根据来访者的 MBTI 和问题，给出针对性的情感支持，你的回答要富有感情、有深度和充足的情感支持，引导来访者乐观积极面对问题"],
    ["human", "用户的 MBTI 类型是{type}, 这个类型的特点是{info}, 他的问题是{question}"],
])

const mbtiChain = RunnableSequence.from([prompt, model, new StringOutputParser()])

const tool = new DynamicStructuredTool({
    name: 'get-mbti-chat',
    schema: z.object({
        type: z.enum(mbtiList)
    }),
    func: async (input) => {
        const { type, question } = input as { type: string; question: string };
        const info = mbtiInfo[type as keyof typeof mbtiInfo]
        return await mbtiChain.invoke({ type, question, info })
    },
    description: "根据用户的问题和 MBTI 类型，回答用户的问题",
})

const tools = [tool]

const agentPromt = ChatPromptTemplate.fromMessages([
    ["system", "你是一个用户接待的 agent，通过自然语言询问用户的 MBTI 类型和问题，直到你有足够的信息调用 get-mbti-chat 来回答用户的问题"],
    new MessagesPlaceholder("history_message"),
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
])

const agent = createToolCallingAgent({
    llm: model,
    tools,
    prompt: agentPromt
})

const agentExecutor = new AgentExecutor({
    agent,
    tools
})

const messageHistory = new ChatMessageHistory()

const agentWithChatHistory = new RunnableWithMessageHistory({
    runnable: agentExecutor,
    getMessageHistory: () => messageHistory,
    inputMessagesKey: 'input',
    historyMessagesKey: 'history_message'
})

const rl = readline.createInterface({  // node内置readline，构建可交互cli，方便测试
    input: process.stdin,
    output: process.stdout
})

function chat() {
    rl.question("User: ", async (input) => {
        if (input.toLowerCase() === "exit") {
            rl.close();
            return;
        }

        const resp = await agentWithChatHistory.invoke({ input }, { configurable: { sessionId: 'no-used' } })

        console.log("Agent: ", resp.output)

        chat()
    })
}

console.log("请输入问题。 输入 exit 退出聊天。");

chat();