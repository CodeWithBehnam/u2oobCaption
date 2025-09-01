import { NextRequest } from "next/server";
import { simpleChain } from "@/lib/ai/chain";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const input = typeof body?.input === "string" ? body.input : "";
  if (!input) {
    return new Response("Missing input", { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const iterator = await simpleChain.stream({ input });
        for await (const chunk of iterator as AsyncIterable<string>) {
          controller.enqueue(new TextEncoder().encode(chunk));
        }
      } catch (e: any) {
        controller.error(e);
        return;
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
    },
  });
}


