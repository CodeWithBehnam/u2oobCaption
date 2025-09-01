import { NextRequest } from "next/server";
import { generateCompletion, generateCompletionWithTokens } from "@/lib/ai/chain";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const input = typeof body?.input === "string" ? body.input : "";
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId : "";

  if (!input) {
    return new Response(JSON.stringify({ error: "Missing input" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    // Add metadata to track conversation context
    const enhancedInput = conversationId
      ? `[Conversation: ${conversationId}]\n${input}`
      : input;

    const result = await generateCompletionWithTokens(enhancedInput);
    return new Response(JSON.stringify({
      text: result.text,
      conversationId,
      timestamp: Date.now(),
      model: process.env.AI_MODEL || "gpt-4.1-nano-2025-04-14",
      tokensUsed: result.tokensUsed,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      responseTime: result.responseTime,
      finishReason: result.finishReason
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error?.message || "Error",
      conversationId,
      timestamp: Date.now(),
      tokensUsed: 0,
      inputTokens: 0,
      outputTokens: 0,
      responseTime: 0,
      finishReason: "error"
    }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}


