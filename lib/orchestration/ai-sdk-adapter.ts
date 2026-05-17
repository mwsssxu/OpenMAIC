/**
 * AI SDK Adapter for LangGraph
 *
 * Provides LangChain-compatible interface for LLM calls.
 * Uses the unified callLLM / streamLLM layer which goes through
 * Vercel AI SDK, supporting all providers (OpenAI, Anthropic, Google, etc.).
 */

import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import { ChatResult } from '@langchain/core/outputs';
import type { LanguageModel } from 'ai';

import { callLLM, streamLLM } from '@/lib/ai/llm';
import type { ThinkingConfig } from '@/lib/types/provider';
import { createLogger } from '@/lib/logger';

const log = createLogger('AISdkAdapter');

/**
 * Stream chunk types for streaming generation
 */
export type StreamChunk =
  | { type: 'delta'; content: string }
  | {
      type: 'tool_calls';
      toolCalls: {
        id: string;
        index: number;
        type: 'function';
        function: { name: string; arguments: string };
      }[];
    }
  | { type: 'done'; content: string };

/**
 * Adapter to use any AI SDK LanguageModel with LangGraph
 *
 * Accepts a LanguageModel instance (from getModel()) instead of raw
 * API credentials, enabling support for all providers.
 */
export class AISdkLangGraphAdapter extends BaseChatModel {
  private languageModel: LanguageModel;
  private thinking?: ThinkingConfig;

  constructor(languageModel: LanguageModel, thinking?: ThinkingConfig) {
    super({});
    this.languageModel = languageModel;
    this.thinking = thinking;
  }

  _llmType(): string {
    return 'ai-sdk';
  }

  _combineLLMOutput() {
    return {};
  }

  /**
   * Convert LangChain messages to AI SDK message format
   * Only handles user/assistant messages — system is passed separately.
   */
  private convertMessages(
    messages: BaseMessage[],
  ): { role: 'user' | 'assistant'; content: string }[] {
    return messages
      .filter((msg) => !(msg instanceof SystemMessage))
      .map((msg) => {
        if (msg instanceof HumanMessage) {
          return { role: 'user' as const, content: msg.content as string };
        } else if (msg instanceof AIMessage) {
          return { role: 'assistant' as const, content: msg.content as string };
        } else {
          return { role: 'user' as const, content: msg.content as string };
        }
      });
  }

  /**
   * Extract system prompt from messages array.
   * Returns the content of the first SystemMessage, or undefined.
   */
  private extractSystemPrompt(messages: BaseMessage[]): string | undefined {
    const systemMessage = messages.find((m) => m instanceof SystemMessage);
    return systemMessage ? (systemMessage.content as string) : undefined;
  }

  async _generate(
    messages: BaseMessage[],
    _options?: this['ParsedCallOptions'],
    _runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    // Extract system prompt and pass separately to AI SDK
    const systemPrompt = this.extractSystemPrompt(messages);
    const aiMessages = this.convertMessages(messages);

    try {
      const result = await callLLM(
        {
          model: this.languageModel,
          system: systemPrompt,
          messages: aiMessages,
        },
        'chat-adapter',
        undefined,
        this.thinking,
      );

      const content = result.text || '';

      log.info('[AI SDK Adapter] Response:', {
        textLength: content.length,
      });

      // Create AI message
      const aiMessage = new AIMessage({ content });

      return {
        generations: [
          {
            text: content,
            message: aiMessage,
          },
        ],
        llmOutput: {},
      };
    } catch (error) {
      log.error('[AI SDK Adapter Error]', error);
      throw error;
    }
  }

  /**
   * Stream generate with text deltas
   *
   * Yields chunks of text as they arrive, then yields done with full content.
   * Uses streamLLM which goes through Vercel AI SDK's streamText.
   */
  async *streamGenerate(
    messages: BaseMessage[],
    options?: { tools?: Record<string, unknown>; signal?: AbortSignal },
  ): AsyncGenerator<StreamChunk> {
    // Extract system prompt and pass separately to AI SDK
    const systemPrompt = this.extractSystemPrompt(messages);
    const aiMessages = this.convertMessages(messages);

    const result = streamLLM(
      {
        model: this.languageModel,
        system: systemPrompt,
        messages: aiMessages,
        abortSignal: options?.signal,
      },
      'chat-adapter-stream',
      this.thinking,
    );

    let fullContent = '';

    for await (const chunk of result.textStream) {
      if (chunk) {
        fullContent += chunk;
        yield { type: 'delta', content: chunk };
      }
    }

    // Yield done with full content
    yield { type: 'done', content: fullContent };
  }
}
