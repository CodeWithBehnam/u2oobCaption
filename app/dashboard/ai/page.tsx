"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"

export default function AIPage() {
  const [input, setInput] = useState("")
  const [output, setOutput] = useState("")
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input) return
    setLoading(true)
    setOutput("")
    const res = await fetch("/api/ai/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input }),
    })
    if (!res.ok || !res.body) {
      setLoading(false)
      return
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      setOutput((prev) => prev + decoder.decode(value))
    }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          className="flex-1 rounded-md border px-3 py-2"
          placeholder="Ask the assistant..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button type="submit" disabled={loading}>{loading ? "Asking..." : "Ask"}</Button>
      </form>
      <pre className="whitespace-pre-wrap text-sm p-3 border rounded-md min-h-24">{output}</pre>
    </div>
  )
}


