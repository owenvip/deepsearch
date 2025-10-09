import dotenv from 'dotenv';
import { TavilySearch } from '@langchain/tavily'
import { ChatAlibabaTongyi } from "@langchain/community/chat_models/alibaba_tongyi";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

dotenv.config()

// 定义 tools
const agentTools = [
  new TavilySearch({
    maxResults: 3 // 最多查询 3 个结果
  })
]

// 初始化模型
const model = new ChatAlibabaTongyi({
  alibabaApiKey: process.env.OPENAI_API_KEY,
  modelName: "qwen2.5-math-1.5b-instruct",
  temperature: 0.7,
  maxTokens: 1000,
});

const messages = [new HumanMessage("Hello")];

const res = await model.invoke(messages);