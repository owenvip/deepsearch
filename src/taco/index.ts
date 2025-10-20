import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import * as dotenv from "dotenv";
import path from 'node:path'
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { RunnableSequence } from "@langchain/core/runnables";
import type { Document } from "@langchain/core/documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import readline from 'readline'
import { getBaseChatModel } from '../utils'

dotenv.config();

const loader = new PDFLoader(path.resolve(__dirname, "wlz.pdf"), {
    // you may need to add `.then(m => m.default)` to the end of the import
    // @lc-ts-ignore
    pdfjs: () => import("pdfjs-dist/legacy/build/pdf.js"),
});
const pdfs = await loader.load()

const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 64,
    chunkOverlap: 1,
});
const splitPdfs = await splitter.splitDocuments(pdfs);

const embeddings = new OllamaEmbeddings({
    baseUrl: "127.0.0.1:11434",
    model: "mxbai-embed-large",
});

// const vectorStore = new FaissStore(embedding, {});
// const directory = "../db/vectors";
// await vectorStore.save(directory);
const vectorStore = new MemoryVectorStore(embeddings)
// await vectorStore.addDocuments(splitPdfs)

const retriever = vectorStore.asRetriever(2);
const convertDocsToString = (documents: Document[]): string => {
    return documents.map((document) => document.pageContent).join("\n")
}
const contextRetriverChain = RunnableSequence.from([
    (input) => input.question,
    retriever,
    convertDocsToString
])
// const resp = await contextRetriverChain.invoke({ question: "原文中，藤化元是怎么死的" })
// console.log('results:', resp)

const model = getBaseChatModel()

const prompt = ChatPromptTemplate.fromMessages([
    `你是一个熟读小说《仙逆》的终极原著党，精通根据作品原文详细解释和回答问题，你在回答时会引用作品原文。
并且回答时仅根据原文，尽可能回答用户问题，如果原文中没有相关内容，你可以回答“原文中没有相关内容”，
以下是原文中跟用户回答相关的内容：
{context}
现在，你需要基于原文，回答以下问题：
{question}`
])

const ragChain = RunnableSequence.from([
    {
        context: contextRetriverChain,
        question: (input) => input.question,
    },
    prompt,
    model,
    new StringOutputParser()
])

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})
function chat() {
    rl.question("User: ", async (input) => {
        if (input.toLowerCase() === "exit") {
            rl.close();
            return;
        }
        const resp = await ragChain.invoke({ input }, { configurable: { sessionId: 'no-used' } })
        console.log("Agent: ", resp)
        chat()
    })
}

console.log("请输入问题。 输入 exit 退出聊天。");
chat();