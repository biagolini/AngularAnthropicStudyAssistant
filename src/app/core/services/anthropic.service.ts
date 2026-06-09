import { Injectable } from '@angular/core';
import { MCP_BETA_HEADER, McpServerEntry } from '../models/mcp.model';
import { DEFAULT_MODEL, isAwsApiKey } from '../models/settings.model';
import { PackContext, buildSystemPrompt } from '../utils/review-prompt.util';
import { buildTranscriptScriptPrompt } from '../utils/transcript-prompt.util';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_TOKENS = 2000;

interface AnthropicTextBlock {
  type: 'text';
  text: string;
}

interface AnthropicResponse {
  content?: Array<AnthropicTextBlock | { type: string }>;
  error?: { type?: string; message?: string };
}

export interface AwsRoutingOptions {
  workspaceId: string;
  region: string;
}

export interface CallExtras {
  enableWebSearch?: boolean;
  mcpServers?: McpServerEntry[];
}

@Injectable({ providedIn: 'root' })
export class AnthropicService {
  async refineReview(
    currentReview: string,
    feedback: string,
    apiKey: string,
    pack: PackContext,
    aws?: AwsRoutingOptions,
    model?: string,
    outputLanguage?: string,
  ): Promise<string> {
    const trimmedFeedback = feedback.trim();
    if (!trimmedFeedback) throw new Error('Feedback cannot be empty.');
    if (!currentReview.trim()) throw new Error('No review to refine.');

    const system = buildSystemPrompt(pack, outputLanguage);
    const userMessage = `You previously generated the exam review below. Refine it based on the user's feedback while keeping the SAME OUTPUT FORMAT specified in your instructions.

=== CURRENT REVIEW ===
${currentReview}

=== USER FEEDBACK ===
${trimmedFeedback}

Return the FULL refined review. Apply only the changes needed to address the feedback; preserve everything else.`;

    return this.callMessages(
      apiKey,
      aws,
      system,
      [{ role: 'user', content: userMessage }],
      model,
    );
  }

