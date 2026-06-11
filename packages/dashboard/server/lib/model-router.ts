/**
 * Multi-model streaming router — one async-generator interface over
 * Anthropic, OpenAI, and Google Gemini chat models.
 *
 *   for await (const token of streamChat({ modelId, system, messages })) ...
 *
 * Provider quirks normalized here so callers never see them:
 *   - Gemini uses role 'model' (not 'assistant') and takes the system prompt
 *     as a separate systemInstruction, never inside contents.
 *   - GoogleGenerativeAI has NO env fallback for its api key (unlike the
 *     Anthropic/OpenAI clients) — availability is checked explicitly.
 *   - Gemini stream abort is client-side only: generation continues (and
 *     bills) server-side after disconnect. Acceptable for a solo tool.
 *
 * Env keys are read lazily inside functions — index.ts loads .env AFTER
 * module imports, so module-scope process.env reads would be undefined.
 */
import { CHAT_MODELS, type ChatModelId, type ChatProvider } from "../../shared/types.js";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type StreamChatInput = {
  modelId: ChatModelId;
  system: string;
  messages: ChatTurn[];
  maxTokens?: number;
  signal?: AbortSignal;
};

const PROVIDER_ENV: Record<ChatProvider, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GEMINI_API_KEY",
};

export function providerForModel(modelId: string): ChatProvider | null {
  return CHAT_MODELS.find((m) => m.id === modelId)?.provider ?? null;
}

/** Which models are usable given the keys present in env. */
export function availableModels(): Array<{ id: ChatModelId; label: string; provider: ChatProvider }> {
  return CHAT_MODELS.filter((m) => Boolean(process.env[PROVIDER_ENV[m.provider]])).map((m) => ({
    id: m.id,
    label: m.label,
    provider: m.provider,
  }));
}

export async function* streamChat(input: StreamChatInput): AsyncGenerator<string> {
  const provider = providerForModel(input.modelId);
  if (!provider) throw new Error(`unknown model: ${input.modelId}`);
  if (!process.env[PROVIDER_ENV[provider]]) {
    throw new Error(`${PROVIDER_ENV[provider]} not configured for model ${input.modelId}`);
  }

  switch (provider) {
    case "anthropic": yield* streamAnthropic(input); break;
    case "openai":    yield* streamOpenAI(input); break;
    case "google":    yield* streamGemini(input); break;
  }
}

async function* streamAnthropic(input: StreamChatInput): AsyncGenerator<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const stream = client.messages.stream(
    {
      model: input.modelId,
      max_tokens: input.maxTokens ?? 4000,
      system: input.system,
      messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
    },
    { signal: input.signal },
  );

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}

async function* streamOpenAI(input: StreamChatInput): AsyncGenerator<string> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI();
  const stream = await client.chat.completions.create(
    {
      model: input.modelId,
      stream: true,
      messages: [
        { role: "system" as const, content: input.system },
        ...input.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    },
    { signal: input.signal },
  );

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) yield text;
  }
}

async function* streamGemini(input: StreamChatInput): AsyncGenerator<string> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
  const model = genai.getGenerativeModel({
    model: input.modelId,
    systemInstruction: input.system,
  });

  const result = await model.generateContentStream(
    {
      contents: input.messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    },
    { signal: input.signal },
  );

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}
