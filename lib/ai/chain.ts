import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import OpenAI from "openai";

// Model will be initialized after callback handler

// Custom callback handler following LangChain-JS best practices
class AICallbackHandler extends BaseCallbackHandler {
  name = "AICallbackHandler";

  async handleChainStart(chain: any, inputs: any, runId: string) {
    console.log(`🔗 Chain started: ${chain?.constructor?.name || 'Unknown'} (Run: ${runId})`);
    console.log(`   Inputs:`, Object.keys(inputs));
  }

  async handleChainEnd(outputs: any, runId: string) {
    console.log(`✅ Chain completed: ${runId}`);
    console.log(`   Output type: ${typeof outputs}`);
  }

  async handleChainError(error: any, runId: string) {
    console.error(`❌ Chain error: ${runId}`);
    console.error(`   Error: ${error?.message}`);
  }

  async handleLLMStart(llm: any, prompts: string[], runId: string) {
    console.log(`🧠 LLM started: ${llm?.modelName || 'Unknown'} (Run: ${runId})`);
    console.log(`   Prompts count: ${prompts.length}`);
    console.log(`   First prompt length: ${prompts[0]?.length || 0} chars`);
  }

  async handleLLMEnd(output: any, runId: string) {
    console.log(`🎯 LLM completed: ${runId}`);
    const usage = output?.llmOutput?.tokenUsage;
    if (usage) {
      console.log(`   Token usage: ${usage.totalTokens} total (${usage.promptTokens} in, ${usage.completionTokens} out)`);
    }
  }

  async handleLLMError(error: any, runId: string) {
    console.error(`💥 LLM error: ${runId}`);
    console.error(`   Error: ${error?.message}`);
  }
}

// Initialize callback handler
const callbackHandler = new AICallbackHandler();

// Initialize model with proper configuration following LangChain-JS best practices
const model = new ChatOpenAI({
  modelName: process.env.AI_MODEL || "gpt-5-2025-08-07",
  temperature: 0,
  openAIApiKey: process.env.OPENAI_API_KEY,
  maxTokens: 1000,
  timeout: 30000, // 30 second timeout
  // Enable token tracking in callbacks (required for token usage)
  callbacks: [callbackHandler],
  // Ensure token usage is included in responses
  verbose: true,
});

// Initialize direct OpenAI client for token tracking
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Debug logging
console.log("🤖 LangChain-JS AI Configuration (GPT-5 model):");
console.log("   Model:", process.env.AI_MODEL || "gpt-5-2025-08-07");
console.log("   API Key exists:", !!process.env.OPENAI_API_KEY);
console.log("   Temperature:", 0);
console.log("   Max Tokens:", 1000);
console.log("   Callbacks enabled:", true);
console.log("   Direct OpenAI client:", !!openaiClient);

// Create prompt template following LCEL best practices
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant. Provide clear, accurate, and concise responses."],
  ["human", "{input}"]
]);

const parser = new StringOutputParser();

// Create main chain using LCEL with callbacks for monitoring
export const simpleChain = RunnableSequence.from([
  prompt,
  model,
  parser
]).withConfig({
  callbacks: [callbackHandler],
  runName: "SimpleAIChain"
});

// Enhanced chain that preserves metadata for token tracking
const chainWithMetadata = RunnableSequence.from([
  RunnablePassthrough.assign({
    // Add timestamp for tracking
    startTime: () => Date.now(),
  }),
  prompt,
  model,
  RunnablePassthrough.assign({
    // Extract metadata from the response and preserve timing
    response_metadata: (response) => response.response_metadata,
    usage: (response) => response.usage,
    finish_reason: (response) => response.finish_reason,
    responseTime: (response) => Date.now() - response.startTime,
  }),
  RunnablePassthrough.assign({
    // Preserve the text content from the parser
    text: (response) => response.content || response,
  })
]).withConfig({
  callbacks: [callbackHandler],
  runName: "EnhancedAIChain"
});