  async testConnection(apiKey: string, aws?: AwsRoutingOptions): Promise<void> {
    if (!apiKey) throw new Error('Missing API key.');
    const useAws = isAwsApiKey(apiKey);
    if (useAws && (!aws?.workspaceId || !aws.region)) {
      throw new Error('Workspace ID and region are required for AWS keys.');
    }

    const base = useAws
      ? `https://aws-external-anthropic.${aws!.region}.api.aws`
      : 'https://api.anthropic.com';
    const headers: Record<string, string> = {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    };
    if (useAws) {
      headers['anthropic-workspace-id'] = aws!.workspaceId;
    } else {
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
    }

    const response = await fetch(`${base}/v1/models?limit=1`, { method: 'GET', headers });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as AnthropicResponse | null;
      const message = data?.error?.message ?? `Request failed with status ${response.status}.`;
      throw new Error(message);
    }
  }

  async generateReview(
    question: string,
    apiKey: string,
    pack: PackContext,
    aws?: AwsRoutingOptions,
    model?: string,
    outputLanguage?: string,
  ): Promise<string> {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) throw new Error('Question cannot be empty.');
    const system = buildSystemPrompt(pack, outputLanguage);
    return this.callMessages(
      apiKey,
      aws,
      system,
      [{ role: 'user', content: trimmedQuestion }],
      model,
    );
  }

  private async callMessages(
    apiKey: string,
    aws: AwsRoutingOptions | undefined,
    system: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    model?: string,
  ): Promise<string> {
    if (!apiKey) throw new Error('Missing API key.');
    const useAws = isAwsApiKey(apiKey);
    if (useAws && (!aws?.workspaceId || !aws.region)) {
      throw new Error(
        'Claude Platform on AWS keys require a workspace ID and region. Open Settings to fill them in.',
      );
    }

    const url = useAws
      ? `https://aws-external-anthropic.${aws!.region}.api.aws/v1/messages`
      : ANTHROPIC_URL;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    };
    if (useAws) {
      headers['anthropic-workspace-id'] = aws!.workspaceId;
    } else {
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages,
      }),
    });

    const data = (await response.json().catch(() => null)) as AnthropicResponse | null;

    if (!response.ok) {
      const message = data?.error?.message ?? `Request failed with status ${response.status}.`;
      throw new Error(message);
    }

    const text = (data?.content ?? [])
      .filter((block): block is AnthropicTextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    if (!text) throw new Error('Empty response from Anthropic API.');
    return text;
  }

  async *streamReview(
    question: string,
    apiKey: string,
    pack: PackContext,
    aws: AwsRoutingOptions | undefined,
    model: string | undefined,
    signal: AbortSignal,
    extras?: CallExtras,
    outputLanguage?: string,
  ): AsyncGenerator<string, void, void> {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) throw new Error('Question cannot be empty.');
    const system = buildSystemPrompt(pack, outputLanguage);
    yield* this.streamMessages(
      apiKey,
      aws,
      system,
      [{ role: 'user', content: trimmedQuestion }],
      model,
      signal,
      extras,
    );
  }

  async *streamTranscriptScript(
    transcripts: string[],
    apiKey: string,
    aws: AwsRoutingOptions | undefined,
    model: string | undefined,
    signal: AbortSignal,
    extras?: CallExtras,
    outputLanguage?: string,
  ): AsyncGenerator<string, void, void> {
    const cleaned = transcripts
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (cleaned.length === 0) throw new Error('At least one transcript is required.');

    const system = buildTranscriptScriptPrompt(outputLanguage);
    const joined = cleaned
      .map((text, i) => `--- LESSON ${i + 1} TRANSCRIPT ---\n${text}`)
      .join('\n\n');
    const userMessage = `Below are ${cleaned.length} lesson transcript${cleaned.length === 1 ? '' : 's'}. Use them as the source material for the technical summary, following the format in your system instructions.\n\n${joined}`;

    yield* this.streamMessages(
      apiKey,
      aws,
      system,
      [{ role: 'user', content: userMessage }],
      model,
      signal,
      extras,
    );
  }

  async *streamRefineReview(
    currentReview: string,
    feedback: string,
    apiKey: string,
    pack: PackContext,
    aws: AwsRoutingOptions | undefined,
    model: string | undefined,
    signal: AbortSignal,
    extras?: CallExtras,
    outputLanguage?: string,
  ): AsyncGenerator<string, void, void> {
    const trimmedFeedback = feedback.trim();
    if (!trimmedFeedback) throw new Error('Feedback cannot be empty.');
    if (!currentReview.trim()) throw new Error('No review to refine.');

    const system = buildSystemPrompt(pack, outputLanguage);
    const userMessage = `You previously generated the exam review below. Refine it based on the user's feedback while keeping the SAME OUTPUT FORMAT specified in your instructions.

=== CURRENT REVIEW ===
${currentReview}

=== USER FEEDBACK ===
${trimmedFeedback}

Return the FULL refined review. Apply only the changes needed to address the feedback; preserve everything else.`;

    yield* this.streamMessages(
      apiKey,
      aws,
      system,
      [{ role: 'user', content: userMessage }],
      model,
      signal,
      extras,
    );
  }

  private async *streamMessages(
    apiKey: string,
    aws: AwsRoutingOptions | undefined,
    system: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    model: string | undefined,
    signal: AbortSignal,
    extras?: CallExtras,
  ): AsyncGenerator<string, void, void> {
    if (!apiKey) throw new Error('Missing API key.');
    const useAws = isAwsApiKey(apiKey);
    if (useAws && (!aws?.workspaceId || !aws.region)) {
      throw new Error(
        'Claude Platform on AWS keys require a workspace ID and region. Open Settings to fill them in.',
      );
    }

    const url = useAws
      ? `https://aws-external-anthropic.${aws!.region}.api.aws/v1/messages`
      : ANTHROPIC_URL;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'Accept': 'text/event-stream',
    };
    if (useAws) {
      headers['anthropic-workspace-id'] = aws!.workspaceId;
    } else {
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
    }

    const mcpServers = extras?.mcpServers ?? [];
    if (mcpServers.length > 0) {
      headers['anthropic-beta'] = MCP_BETA_HEADER;
    }

    const body: Record<string, unknown> = {
      model: model || DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages,
      stream: true,
    };
    if (extras?.enableWebSearch) {
      body['tools'] = [{ type: 'web_search_20250305', name: 'web_search' }];
    }
    if (mcpServers.length > 0) {
      body['mcp_servers'] = mcpServers.map((entry) => ({
        type: 'url',
        url: entry.url,
        name: entry.id,
      }));
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as AnthropicResponse | null;
      const message = data?.error?.message ?? `Request failed with status ${response.status}.`;
      throw new Error(message);
    }
    if (!response.body) throw new Error('Streaming is not supported in this environment.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let separatorIndex;
        while ((separatorIndex = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, separatorIndex);
          buffer = buffer.slice(separatorIndex + 2);
          const text = extractTextDelta(block);
          if (text) yield text;
        }
      }
      if (buffer.trim()) {
        const text = extractTextDelta(buffer);
        if (text) yield text;
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // ignore
      }
    }
  }
}

function extractTextDelta(block: string): string | null {
  const lines = block.split('\n');
  let dataPayload: string | null = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('data:')) {
      dataPayload = line.slice(5).trimStart();
    }
  }
  if (!dataPayload || dataPayload === '[DONE]') return null;
  try {
    const evt = JSON.parse(dataPayload) as {
      type?: string;
      delta?: { type?: string; text?: string };
    };
    if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
      return evt.delta.text ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

