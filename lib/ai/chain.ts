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
  modelName: process.env.AI_MODEL || "gpt-4.1-nano-2025-04-14",
  temperature: 0,
  openAIApiKey: process.env.OPENAI_API_KEY,
  maxTokens: 1000,
  timeout: 30000, // 30 second timeout
  // Enable token tracking in callbacks
  callbacks: [callbackHandler],
  // Ensure token usage is included in responses
  verbose: true,
});

// Initialize direct OpenAI client for token tracking
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Debug logging
console.log("🤖 LangChain-JS AI Configuration:");
console.log("   Model:", process.env.AI_MODEL || "gpt-4.1-nano-2025-04-14");
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

// Token extraction utility following LangChain-JS patterns
function extractTokenUsage(response: any): { inputTokens: number; outputTokens: number; totalTokens: number } {
  console.log("🔍 Token extraction debug:");
  console.log("   Response type:", typeof response);
  console.log("   Response keys:", Object.keys(response || {}));
  console.log("   Response structure:", JSON.stringify(response, null, 2).substring(0, 500));

  // Try different possible locations for token usage in LangChain-JS OpenAI responses
  const usage = response?.usage ||
                response?.response_metadata?.usage ||
                response?.llmOutput?.tokenUsage ||
                response?.llmOutput?.usage;

  console.log("   Usage object found:", !!usage);
  if (usage) {
    console.log("   Usage details:", usage);
  }

  if (usage) {
    return {
      inputTokens: usage.prompt_tokens || usage.input_tokens || 0,
      outputTokens: usage.completion_tokens || usage.output_tokens || 0,
      totalTokens: usage.total_tokens || (usage.prompt_tokens + usage.completion_tokens) || 0
    };
  }

  // Try to get usage from response_metadata
  const responseMetadata = response?.response_metadata;
  if (responseMetadata) {
    console.log("   Response metadata:", responseMetadata);
    const metaUsage = responseMetadata.usage || responseMetadata.tokenUsage;
    if (metaUsage) {
      return {
        inputTokens: metaUsage.prompt_tokens || metaUsage.input_tokens || 0,
        outputTokens: metaUsage.completion_tokens || metaUsage.output_tokens || 0,
        totalTokens: metaUsage.total_tokens || 0
      };
    }
  }

  // Last resort: try to find any token-related data
  if (response && typeof response === 'object') {
    for (const [key, value] of Object.entries(response)) {
      if (key.toLowerCase().includes('token') && typeof value === 'object' && value) {
        console.log("   Found token-related data:", key, value);
        const tokenData = value as any;
        return {
          inputTokens: tokenData.prompt_tokens || tokenData.input_tokens || 0,
          outputTokens: tokenData.completion_tokens || tokenData.output_tokens || 0,
          totalTokens: tokenData.total_tokens || 0
        };
      }
    }
  }

  console.log("   No token usage found, using fallback estimation");
  // Fallback estimation if no usage data available
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

    console.log("🚀 Making AI request with LangChain-JS:");
    console.log("   Input length:", input.length, "characters");
    console.log("   Model:", process.env.AI_MODEL || "gpt-4.1-nano-2025-04-14");

    // Use direct OpenAI API call to get token usage
    console.log("📡 Making direct OpenAI API call for token tracking");
    const openaiResponse = await openaiClient.chat.completions.create({
      model: process.env.AI_MODEL || "gpt-4.1-nano-2025-04-14",
      messages: [
        { role: "system", content: "You are a helpful assistant. Provide clear, accurate, and concise responses." },
        { role: "user", content: input }
      ],
      temperature: 0,
      max_tokens: 1000,
    });

    const responseTime = Date.now() - startTime;
    const text = openaiResponse.choices[0]?.message?.content || "";
    const finishReason = openaiResponse.choices[0]?.finish_reason || "stop";

    // Get actual token usage from OpenAI response
    const usage = openaiResponse.usage;
    const tokenUsage = {
      inputTokens: usage?.prompt_tokens || 0,
      outputTokens: usage?.completion_tokens || 0,
      totalTokens: usage?.total_tokens || 0
    };

    console.log("✅ AI response successful:");
    console.log("   Response time:", responseTime, "ms");
    console.log("   Token usage:", tokenUsage);
    console.log("   Text length:", text.length, "characters");
    console.log("   Finish reason:", finishReason);

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


