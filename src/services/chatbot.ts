import Anthropic from "@anthropic-ai/sdk";
import { config } from "../lib/config";
import { db } from "../lib/db";

const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

const DR_PATEL_SYSTEM_PROMPT = `You are Dr. Patel's AI medical assistant at Valley Weight Loss (VWL). 
You communicate via text message on behalf of the physician-led weight loss clinic.

Your role:
- Answer questions about VWL's weight loss programs, medications (semaglutide, tirzepatide), 
  pricing, eligibility, and the consultation process
- Be warm, professional, and reassuring
- Encourage patients to attend their consultation or take next steps toward enrollment
- Handle common objections (cost concerns, medication fears, skepticism)
- If you cannot answer a medical question with confidence, say you'll have Dr. Patel 
  follow up personally

Tone: Friendly, knowledgeable, never pushy. You're a helpful medical professional, 
not a salesperson. Keep responses concise — this is SMS, not email.

Important context:
- VWL is physician-led — not an app or telehealth mill
- Consultations are free
- Programs include FDA-approved GLP-1 medications
- Monthly pricing varies by medication and plan

If the patient seems disengaged or unresponsive after 2+ messages, back off gracefully. 
Never spam.`;

interface ChatContext {
  patientId: string;
  conversationContext: string; // "pre_consult" | "post_consult" | "no_show_recovery"
}

/**
 * Process an incoming patient message and generate Dr. Patel's response.
 */
export async function generateResponse(
  patientMessage: string,
  context: ChatContext
): Promise<string> {
  // Load or create conversation
  let conversation = await db.conversation.findFirst({
    where: {
      patientId: context.patientId,
      context: context.conversationContext,
      active: true,
    },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 20 } },
  });

  if (!conversation) {
    conversation = await db.conversation.create({
      data: {
        patientId: context.patientId,
        context: context.conversationContext,
      },
      include: { messages: true },
    });
  }

  // Save patient message
  await db.conversationMessage.create({
    data: {
      conversationId: conversation.id,
      role: "user",
      content: patientMessage,
    },
  });

  // Build message history for Claude
  const messages: Anthropic.MessageParam[] = conversation.messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  messages.push({ role: "user", content: patientMessage });

  // Generate response
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 300, // Keep SMS-length
    system: DR_PATEL_SYSTEM_PROMPT,
    messages,
  });

  const assistantMessage =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Save assistant response
  await db.conversationMessage.create({
    data: {
      conversationId: conversation.id,
      role: "assistant",
      content: assistantMessage,
    },
  });

  return assistantMessage;
}

/**
 * Send a proactive chatbot message (e.g. post-consult follow-up, no-show outreach).
 * Returns the generated message text.
 */
export async function generateProactiveMessage(
  context: ChatContext,
  prompt: string
): Promise<string> {
  const patient = await db.patient.findUnique({
    where: { id: context.patientId },
  });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 300,
    system: DR_PATEL_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `[SYSTEM: Generate a proactive text message for patient ${patient?.name || "there"}. Context: ${prompt}. Write ONLY the message text, nothing else.]`,
      },
    ],
  });

  const message =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Save to conversation
  let conversation = await db.conversation.findFirst({
    where: {
      patientId: context.patientId,
      context: context.conversationContext,
      active: true,
    },
  });

  if (!conversation) {
    conversation = await db.conversation.create({
      data: {
        patientId: context.patientId,
        context: context.conversationContext,
      },
    });
  }

  await db.conversationMessage.create({
    data: {
      conversationId: conversation.id,
      role: "assistant",
      content: message,
    },
  });

  return message;
}
