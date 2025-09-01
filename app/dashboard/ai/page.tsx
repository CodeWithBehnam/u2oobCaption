"use client"

import { useState, useEffect, useRef } from "react"
import { useUser } from "@clerk/nextjs"
import { useMutation, useQuery, useConvexAuth } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// import { ScrollArea } from "@/components/ui/scroll-area" // Not available, using div instead
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { MessageSquare, Plus, Trash2, Bot, User, RefreshCw } from "lucide-react"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: number
  model?: string
  tokensUsed?: number
  inputTokens?: number
  outputTokens?: number
  responseTime?: number
  finishReason?: string
}

export default function AIPage() {
  const { user } = useUser()
  const { isAuthenticated } = useConvexAuth()

  // State management
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [currentConversationId, setCurrentConversationId] = useState<string>("")

  // Convex mutations and queries
  const saveMessage = useMutation(api.chat.saveMessage)
  const generateConversationIdMutation = useMutation(api.chat.generateConversationId)
  const getUserConversations = useQuery(api.chat.getUserConversations)
  const getConversationMessages = useQuery(api.chat.getConversationMessages, {
    conversationId: currentConversationId || ""
  })
  const deleteConversationMutation = useMutation(api.chat.deleteConversation)
  const regenerateTitleMutation = useMutation(api.chat.regenerateConversationTitle)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Initialize new conversation on load
  useEffect(() => {
    if (!currentConversationId) {
      startNewConversation()
    }
  }, [currentConversationId])

  // Load messages when conversation changes
  useEffect(() => {
    if (getConversationMessages && currentConversationId) {
      const loadedMessages = getConversationMessages.map(msg => ({
        id: msg._id,
        role: msg.role,
        content: msg.content,
        timestamp: msg._creationTime,
        model: msg.model,
        tokensUsed: msg.tokensUsed,
        responseTime: msg.responseTime,
      }))
      setMessages(loadedMessages)
    }
  }, [getConversationMessages, currentConversationId])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const startNewConversation = async () => {
    try {
      const newConversationId = await generateConversationIdMutation()
      setCurrentConversationId(newConversationId)
      setMessages([])
    } catch (error) {
      console.error("Failed to generate conversation ID:", error)
    }
  }

  const switchConversation = async (conversationId: string) => {
    setCurrentConversationId(conversationId)
  }

  const deleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering switch conversation
    try {
      await deleteConversationMutation({ conversationId })
      // If we're deleting the current conversation, start a new one
      if (conversationId === currentConversationId) {
        await startNewConversation()
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error)
    }
  }

  const regenerateTitle = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering switch conversation
    try {
      await regenerateTitleMutation({ conversationId })
    } catch (error) {
      console.error("Failed to regenerate title:", error)
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !user?.id || loading) return

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    }

    // Add user message to chat
    setMessages(prev => [...prev, userMessage])

    const messageContent = input.trim()
    setInput("")
    setLoading(true)

    try {
      // Debug logging
      console.log("User authenticated:", !!user)
      console.log("Current conversation ID:", currentConversationId)
      console.log("Message content:", messageContent)

      // Save user message to Convex
      await saveMessage({
        role: "user",
        content: messageContent,
        conversationId: currentConversationId,
        model: process.env.AI_MODEL || "gpt-4.1-nano-2025-04-14",
        metadata: {
          userAgent: navigator.userAgent,
          sessionId: currentConversationId,
          timestamp: Date.now(),
        },
      })

      // Get AI response with token tracking
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input: messageContent,
          conversationId: currentConversationId
        }),
      })

      if (!res.ok) {
        throw new Error("Failed to get response from AI")
      }

      const responseData = await res.json()

      if (responseData.error) {
        throw new Error(responseData.error)
      }

      const assistantResponse = responseData.text
      const tokensUsed = responseData.tokensUsed || 0
      const inputTokens = responseData.inputTokens || 0
      const outputTokens = responseData.outputTokens || 0
      const responseTime = responseData.responseTime || 0
      const finishReason = responseData.finishReason || "stop"

      // Add assistant message to chat
      const assistantMessage: ChatMessage = {
        id: `assistant_${Date.now()}`,
        role: "assistant",
        content: assistantResponse,
        timestamp: Date.now(),
        model: process.env.AI_MODEL || "gpt-4.1-nano-2025-04-14",
        tokensUsed,
        inputTokens,
        outputTokens,
        responseTime,
        finishReason,
      }

      setMessages(prev => [...prev, assistantMessage])

      // Save assistant message to Convex
      await saveMessage({
        role: "assistant",
        content: assistantResponse,
        conversationId: currentConversationId,
        model: process.env.AI_MODEL || "gpt-4.1-nano-2025-04-14",
        tokensUsed,
        responseTime,
        metadata: {
          userAgent: navigator.userAgent,
          sessionId: currentConversationId,
          timestamp: Date.now(),
        },
      })

    } catch (error: any) {
      console.error("Detailed error:", error)
      console.error("Error message:", error?.message)
      console.error("Error stack:", error?.stack)

      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        role: "assistant",
        content: `Error: ${error?.message || "Unknown error occurred"}. Please try again.`,
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please sign in to use the AI assistant.</p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Sidebar for conversation management */}
      <Card className="w-80 flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Conversations
          </CardTitle>
          <Button
            onClick={startNewConversation}
            size="sm"
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        </CardHeader>
        <CardContent className="flex-1 p-0">
          <div className="h-full overflow-y-auto">
            <div className="p-4 space-y-2">
              <div className="text-sm text-muted-foreground">
                Current: {getUserConversations?.find(c => c.conversationId === currentConversationId)?.lastMessage?.conversationTitle || "New Chat"}
              </div>
              <Separator />
              <div className="text-xs text-muted-foreground mb-3">
                Messages: {messages.length} | Status: {loading ? "Typing..." : "Ready"}
              </div>

              {/* Conversation History */}
              <div className="space-y-1">
                {getUserConversations?.map((conversation) => (
                  <div
                    key={conversation.conversationId}
                    className={`group p-2 rounded-md cursor-pointer hover:bg-muted transition-colors ${
                      conversation.conversationId === currentConversationId
                        ? "bg-muted border border-primary/20"
                        : ""
                    }`}
                    onClick={() => switchConversation(conversation.conversationId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {conversation.lastMessage?.conversationTitle || `Chat ${conversation.conversationId.slice(0, 8)}...`}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {conversation.messageCount} messages • {new Date(conversation.createdAt).toLocaleDateString()}
                        </div>
                        {conversation.lastMessage && (
                          <div className="text-xs text-muted-foreground truncate mt-1">
                            {conversation.lastMessage.content.slice(0, 30)}...
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="neutral"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-blue-500 hover:text-white"
                          onClick={(e) => regenerateTitle(conversation.conversationId, e)}
                          title="Regenerate title"
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="neutral"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                          onClick={(e) => deleteConversation(conversation.conversationId, e)}
                          title="Delete conversation"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )) || (
                  <div className="text-xs text-muted-foreground text-center py-4">
                    No conversations yet
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main chat area */}
      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              AI Assistant
            </div>
            <Badge>
              {process.env.AI_MODEL || "gpt-4.1-nano-2025-04-14"}
            </Badge>
          </CardTitle>
        </CardHeader>

        {/* Messages area */}
        <CardContent className="flex-1 flex flex-col p-0">
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Start a conversation with the AI assistant!</p>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}

                  <div
                    className={`max-w-[70%] rounded-lg px-3 py-2 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground ml-auto"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    {message.responseTime && message.role === "assistant" && (
                      <div className="text-xs opacity-70 mt-1 space-y-1">
                        <div className="flex gap-2 text-xs">
                          <span>{message.responseTime}ms</span>
                          <span>•</span>
                          <span>{message.tokensUsed || 0} total tokens</span>
                          {(message.inputTokens || message.outputTokens) && (
                            <>
                              <span>•</span>
                              <span>{message.inputTokens || 0} in / {message.outputTokens || 0} out</span>
                            </>
                          )}
                        </div>
                        {message.finishReason && message.finishReason !== "stop" && (
                          <div className="text-xs opacity-60">
                            Finish reason: {message.finishReason}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {message.role === "user" && (
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}



              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input area */}
          <div className="p-4 border-t">
            <form onSubmit={onSubmit} className="flex gap-2">
              <input
                className="flex-1 rounded-md border px-3 py-2 text-sm"
                placeholder="Type your message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
              />
              <Button type="submit" disabled={loading || !input.trim()}>
                {loading ? "Sending..." : "Send"}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