// Token extraction utility following LangChain-JS best practices from documentation
function extractTokenUsage(response: any): { inputTokens: number; outputTokens: number; totalTokens: number } {
  console.log("🔍 LangChain-JS Token extraction (following documentation patterns):");
  console.log("   Response type:", typeof response);
  console.log("   Response keys:", Object.keys(response || {}));

  // Primary method: response_metadata.tokenUsage (LangChain-JS ChatOpenAI pattern)
  const responseMetadata = response?.response_metadata;
  if (responseMetadata) {
    console.log("   Found response_metadata:", Object.keys(responseMetadata));

    // Check for usage_metadata (streaming pattern from docs)
    const usageMetadata = responseMetadata.usage_metadata;
    if (usageMetadata) {
      console.log("   Found usage_metadata (streaming pattern):", usageMetadata);
      return {
        inputTokens: usageMetadata.input_tokens || 0,
        outputTokens: usageMetadata.output_tokens || 0,
        totalTokens: usageMetadata.total_tokens || 0
      };
    }

    // Check for tokenUsage (callback pattern from docs)
    const tokenUsage = responseMetadata.tokenUsage;
    if (tokenUsage) {
      console.log("   Found tokenUsage (callback pattern):", tokenUsage);
      return {
        inputTokens: tokenUsage.promptTokens || tokenUsage.inputTokens || 0,
        outputTokens: tokenUsage.completionTokens || tokenUsage.outputTokens || 0,
        totalTokens: tokenUsage.totalTokens || 0
      };
    }
  }

  // Secondary method: llmOutput.tokenUsage (callback pattern from docs)
  const llmOutput = response?.llmOutput;
  if (llmOutput) {
    console.log("   Found llmOutput:", Object.keys(llmOutput));

    const tokenUsage = llmOutput.tokenUsage;
    if (tokenUsage) {
      console.log("   Found llmOutput.tokenUsage (callback pattern):", tokenUsage);
      return {
        inputTokens: tokenUsage.promptTokens || tokenUsage.inputTokens || 0,
        outputTokens: tokenUsage.completionTokens || tokenUsage.outputTokens || 0,
        totalTokens: tokenUsage.totalTokens || 0
      };
    }
  }

  // Tertiary method: Direct usage object (fallback)
  const directUsage = response?.usage;
  if (directUsage) {
    console.log("   Found direct usage object:", directUsage);
    return {
      inputTokens: directUsage.prompt_tokens || directUsage.input_tokens || 0,
      outputTokens: directUsage.completion_tokens || directUsage.output_tokens || 0,
      totalTokens: directUsage.total_tokens || 0
    };
  }

  console.log("   ⚠️ No token usage found using LangChain-JS patterns, checking for any token data...");

  // Last resort: try to find any token-related data
  if (response && typeof response === 'object') {
    for (const [key, value] of Object.entries(response)) {
      if (key.toLowerCase().includes('token') && typeof value === 'object' && value) {
        console.log("   Found token-related data:", key, value);
        const tokenData = value as any;
        return {
          inputTokens: tokenData.prompt_tokens || tokenData.inputTokens || tokenData.input_tokens || 0,
          outputTokens: tokenData.completion_tokens || tokenData.outputTokens || tokenData.output_tokens || 0,
          totalTokens: tokenData.total_tokens || tokenData.totalTokens || 0
        };
      }
    }
  }

  console.log("   ❌ No token usage found, using zero values");
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0
  };
}

export async function generateCompletion(input: string): Promise<string> {
  return await simpleChain.invoke({ input });
}

