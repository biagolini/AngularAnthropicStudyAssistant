import { Injectable } from '@angular/core';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';
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

@Injectable({ providedIn: 'root' })
export class AnthropicService {
  async generateReview(
    question: string,
    apiKey: string,
    certName: string,
    domains: string[],
  ): Promise<string> {
    if (!apiKey) throw new Error('Missing API key.');
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) throw new Error('Question cannot be empty.');

    const system = buildSystemPrompt(certName, domains);

    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages: [
          {
            role: 'user',
            content: trimmedQuestion,
          },
        ],
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
