import { Injectable } from '@angular/core';
import { MCP_BETA_HEADER, McpServerEntry } from '../models/mcp.model';
import { DEFAULT_MODEL, isAwsApiKey } from '../models/settings.model';

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
    certName: string,
    domains: string[],
    aws?: AwsRoutingOptions,
    model?: string,
  ): Promise<string> {
    const trimmedFeedback = feedback.trim();
    if (!trimmedFeedback) throw new Error('Feedback cannot be empty.');
    if (!currentReview.trim()) throw new Error('No review to refine.');

    const system = buildSystemPrompt(certName, domains);
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
    certName: string,
    domains: string[],
    aws?: AwsRoutingOptions,
    model?: string,
  ): Promise<string> {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) throw new Error('Question cannot be empty.');
    const system = buildSystemPrompt(certName, domains);
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
    certName: string,
    domains: string[],
    aws: AwsRoutingOptions | undefined,
    model: string | undefined,
    signal: AbortSignal,
    extras?: CallExtras,
  ): AsyncGenerator<string, void, void> {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) throw new Error('Question cannot be empty.');
    const system = buildSystemPrompt(certName, domains);
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
  ): AsyncGenerator<string, void, void> {
    const cleaned = transcripts
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (cleaned.length === 0) throw new Error('At least one transcript is required.');

    const system = buildTranscriptScriptPrompt();
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
    certName: string,
    domains: string[],
    aws: AwsRoutingOptions | undefined,
    model: string | undefined,
    signal: AbortSignal,
    extras?: CallExtras,
  ): AsyncGenerator<string, void, void> {
    const trimmedFeedback = feedback.trim();
    if (!trimmedFeedback) throw new Error('Feedback cannot be empty.');
    if (!currentReview.trim()) throw new Error('No review to refine.');

    const system = buildSystemPrompt(certName, domains);
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

function buildTranscriptScriptPrompt(): string {
  return `You are a technical educator. You read lesson transcripts and produce a single structured technical summary that another AI will narrate as an educational podcast. Your job is to extract, organize, and explain the technical content from the transcripts so the narrator AI has enough substance to talk about.

OUTPUT REQUIREMENTS — follow EXACTLY:

# Resumo técnico: <main topic>

## Visão geral
[2-4 sentence overview of what will be covered. Frame the topic and why it matters, in plain language. Do NOT mention "podcast", "narrator", "audio", or any meta-reference to the medium. Write as if the reader IS the audience.]

## Capítulo 1 — <chapter title>
[Several paragraphs of technical content drawn from the transcripts. Start with the simplest, most foundational concepts. Define terms on first use with both the technical term and a plain-language explanation. Include concrete examples and analogies. Cite which lesson(s) the material came from inline where useful, e.g. "(from Aula 2)".]

## Capítulo 2 — <chapter title>
[Builds on Chapter 1. Slightly more advanced concepts and details.]

[Continue with capítulos in order of increasing difficulty until all important content from the transcripts is covered. Aim for 3 to 7 chapters depending on transcript volume.]

## Pontos-chave
- [3 to 8 bullet points of the most important takeaways from the material, in the same simple-to-complex order.]

STRICT CONSTRAINTS:
- NEVER use the phrase "guia para podcast", "roteiro de podcast", "script", "narrator", "host", or any reference to the audio medium. The document must read as a standalone technical summary.
- NEVER use code blocks. Inline code with backticks is fine for short identifiers.
- NEVER use emojis.
- Write in clear, fluid Portuguese (PT-BR) UNLESS the transcripts are in English, in which case use English. Match the dominant language of the source.
- Use **bold** for important terms and key concepts. Use *italic* sparingly for emphasis.
- Prefer narrative paragraphs over dense bullet lists, except in "Pontos-chave".
- Stay faithful to what is in the transcripts. Do not invent facts the transcripts do not support.
- If the transcripts contradict each other, note the disagreement neutrally.

At the very end of your response, AFTER all other content, output this line exactly:
INFERRED_TITLE: [the same <main topic> you used in the H1, without "Resumo técnico:" prefix, no quotes]`;
}

function buildSystemPrompt(certName: string, domains: string[]): string {
  const certLine = certName
    ? `The user is studying for the **${certName}** certification.`
    : `The user is studying for an IT certification exam.`;

  const domainSection =
    domains.length > 0
      ? `The following knowledge domains have been defined for this certification:\n${domains
          .map((d, i) => `${i + 1}. ${d}`)
          .join('\n')}\n\nClassify each question into one of these domains. At the very end of your response, AFTER all other content, output these two lines exactly:\nINFERRED_TITLE: [short 4-8 word descriptive title for this question, no prefixes like "Scenario:" or "Question:", no quotes]\nINFERRED_DOMAIN: [exact domain name from the list above]`
      : `No specific domains have been defined. Classify all questions under the domain name: General\n\nAt the very end of your response, AFTER all other content, output these two lines exactly:\nINFERRED_TITLE: [short 4-8 word descriptive title for this question, no prefixes like "Scenario:" or "Question:", no quotes]\nINFERRED_DOMAIN: General`;

  return `You are a technical reviewer preparing study material for an IT certification exam. ${certLine}

Your task is to generate a structured review of an exam question following the template below EXACTLY.

${domainSection}

OUTPUT FORMAT — follow this EXACTLY:

---

## Question

### Key concepts related to this question:
- [List 3-6 core concepts/technologies tested]

### Question Context:
[2-4 sentences explaining what the question evaluates and which domain it belongs to]

### Question stem:
[Exact question text from user input]
*Translation: [Full Portuguese translation — ONLY if the question is in English]*

### Alternatives:
*A. [Exact alternative text]*
*Translation: [Portuguese translation — ONLY if the question is in English]*

*B. [Exact alternative text]*
*Translation: [Portuguese translation — ONLY if the question is in English]*

*C. [Exact alternative text]*
*Translation: [Portuguese translation — ONLY if the question is in English]*

*D. [Exact alternative text]*
*Translation: [Portuguese translation — ONLY if the question is in English]*

### Correct answer and explanation:
*[Letter]. [Exact text of the correct alternative]*
*Translation: [Portuguese translation — ONLY if in English]*

[Explanation in 1-2 short paragraphs (max 5-6 sentences) on why it is correct. Focus on the validated concept, applicable best practice, and technical reasoning. Use technical terms with Portuguese translation in parentheses on first occurrence.]

### Incorrect answers and justifications:
*[Letter]. [Exact alternative text]*
*Translation: [Portuguese translation — ONLY if in English]*

- **Why it is incorrect**: [Main technical/conceptual error in 1-2 sentences]
- **Additional problem**: [Operational risk, anti-pattern, or negative consequence — optional]
- **When it would be valid**: [Context where the approach could make sense — optional]

[Repeat for each incorrect alternative]

STRICT CONSTRAINTS:
- NEVER include code blocks of any language
- NEVER use emojis
- NEVER create subsections with #### inside explanations
- Keep narrative language, fluid and suitable for reading aloud
- Use **bold** for important terms and key concepts
- If the question is already in Portuguese, omit all translation lines
- Keep explanations concise — prioritize clarity over completeness
- When there is ambiguity between alternatives, explain the elimination reasoning
- Base explanations on official vendor documentation and production best practices`;
}