export async function generateCompletionWithTokens(input: string): Promise<{
  text: string;
  tokensUsed: number;
  inputTokens: number;
  outputTokens: number;
  responseTime: number;
  finishReason?: string;
}> {
  const startTime = Date.now();

  try {
    // Validate configuration
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable.");
    }

    console.log("🚀 Making AI request with LangChain-JS (following documentation patterns):");
    console.log("   Input length:", input.length, "characters");
    console.log("   Model:", process.env.AI_MODEL || "gpt-5-2025-08-07");

    // Use LangChain-JS model with proper callback configuration for token tracking
    console.log("🔄 Using LangChain-JS ChatOpenAI with callback token tracking");
    const modelResponse = await model.invoke([
      ["system", "You are a helpful assistant. Provide clear, accurate, and concise responses."],
      ["human", input]
    ]);

    const responseTime = Date.now() - startTime;
    const text = modelResponse.content as string;

    // Extract token usage using LangChain-JS patterns from documentation
    const tokenUsage = extractTokenUsage(modelResponse);
    const finishReason = modelResponse.response_metadata?.finish_reason || "stop";

    console.log("✅ LangChain-JS AI response successful:");
    console.log("   Response time:", responseTime, "ms");
    console.log("   Token usage (LangChain-JS patterns):", tokenUsage);
    console.log("   Text length:", text.length, "characters");
    console.log("   Finish reason:", finishReason);

    // If no tokens found through LangChain patterns, try direct OpenAI as fallback
    if (tokenUsage.totalTokens === 0) {
      console.log("⚠️ No token data found via LangChain-JS, trying direct OpenAI API as fallback");
      try {
        const openaiResponse = await openaiClient.chat.completions.create({
          model: process.env.AI_MODEL || "gpt-5-2025-08-07",
          messages: [
            { role: "system", content: "You are a helpful assistant. Provide clear, accurate, and concise responses." },
            { role: "user", content: input }
          ],
          temperature: 0,
          max_tokens: 1000,
        });

        const usage = openaiResponse.usage;
        const fallbackTokens = {
          inputTokens: usage?.prompt_tokens || 0,
          outputTokens: usage?.completion_tokens || 0,
          totalTokens: usage?.total_tokens || 0
        };

        console.log("   Fallback token usage (direct OpenAI):", fallbackTokens);
        return {
          text,
          tokensUsed: fallbackTokens.totalTokens,
          inputTokens: fallbackTokens.inputTokens,
          outputTokens: fallbackTokens.outputTokens,
          responseTime,
          finishReason
        };
      } catch (fallbackError) {
        console.log("   ❌ Fallback OpenAI call also failed:", fallbackError);
      }
    }

    return {
      text,
      tokensUsed: tokenUsage.totalTokens,
      inputTokens: tokenUsage.inputTokens,
      outputTokens: tokenUsage.outputTokens,
      responseTime,
      finishReason
    };

  } catch (error: any) {
    const responseTime = Date.now() - startTime;

    console.error("❌ LangChain-JS Error Details:");
    console.error("   Message:", error?.message);
    console.error("   Name:", error?.name);
    console.error("   Status:", error?.status);
    console.error("   Response time:", responseTime, "ms");

    // Provide specific error messages based on error type
    let errorMessage = "Sorry, I encountered an error processing your request.";

    if (error?.message?.includes("API key")) {
      errorMessage = "Authentication error: Please check your OpenAI API key configuration.";
    } else if (error?.message?.includes("model")) {
      errorMessage = "Model error: The specified AI model is not available or invalid.";
    } else if (error?.message?.includes("rate limit")) {
      errorMessage = "Rate limit exceeded: Please wait a moment before trying again.";
    } else if (error?.message?.includes("timeout")) {
      errorMessage = "Request timeout: The AI service took too long to respond.";
    } else if (error?.status === 429) {
      errorMessage = "Too many requests: Please try again in a few moments.";
    } else if (error?.status === 401) {
      errorMessage = "Authentication failed: Please check your API key.";
    }

    return {
      text: errorMessage,
      tokensUsed: 0,
      inputTokens: 0,
      outputTokens: 0,
      responseTime,
      finishReason: "error"
    };
  }
}


