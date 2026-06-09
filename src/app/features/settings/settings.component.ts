import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AWS_REGIONS, isAwsApiKey } from '../../core/models/settings.model';
import { AnthropicService } from '../../core/services/anthropic.service';
import { ModelsService } from '../../core/services/models.service';
import { QuestionsService } from '../../core/services/questions.service';
import { SettingsService } from '../../core/services/settings.service';
import { StorageService } from '../../core/services/storage.service';
import { ApiKeyComponent } from '../api-key/api-key.component';

type TestStatus = 'idle' | 'testing' | 'ok' | 'failed';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, ApiKeyComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="drawer">
      <header class="drawer-header">
        <h2>Settings</h2>
        <button
          type="button"
          class="close-btn"
          (click)="closed.emit()"
          aria-label="Close settings"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              d="M5 5l14 14M19 5L5 19"
            />
          </svg>
        </button>
      </header>

      <div class="drawer-body">
        <section class="block">
          <header class="section-header">
            <h3>Quick import</h3>
            <p class="helper">
              Load API credentials from a <code>.env</code> file. Reads <code>ANTHROPIC_API_KEY</code>, <code>ANTHROPIC_AWS_WORKSPACE_ID</code>, and <code>ANTHROPIC_AWS_REGION</code>.
            </p>
          </header>
          <button
            type="button"
            class="btn btn-secondary"
            (click)="triggerEnvImport()"
            aria-label="Import .env file"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>
            </svg>
            <span>Import .env</span>
          </button>
          <input
            #envFileInput
            type="file"
            accept=".env,text/plain"
            class="file-input-hidden"
            aria-hidden="true"
            (change)="onEnvFileSelected($event)"
          />
          @if (envImportMessage()) {
            <p class="status" [class.status-ok]="envImportOk()" [class.status-failed]="!envImportOk()">
              {{ envImportMessage() }}
            </p>
          }
        </section>

        <section class="block">
          <app-api-key />
        </section>

        @if (hasApiKey()) {
          <section class="block">
            <header class="section-header">
              <div class="title-row">
                <h3>Default model</h3>
                @if (modelsLoading()) {
                  <span class="spinner" aria-hidden="true"></span>
                }
                <button
                  type="button"
                  class="info-btn"
                  (click)="refreshModels()"
                  [disabled]="modelsLoading()"
                  aria-label="Refresh models list"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M4 12a8 8 0 1 0 2.34-5.66M4 4v4h4"/>
                  </svg>
                </button>
              </div>
              <p class="helper">
                Used for Generate Review and Refine. You can override per call. Lighter tiers (fast) respond quicker and cost less.
              </p>
            </header>
            <select
              class="text-input"
              [ngModel]="defaultModel()"
              (ngModelChange)="onDefaultModelChange($event)"
              aria-label="Default model"
            >
              @for (model of availableModels(); track model.id) {
                <option [value]="model.id">{{ model.displayName }} — {{ model.tier }}</option>
              }
              @if (!availableHas(defaultModel())) {
                <option [value]="defaultModel()">{{ defaultModel() }} (not in current list)</option>
              }
            </select>
            @if (modelsError()) {
              <p class="error">{{ modelsError() }}</p>
            }

            <label class="toggle-row">
              <input
                type="checkbox"
                [checked]="webSearchDefault()"
                (change)="onToggleWebSearchDefault($event)"
                aria-label="Enable web search by default"
              />
              <span class="toggle-meta">
                <span class="toggle-title">Web search by default</span>
                <span class="toggle-hint">
                  When on, the model can call Anthropic's web_search tool during Generate and Refine. Costs ~$10 per 1000 searches and adds 3-8s latency.
                </span>
              </span>
            </label>
          </section>
        }

        @if (showAwsBlock()) {
          <section class="block aws-block">
            <header class="section-header">
              <div class="title-row">
                <h3>Claude Platform on AWS</h3>
                <button
                  type="button"
                  class="info-btn"
                  (click)="openAwsInfo()"
                  aria-label="What is Claude Platform on AWS"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/>
                    <path d="M12 11v6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                    <circle cx="12" cy="8" r="1" fill="currentColor"/>
                  </svg>
                </button>
              </div>
              <p class="helper">
                Required when your API key starts with <code>AEA</code>. Workspace ID and region are sent on every request to <code>aws-external-anthropic.&lt;region&gt;.api.aws</code>.
              </p>
            </header>

            <label class="field">
              <span class="field-label">Workspace ID</span>
              <input
                class="text-input"
                type="text"
                placeholder="wrkspc_..."
                [ngModel]="workspaceId()"
                (ngModelChange)="onWorkspaceIdChange($event)"
                (blur)="commitWorkspaceId()"
                (keyup.enter)="commitWorkspaceId()"
                aria-label="AWS workspace ID"
              />
            </label>

            <label class="field">
              <span class="field-label">Region</span>
              <select
                class="text-input"
                [ngModel]="region()"
                (ngModelChange)="onRegionChange($event)"
                aria-label="AWS region"
              >
                @for (r of regions; track r) {
                  <option [value]="r">{{ r }}</option>
                }
              </select>
            </label>

            @if (awsKeyButNoWorkspace()) {
              <p class="error">Workspace ID is required for AWS keys.</p>
            }
          </section>
        }

        @if (hasApiKey()) {
          <section class="block test-block">
            <header class="section-header">
              <h3>Connection check</h3>
              <p class="helper">
                Sends a tiny <code>GET /v1/models</code> request to validate auth and routing. No tokens are consumed.
              </p>
            </header>
            <button
              type="button"
              class="btn btn-secondary"
              (click)="onTestConnection()"
              [disabled]="testStatus() === 'testing' || awsKeyButNoWorkspace()"
            >
              @if (testStatus() === 'testing') {
                <span class="spinner" aria-hidden="true"></span>
                <span>Testing...</span>
              } @else {
                <span>Test connection</span>
              }
            </button>

            @if (testStatus() === 'ok') {
              <p class="status status-ok">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/>
                  <path d="M8 12l3 3 5-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Connection OK ({{ testEndpoint() }})
              </p>
            }
            @if (testStatus() === 'failed') {
              <p class="status status-failed">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/>
                  <path d="M9 9l6 6M15 9l-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
                {{ testError() }}
              </p>
            }
          </section>
        }

        <section class="block danger">
          <header class="section-header">
            <h3>Danger Zone</h3>
            <p class="helper">
              Clears the questions belonging to the active pack only. Other packs and your API key are not affected.
            </p>
          </header>
          <button
            type="button"
            class="btn btn-danger"
            (click)="onClearRequested()"
            [disabled]="questionCount() === 0"
          >
            Clear questions in this pack
          </button>
          <p class="helper">{{ questionCount() }} question{{ questionCount() === 1 ? '' : 's' }} in this pack.</p>
        </section>
      </div>

      @if (confirmingClear()) {
        <div class="confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div class="confirm">
            <h3 id="confirm-title">Clear questions in this pack?</h3>
            <p>
              This will permanently delete the {{ questionCount() }} question{{ questionCount() === 1 ? '' : 's' }} in the active pack. Your settings, API key, and other packs will not be affected.
            </p>
            <div class="confirm-actions">
              <button type="button" class="btn btn-ghost" (click)="onCancelClear()">Cancel</button>
              <button type="button" class="btn btn-danger" (click)="onConfirmClear()">Delete</button>
            </div>
          </div>
        </div>
      }

      @if (awsInfoOpen()) {
        <div class="confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="aws-info-title" (click)="closeAwsInfo()">
          <div class="confirm aws-info" (click)="$event.stopPropagation()">
            <h3 id="aws-info-title">Claude Platform on AWS</h3>
            <p>
              A native AWS integration launched in May 2026 that lets organizations access Anthropic's full Claude developer platform through their existing AWS account. Anthropic still operates the inference; AWS provides the authentication layer (IAM/SigV4 or API key), consolidated billing via Marketplace, and audit through CloudTrail.
            </p>
            <p>
              Unlike Amazon Bedrock — where AWS operates the inference — Claude Platform on AWS keeps Anthropic as the inference operator, so your team gets same-day access to the latest models with billing routed through AWS.
            </p>
            <p>
              <strong>To get a key:</strong> subscribe in the AWS Console, link an Anthropic organization, create a workspace, enable outbound web identity federation, and generate a long-term key.
            </p>
            <p>
              For a step-by-step walkthrough, see:
            </p>
            <ul class="aws-links">
              <li>
                <a href="https://medium.com/@biagolini/getting-started-with-claude-platform-on-aws-9a2c1ed9b3bc" target="_blank" rel="noopener">
                  Getting Started with Claude Platform on AWS (English)
                </a>
              </li>
              <li>
                <a href="https://builder.aws.com/content/3Ek6QX9d8ea545kjglmS2UcBlsk/primeiros-passos-com-o-claude-platform-na-aws" target="_blank" rel="noopener">
                  Primeiros passos com o Claude Platform na AWS (Português)
                </a>
              </li>
            </ul>
            <div class="confirm-actions">
              <button type="button" class="btn btn-primary" (click)="closeAwsInfo()">Got it</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: contents;
      }
      .drawer {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--bg-surface);
        color: var(--text-primary);
      }
      .drawer-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--space-md) var(--space-lg);
        border-bottom: 1px solid var(--bg-border);
        position: sticky;
        top: 0;
        background: var(--bg-surface);
        z-index: 1;
      }
      .drawer-header h2 {
        font-size: var(--font-size-xl);
      }
      .close-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: var(--touch-min);
        height: var(--touch-min);
        border-radius: var(--radius-md);
        color: var(--text-muted);
      }
      .close-btn:hover {
        background: var(--bg-subtle);
        color: var(--text-primary);
      }
      .drawer-body {
        flex: 1;
        overflow-y: auto;
        padding: var(--space-lg);
        display: flex;
        flex-direction: column;
        gap: var(--space-xl);
        padding-bottom: calc(var(--space-xl) * 2);
      }
      .block {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .section-header h3 {
        font-size: var(--font-size-lg);
        color: var(--text-primary);
        margin-bottom: var(--space-xs);
      }
      .helper {
        font-size: var(--font-size-sm);
        color: var(--text-muted);
        line-height: 1.45;
      }
      .text-input {
        height: var(--touch-min);
        padding: 0 var(--space-md);
        border-radius: var(--radius-md);
        border: 1px solid var(--bg-border);
        background: var(--bg-input);
        color: var(--text-primary);
        font-size: var(--font-size-base);
        width: 100%;
        transition: border-color var(--transition-fast);
      }
      .text-input:focus-visible {
        outline: none;
        border-color: var(--color-purple);
      }
      .text-input:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .domain-input {
        display: flex;
        gap: var(--space-sm);
      }
      .domain-input .text-input {
        flex: 1;
      }
      .btn {
        min-height: var(--touch-min);
        padding: 0 var(--space-md);
        border-radius: var(--radius-md);
        font-weight: 600;
        font-size: var(--font-size-base);
        white-space: nowrap;
      }
      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .btn-primary {
        background: var(--color-purple);
        color: #ffffff;
      }
      .btn-primary:hover:not(:disabled) {
        background: var(--color-blue);
      }
      .btn-ghost {
        background: transparent;
        color: var(--text-secondary);
        border: 1px solid var(--bg-border);
      }
      .btn-ghost:hover:not(:disabled) {
        background: var(--bg-subtle);
      }
      .btn-danger {
        background: transparent;
        color: var(--color-red);
        border: 1px solid var(--color-red);
      }
      .btn-danger:hover:not(:disabled) {
        background: var(--color-red);
        color: #ffffff;
      }
      .btn-secondary {
        background: var(--bg-elevated);
        color: var(--text-primary);
        border: 1px solid var(--bg-border);
        display: inline-flex;
        align-items: center;
        gap: var(--space-sm);
        align-self: flex-start;
      }
      .btn-secondary:hover:not(:disabled) {
        border-color: var(--color-purple);
        background: var(--bg-subtle);
      }
      .title-row {
        display: flex;
        align-items: center;
        gap: var(--space-xs);
        margin-bottom: var(--space-xs);
      }
      .title-row h3 {
        margin-bottom: 0;
      }
      .info-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: var(--radius-pill);
        color: var(--text-muted);
      }
      .info-btn:hover {
        color: var(--color-blue);
        background: var(--bg-subtle);
      }
      .status {
        display: inline-flex;
        align-items: center;
        gap: var(--space-xs);
        font-size: var(--font-size-sm);
        padding: var(--space-xs) var(--space-sm);
        border-radius: var(--radius-md);
      }
      .status-ok {
        color: var(--color-green);
        background: rgba(0, 184, 148, 0.08);
      }
      .status-failed {
        color: var(--color-red);
        background: rgba(214, 48, 49, 0.08);
        line-height: 1.4;
      }
      .spinner {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 2px solid var(--bg-border);
        border-top-color: var(--color-purple);
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      .aws-info {
        max-width: 480px;
      }
      .aws-info p {
        font-size: var(--font-size-base);
        line-height: 1.55;
      }
      .aws-info code {
        font-family: var(--font-mono);
        font-size: 0.9em;
        background: var(--bg-elevated);
        padding: 1px 6px;
        border-radius: var(--radius-sm);
      }
      .aws-links {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        padding-left: var(--space-md);
      }
      .aws-links li {
        list-style: disc;
        color: var(--text-secondary);
      }
      .aws-links a {
        color: var(--color-blue);
        word-break: break-word;
      }
      .aws-links a:hover {
        text-decoration: underline;
      }
      .count {
        font-size: var(--font-size-sm);
        color: var(--text-faint);
      }
      .toggle-row {
        display: flex;
        align-items: flex-start;
        gap: var(--space-sm);
        margin-top: var(--space-sm);
        padding: var(--space-sm);
        border-radius: var(--radius-md);
        border: 1px solid var(--bg-border);
        background: var(--bg-elevated);
        cursor: pointer;
      }
      .toggle-row input[type='checkbox'] {
        margin-top: 3px;
        accent-color: var(--color-purple);
      }
      .toggle-meta {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .toggle-title {
        font-weight: 600;
        color: var(--text-primary);
      }
      .toggle-hint {
        font-size: var(--font-size-sm);
        color: var(--text-muted);
        line-height: 1.4;
      }
      .error {
        color: var(--color-red);
        font-size: var(--font-size-sm);
      }
      .file-input-hidden {
        display: none;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-sm);
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: var(--space-xs);
        padding: 4px var(--space-sm);
        padding-right: var(--space-xs);
        border-radius: var(--radius-pill);
        background: var(--bg-elevated);
        border: 1px solid var(--bg-border);
        color: var(--text-secondary);
        font-size: var(--font-size-sm);
      }
      .chip-remove {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: var(--radius-pill);
        color: var(--text-muted);
      }
      .chip-remove:hover {
        background: var(--color-red);
        color: #ffffff;
      }
      .empty {
        color: var(--text-faint);
        font-size: var(--font-size-sm);
        font-style: italic;
      }
      .danger {
        border-top: 1px solid var(--bg-border);
        padding-top: var(--space-lg);
      }
      .confirm-overlay {
        position: absolute;
        inset: 0;
        background: var(--overlay-bg);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-lg);
      }
      .confirm {
        background: var(--bg-surface);
        border-radius: var(--radius-lg);
        padding: var(--space-lg);
        box-shadow: var(--shadow-lg);
        max-width: 360px;
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }
      .confirm h3 {
        font-size: var(--font-size-lg);
      }
      .confirm p {
        font-size: var(--font-size-base);
        color: var(--text-secondary);
        line-height: 1.5;
      }
      .confirm-actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-sm);
      }
    `,
  ],
})
export class SettingsComponent {
  private readonly settings = inject(SettingsService);
  private readonly questionsService = inject(QuestionsService);
  private readonly storage = inject(StorageService);
  private readonly anthropic = inject(AnthropicService);
  private readonly modelsService = inject(ModelsService);

  protected readonly workspaceIdDraft = signal(this.settings.awsWorkspaceId());
  protected readonly confirmingClear = signal(false);
  protected readonly regions = AWS_REGIONS;

  readonly closed = output<void>();

  readonly questionCount = this.questionsService.count;
  readonly workspaceId = computed(() => this.workspaceIdDraft());
  readonly region = this.settings.awsRegion;

  readonly showAwsBlock = computed(() => (this.storage.apiKey() ?? '').startsWith('AEA'));
  readonly awsKeyButNoWorkspace = computed(
    () => this.showAwsBlock() && !this.workspaceId().trim(),
  );
  readonly hasApiKey = computed(() => !!this.storage.apiKey());
  readonly availableModels = this.modelsService.models;
  readonly modelsLoading = this.modelsService.loading;
  readonly modelsError = this.modelsService.error;
  readonly defaultModel = this.settings.defaultModel;
  readonly webSearchDefault = this.settings.webSearchEnabled;

  protected readonly testStatus = signal<TestStatus>('idle');
  protected readonly testError = signal<string>('');
  protected readonly testEndpoint = signal<string>('');
  protected readonly awsInfoOpen = signal(false);

  protected readonly envImportMessage = signal<string | null>(null);
  protected readonly envImportOk = signal(false);

  @ViewChild('envFileInput') private envFileInput!: ElementRef<HTMLInputElement>;

  triggerEnvImport(): void {
    this.envFileInput.nativeElement.value = '';
    this.envFileInput.nativeElement.click();
  }

  onEnvFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const vars = this.parseEnv(text);
      const applied: string[] = [];

      const apiKey = vars['ANTHROPIC_API_KEY'];
      if (apiKey) {
        this.storage.setApiKey(apiKey);
        applied.push('API key');
      }
      const workspaceId = vars['ANTHROPIC_AWS_WORKSPACE_ID'];
      if (workspaceId) {
        this.settings.setAwsWorkspaceId(workspaceId);
        this.workspaceIdDraft.set(workspaceId);
        applied.push('Workspace ID');
      }
      const region = vars['ANTHROPIC_AWS_REGION'];
      if (region) {
        this.settings.setAwsRegion(region);
        applied.push('Region');
      }

      if (applied.length > 0) {
        this.envImportOk.set(true);
        this.envImportMessage.set(`Imported: ${applied.join(', ')}.`);
      } else {
        this.envImportOk.set(false);
        this.envImportMessage.set('No recognized variables found in the file.');
      }
    };
    reader.readAsText(file);
  }

  private parseEnv(text: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq).trim();
      const raw = trimmed.slice(eq + 1).trim();
      const value = raw.replace(/^(['"])(.*)\1$/, '$2');
      if (key && value) result[key] = value;
    }
    return result;
  }

  onClearRequested(): void {
    this.confirmingClear.set(true);
  }

  onCancelClear(): void {
    this.confirmingClear.set(false);
  }

  onConfirmClear(): void {
    this.questionsService.clearActivePack();
    this.confirmingClear.set(false);
  }

  onWorkspaceIdChange(value: string): void {
    this.workspaceIdDraft.set(value);
  }

  commitWorkspaceId(): void {
    this.settings.setAwsWorkspaceId(this.workspaceIdDraft());
  }

  onRegionChange(value: string): void {
    this.settings.setAwsRegion(value);
    this.resetTestStatus();
  }

  onDefaultModelChange(value: string): void {
    this.settings.setDefaultModel(value);
  }

  onToggleWebSearchDefault(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.settings.setWebSearchEnabled(checked);
  }

  refreshModels(): void {
    void this.modelsService.refresh();
  }

  availableHas(id: string): boolean {
    return this.availableModels().some((m) => m.id === id);
  }

  openAwsInfo(): void {
    this.awsInfoOpen.set(true);
  }

  closeAwsInfo(): void {
    this.awsInfoOpen.set(false);
  }

  resetTestStatus(): void {
    if (this.testStatus() !== 'idle') {
      this.testStatus.set('idle');
      this.testError.set('');
      this.testEndpoint.set('');
    }
  }

  async onTestConnection(): Promise<void> {
    const key = this.storage.apiKey();
    if (!key) {
      this.testStatus.set('failed');
      this.testError.set('No API key saved.');
      return;
    }
    this.testStatus.set('testing');
    this.testError.set('');
    this.testEndpoint.set('');

    const useAws = isAwsApiKey(key);
    const region = this.settings.awsRegion();
    const workspace = this.settings.awsWorkspaceId();

    try {
      await this.anthropic.testConnection(
        key,
        useAws ? { workspaceId: workspace, region } : undefined,
      );
      this.testStatus.set('ok');
      this.testEndpoint.set(
        useAws ? `aws-external-anthropic.${region}.api.aws` : 'api.anthropic.com',
      );
    } catch (err) {
      this.testStatus.set('failed');
      this.testError.set(err instanceof Error ? err.message : 'Connection failed.');
    }
  }
}
