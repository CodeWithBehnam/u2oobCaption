import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { paymentAttemptSchemaValidator } from "./paymentAttemptTypes";

export default defineSchema({
    users: defineTable({
      name: v.string(),
      // this the Clerk ID, stored in the subject JWT field
      externalId: v.string(),
    }).index("byExternalId", ["externalId"]),

    paymentAttempts: defineTable(paymentAttemptSchemaValidator)
      .index("byPaymentId", ["payment_id"])
      .index("byUserId", ["userId"])
      .index("byPayerUserId", ["payer.user_id"]),

    chatMessages: defineTable({
      userId: v.id("users"),
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
      conversationId: v.string(),
      conversationTitle: v.optional(v.string()),
      model: v.string(),
      tokensUsed: v.optional(v.number()),
      responseTime: v.optional(v.number()),
      metadata: v.optional(v.object({
        userAgent: v.optional(v.string()),
        ipAddress: v.optional(v.string()),
        sessionId: v.optional(v.string()),
        timestamp: v.optional(v.number()),
      })),
    })
    .index("byUser", ["userId"])
    .index("byConversation", ["conversationId"])
    .index("byUserAndConversation", ["userId", "conversationId"]),
  });