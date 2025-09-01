import { v } from "convex/values";
import { mutation, query, internalAction } from "./_generated/server";
import { getCurrentUser } from "./users";
import { internal } from "./_generated/api";

/**
 * Save a chat message to the database
 */
export const saveMessage = mutation({
  args: {
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    conversationId: v.string(),
    model: v.string(),
    tokensUsed: v.optional(v.number()),
    responseTime: v.optional(v.number()),
    metadata: v.optional(v.object({
      userAgent: v.optional(v.string()),
      ipAddress: v.optional(v.string()),
      sessionId: v.optional(v.string()),
      timestamp: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("User not authenticated");
    }

    // Generate conversation title for the first user message
    let conversationTitle = undefined;
    if (args.role === "user") {
      const existingMessages = await ctx.db
        .query("chatMessages")
        .withIndex("byConversation", (q) => q.eq("conversationId", args.conversationId))
        .collect();

      // Only generate title for the first user message
      if (existingMessages.length === 0) {
        conversationTitle = await generateConversationTitle(ctx, args.content);
      } else {
        // Use existing title if available
        const existingTitle = existingMessages.find(msg => msg.conversationTitle)?.conversationTitle;
        conversationTitle = existingTitle;
      }
    } else {
      // For assistant messages, get the title from existing messages
      const existingMessages = await ctx.db
        .query("chatMessages")
        .withIndex("byConversation", (q) => q.eq("conversationId", args.conversationId))
        .collect();

      const existingTitle = existingMessages.find(msg => msg.conversationTitle)?.conversationTitle;
      conversationTitle = existingTitle;
    }

    const messageId = await ctx.db.insert("chatMessages", {
      userId: user._id,
      role: args.role,
      content: args.content,
      conversationId: args.conversationId,
      conversationTitle,
      model: args.model,
      tokensUsed: args.tokensUsed,
      responseTime: args.responseTime,
      metadata: args.metadata,
    });

    return messageId;
  },
});

/**
 * Get all messages for a specific conversation
 */
export const getConversationMessages = query({
  args: {
    conversationId: v.string(),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("byConversation", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .collect();

    return messages;
  },
});

/**
 * Get all conversations for a user
 */
export const getUserConversations = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return [];
    }

    // Get all messages for the user, grouped by conversation
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("byUser", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    // Group messages by conversationId and get the latest message for each
    const conversationsMap = new Map<string, any>();

    for (const message of messages) {
      if (!conversationsMap.has(message.conversationId)) {
        conversationsMap.set(message.conversationId, {
          conversationId: message.conversationId,
          lastMessage: message,
          messageCount: 0,
          createdAt: message._creationTime,
        });
      }
      conversationsMap.get(message.conversationId)!.messageCount++;
    }

    return Array.from(conversationsMap.values()).sort(
      (a, b) => b.createdAt - a.createdAt
    );
  },
});

/**
 * Delete a conversation and all its messages
 */
export const deleteConversation = mutation({
  args: {
    conversationId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("User not authenticated");
    }

    // Get all messages in the conversation
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("byConversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    // Verify user owns the conversation
    const userMessages = messages.filter(msg => msg.userId === user._id);
    if (userMessages.length === 0) {
      throw new Error("Conversation not found or access denied");
    }

    // Delete all messages in the conversation
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    return { deleted: messages.length };
  },
});

/**
 * Get conversation statistics for a user
 */
export const getUserChatStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return {
        totalMessages: 0,
        totalConversations: 0,
        totalTokensUsed: 0,
        averageResponseTime: 0,
        lastActivity: null,
      };
    }

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("byUser", (q) => q.eq("userId", user._id))
      .collect();

    const stats = {
      totalMessages: messages.length,
      totalConversations: new Set(messages.map(m => m.conversationId)).size,
      totalTokensUsed: messages.reduce((sum, m) => sum + (m.tokensUsed || 0), 0),
      averageResponseTime: messages
        .filter(m => m.responseTime)
        .reduce((sum, m, _, arr) => sum + (m.responseTime || 0), 0) / messages.filter(m => m.responseTime).length || 0,
      lastActivity: messages.length > 0 ? Math.max(...messages.map(m => m._creationTime)) : null,
    };

    return stats;
  },
});

/**
 * Generate a new conversation ID
 */
export const generateConversationId = mutation({
  args: {},
  handler: async () => {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },
});

/**
 * Generate a meaningful conversation title using AI
 */
async function generateConversationTitle(ctx: any, userMessage: string): Promise<string> {
  try {
    // Use the generateTitle internal action for title generation
    const title = await ctx.runAction(internal.chat.generateTitle, {
      prompt: `Generate a title for this conversation: ${userMessage}`
    });

    // Clean up the response and ensure it's not too long
    const cleanTitle = title?.trim() || "New Conversation";

    // Limit to 50 characters and ensure it doesn't end with punctuation
    let finalTitle = cleanTitle.length > 50 ? cleanTitle.substring(0, 47) + "..." : cleanTitle;
    finalTitle = finalTitle.replace(/[.!?]$/, ""); // Remove trailing punctuation

    return finalTitle || "New Conversation";

  } catch (error) {
    console.error("Failed to generate conversation title:", error);
    return "New Conversation";
  }
}

/**
 * Generate a conversation title using AI (internal action)
 */
export const generateTitle = internalAction({
  args: {
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    // Simple title generation - in a real implementation, you'd call an AI service
    // For now, we'll create a basic title based on keywords

    const message = args.prompt.toLowerCase();

    // Extract key topics/keywords
    const keywords = [
      "help", "question", "explain", "how", "what", "why", "code", "programming",
      "design", "business", "writing", "analysis", "research", "learning"
    ];

    let foundKeywords: string[] = [];

    for (const keyword of keywords) {
      if (message.includes(keyword)) {
        foundKeywords.push(keyword);
      }
    }

    // Generate title based on found keywords
    if (foundKeywords.length > 0) {
      const primaryKeyword = foundKeywords[0];
      return primaryKeyword.charAt(0).toUpperCase() + primaryKeyword.slice(1) + " Discussion";
    }

    // Fallback titles based on message patterns
    if (message.includes("create") || message.includes("build") || message.includes("make")) {
      return "Project Creation";
    }
    if (message.includes("fix") || message.includes("debug") || message.includes("error")) {
      return "Problem Solving";
    }
    if (message.includes("learn") || message.includes("teach") || message.includes("tutorial")) {
      return "Learning Session";
    }

    // Default fallback
    return "General Discussion";
  },
});

/**
 * Regenerate conversation title for an existing conversation
 */
export const regenerateConversationTitle = mutation({
  args: {
    conversationId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      throw new Error("User not authenticated");
    }

    // Get the first user message from the conversation
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("byConversation", (q) => q.eq("conversationId", args.conversationId))
      .filter((q) => q.eq(q.field("role"), "user"))
      .order("asc")
      .take(1);

    if (messages.length === 0) {
      throw new Error("No user messages found in conversation");
    }

    const firstMessage = messages[0];
    const newTitle = await generateConversationTitle(ctx, firstMessage.content);

    // Update all messages in the conversation with the new title
    const allMessages = await ctx.db
      .query("chatMessages")
      .withIndex("byConversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    for (const message of allMessages) {
      await ctx.db.patch(message._id, { conversationTitle: newTitle });
    }

    return newTitle;
  },
});
