import { Injectable } from '@angular/core';
import { isAwsApiKey } from '../models/settings.model';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929';
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

@Injectable({ providedIn: 'root' })
export class AnthropicService {
  async refineReview(
    currentReview: string,
    feedback: string,
    apiKey: string,
    certName: string,
    domains: string[],
    aws?: AwsRoutingOptions,
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
  ): Promise<string> {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) throw new Error('Question cannot be empty.');
    const system = buildSystemPrompt(certName, domains);
    return this.callMessages(
      apiKey,
      aws,
      system,
      [{ role: 'user', content: trimmedQuestion }],
    );
  }

  private async callMessages(
    apiKey: string,
    aws: AwsRoutingOptions | undefined,
    system: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
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
        model: ANTHROPIC_MODEL,
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
}

function buildSystemPrompt(certName: string, domains: string[]): string {
  const certLine = certName
    ? `The user is studying for the **${certName}** certification.`
    : `The user is studying for an IT certification exam.`;

  const domainSection =
    domains.length > 0
      ? `The following knowledge domains have been defined for this certification:\n${domains
          .map((d, i) => `${i + 1}. ${d}`)
          .join('\n')}\n\nClassify each question into one of these domains. At the end of your response, output:\nINFERRED_DOMAIN: [exact domain name from the list above]`
      : `No specific domains have been defined. Classify all questions under the domain name: General\n\nAt the end of your response, output:\nINFERRED_DOMAIN: General`;

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
