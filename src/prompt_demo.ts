import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatAlibabaTongyi } from "@langchain/community/chat_models/alibaba_tongyi";

import * as dotenv from "dotenv";

dotenv.config();

const model = new ChatAlibabaTongyi({
  alibabaApiKey: process.env.OPENAI_API_KEY,
  modelName: "qwen2.5-math-1.5b-instruct",
  temperature: 0.7,
  maxTokens: 1000,
});

// 创建 Prompt 模板
const promptTemplate = PromptTemplate.fromTemplate(`
你是一个{role}，专门帮助用户解决{domain}相关的问题。

用户问题：{question}

请提供详细、专业的回答，包含以下要素：
1. 问题分析
2. 解决方案
3. 代码示例（如果适用）
4. 最佳实践建议

回答：
`);

// 创建输出解析器
const outputParser = new StringOutputParser();

// 构建处理链
const chain = promptTemplate.pipe(model).pipe(outputParser);

async function promptTemplateExample() {
  try {
    const result = await chain.invoke({
      role: "资深前端工程师",
      domain: "React 性能优化",
      question: "如何优化 React 应用的渲染性能？"
    });

    console.log("优化建议：");
    console.log(result);

  } catch (error) {
    console.error("处理失败：", error);
  }
}

promptTemplateExample();
