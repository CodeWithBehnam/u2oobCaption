import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
});

const prompt = ChatPromptTemplate.fromTemplate(
  "You are a helpful assistant. {input}"
);

const parser = new StringOutputParser();

export const simpleChain = prompt.pipe(model).pipe(parser);

export async function generateCompletion(input: string): Promise<string> {
  return await simpleChain.invoke({ input });
}


