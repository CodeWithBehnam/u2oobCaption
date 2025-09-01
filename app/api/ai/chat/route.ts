import { NextRequest } from "next/server";
import { generateCompletion } from "@/lib/ai/chain";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const input = typeof body?.input === "string" ? body.input : "";
  if (!input) {
    return new Response(JSON.stringify({ error: "Missing input" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  try {
    const text = await generateCompletion(input);
    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || "Error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}


