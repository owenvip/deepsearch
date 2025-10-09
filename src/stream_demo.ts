import { ChatAlibabaTongyi } from "@langchain/community/chat_models/alibaba_tongyi";
import { HumanMessage } from "@langchain/core/messages";
import * as dotenv from "dotenv";

dotenv.config();

const model = new ChatAlibabaTongyi({
  alibabaApiKey: process.env.OPENAI_API_KEY,
  modelName: "qwen2.5-math-1.5b-instruct",
  streaming: true, // 启用流式响应
});

async function streamingExample() {
  try {
    console.log("AI 正在思考中...");
    console.log("回复：");

    const stream = await model.stream([
      new HumanMessage("请详细介绍 LangChain.js 的主要特性和使用场景。")
    ]);

    // 逐块处理流式响应
    for await (const chunk of stream) {
      process.stdout.write(chunk.content);
    }

    console.log("\n\n--- 回复完成 ---");

  } catch (error) {
    console.error("流式处理失败：", error);
  }
}

streamingExample();
