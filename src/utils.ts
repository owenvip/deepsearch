import { ChatOllama } from "@langchain/ollama";

export function getBaseChatModel(modelName?: string) {
  return new ChatOllama({
    baseUrl: '127.0.0.1:11434',
    model: modelName ?? 'llama3',
    temperature: 0.7,
  });
}