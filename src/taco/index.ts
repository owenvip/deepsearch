import { ChatOllama } from "@langchain/ollama";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { AlibabaTongyiEmbeddings } from "@langchain/community/embeddings/alibaba_tongyi";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import * as dotenv from "dotenv";
import path from 'node:path'
import { MemoryVectorStore } from "langchain/vectorstores/memory";

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

const embedding = new AlibabaTongyiEmbeddings({});
// const vectorStore = new FaissStore(embedding, {});
const vectorStore = new MemoryVectorStore(embedding)
await vectorStore.addDocuments(splitPdfs)
// const directory = "../db/vectors";
// await vectorStore.save(directory);

const result = await vectorStore.similaritySearch('藤化元')
console.log('results:', result)

// const model = new ChatOllama({
//     baseUrl: "127.0.0.1:11434",
//     model: 'qwen3:0.6b',
//     temperature: 0.7,
// });