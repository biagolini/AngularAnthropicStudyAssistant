# Anthropic Study Assistant

A mobile-first study app for any IT certification exam (AWS, GCP, Azure, MongoDB, Anthropic CCAF, and others). Paste raw exam questions, receive AI-generated structured reviews via the Anthropic API, accumulate reviewed questions across sessions, and export selections as Markdown files ready for Google NotebookLM podcast generation.

**Live demo:** [https://biagolini.github.io/AngularAnthropicStudyAssistant/](https://biagolini.github.io/AngularAnthropicStudyAssistant/)

**Author:** Carlos Biagolini-Jr.
**LinkedIn:** [linkedin.com/in/biagolini](https://www.linkedin.com/in/biagolini/)
**Medium:** [medium.com/@biagolini](https://medium.com/@biagolini)

---

## What it does

You bring the questions and your Anthropic API key. The app turns each raw question into a structured review (key concepts, context, correct answer with reasoning, why each wrong alternative is wrong, Portuguese translations on English questions), keeps every review in your browser, and lets you export grouped Markdown bundles you can hand to NotebookLM to generate study podcasts.

There is no backend. Everything is in your browser: questions, settings, and API key all live in `localStorage`. Closing the tab does not lose your work; clearing site data does.

---

## Getting an Anthropic API key

The app calls Claude on your behalf, so you need your own Anthropic API key before anything works.

1. **Create an account** at [console.anthropic.com](https://console.anthropic.com/). A Google or email sign-up works.
2. **Add billing credit.** Anthropic uses prepaid usage: open **Plans & Billing → Billing** and top up at least a few dollars. A typical review with `claude-sonnet-4-20250514` and `max_tokens: 2000` costs a few cents, so a small initial credit goes a long way.
3. **Create the key.** Go to **API Keys → Create Key**, give it a name like `study-assistant`, and copy the value. The key is shown only once and starts with `sk-ant-`. If you lose it, just create a new one and revoke the old one.
4. **Optional but recommended:** set a monthly **usage limit** on the key so a runaway loop cannot drain your credit.

> Treat the key like a password. Anyone who has it can spend on your account. If the device is shared, revoke the key when you are done.

### Alternative: get the key through your AWS account

If you already run on AWS and prefer to consolidate billing there, you can use **Claude Platform on AWS** instead of opening a personal Anthropic account. It is a native AWS integration where Anthropic still operates the inference, but AWS handles authentication (IAM/SigV4 or API key), Marketplace billing, and CloudTrail audit. The API key you get from the AWS-managed Claude Console works in this app exactly the same way as a personal-account key — paste it in the **Settings → API Key** field and you are done.

For a step-by-step walkthrough (subscribing in AWS Marketplace, creating the Anthropic organization linked to your AWS account, provisioning a workspace, enabling outbound web identity federation, and grabbing the key), see my articles:

- English: [Getting Started with Claude Platform on AWS](https://medium.com/@biagolini/getting-started-with-claude-platform-on-aws-9a2c1ed9b3bc)
- Português: [Primeiros passos com o Claude Platform na AWS](https://builder.aws.com/content/3Ek6QX9d8ea545kjglmS2UcBlsk/primeiros-passos-com-o-claude-platform-na-aws)

> Note: Claude Platform on AWS is not the same as **Amazon Bedrock**. This app talks to the public Anthropic Messages API (`api.anthropic.com`), so it works with API keys from either a first-party Anthropic Console account or an AWS-managed Claude Platform organization. It does **not** call Bedrock endpoints directly — if your compliance rules require AWS to be the sole data processor, use a Bedrock-aware client instead.

## Configuring the app

Once you have a key, the rest happens inside the app:

1. Open the live demo: [https://biagolini.github.io/AngularAnthropicStudyAssistant/](https://biagolini.github.io/AngularAnthropicStudyAssistant/)
2. Tap the **gear icon** in the top-right of the header to open the **Settings drawer**.
3. **Certification Name** — free text describing what you are studying (e.g. `AWS Solutions Architect SAA-C03`). The app injects this into the AI prompt and uses a slug of it as a prefix on every exported filename. Leave it blank if you prefer generic output.
4. **Knowledge Domains** — type each domain (e.g. `Compute`, `Networking`, `Security`) and press Enter or tap **Add**. Up to 20 domains, case-insensitive deduplication. Use the X on each chip to remove. With no domains defined, every question is filed under `General`.
5. **API Key** — paste the key you copied from the Anthropic Console. The eye icon toggles visibility. The app validates the `sk-ant-` prefix and stores it in this browser's `localStorage`. Tap **Edit** later to replace or **Clear all questions** in the Danger Zone if you want to start over.
6. Close the drawer. You are ready to generate reviews from the **Input** tab.

Settings persist across reloads. To wipe everything (including the API key), use your browser's site data tools.

---

## Daily use

With Settings filled in, the day-to-day loop is three tabs:

1. **Input tab** — paste a full question (stem + alternatives A/B/C/D) and tap **Generate Review**. A few seconds later the review appears in the Review viewer.
2. **Questions tab** — every reviewed question is listed with its domain badge. Tap to read; tap the badge to change its domain; use the checkbox to mark it for export.
3. **Export tab** — choose how to download what you selected:
   - **Download selected** — one or more files, balanced by your max-per-file setting.
   - **By domain** — one file per domain that has selected questions.
   - **Download all** — a single file with every reviewed question.

Other controls in the header:

- **Theme toggle** (sun/moon) — switches light/dark. Choice persists.
- **Settings gear** — re-open the drawer any time to tweak certification, domains, or rotate the API key.
- **Clear data** — *Settings → Danger Zone → Clear all questions* wipes the question history. Your API key and certification settings stay.

---

## AI accuracy notice

Every review, refinement, and answer rationale in this app is generated by a large language model. LLMs can produce **inaccurate, outdated, or entirely fabricated** technical content. Treat the output as a **study aid**, not as ground truth:

- Always cross-check explanations against **official vendor documentation** (AWS, GCP, Azure, MongoDB, Anthropic, etc.) before relying on them.
- Be especially skeptical of API names, service limits, version numbers, and pricing — these are the most common categories of hallucination.
- The "correct answer" the AI picks for a multiple-choice question can be **wrong**. Verify with the official answer key or vendor docs.
- Material exported for NotebookLM or shared with others inherits these caveats. Do not present AI-generated review content as authoritative without a manual review pass.

By using this app you accept that the author, contributors, and any model provider (Anthropic, AWS) are **not responsible** for incorrect study content, missed exam questions, or any consequence of acting on AI-generated information.

---

## Privacy & cost notes

- The Anthropic API key is stored as plain text in your browser. Use a key scoped to this purpose if possible, and revoke it when you stop using the app.
- Each generated review is one call to `claude-sonnet-4-20250514` with `max_tokens: 2000`. Your costs are between you and Anthropic.
- Requests go from your browser directly to `api.anthropic.com` via the `anthropic-dangerous-direct-browser-access` header. No proxy, no third party, no telemetry.

---

## Tech stack

- **Angular** (standalone components, signals, no NgModules)
- **TypeScript** strict mode
- **SCSS** with CSS custom properties for theming
- **Native `fetch`** (no `HttpClient`) for the single external call
- **`localStorage`** for persistence
- **Custom Markdown renderer** (line-by-line parser, no `innerHTML`, no third-party library)
- **Zero UI libraries** — no Material, no PrimeNG, no Bootstrap
- **Static build** deployed to GitHub Pages from the `docs/` folder

---

## Local development

```bash
git clone git@github.com:biagolini/AngularAnthropicStudyAssistant.git
cd AngularAnthropicStudyAssistant
npm install
npm start
```

Open `http://localhost:4200/`. The dev server reloads on save.

### Build

```bash
npm run build
```

Outputs the static site into `docs/` with `baseHref="/AngularAnthropicStudyAssistant/"` so GitHub Pages can serve it from `main` branch, `/docs` folder.

### Tests

```bash
npm test
```

---

## Repository

Source: [github.com/biagolini/AngularAnthropicStudyAssistant](https://github.com/biagolini/AngularAnthropicStudyAssistant)

Part of the Angular projects index: [github.com/biagolini/Angular](https://github.com/biagolini/Angular)
