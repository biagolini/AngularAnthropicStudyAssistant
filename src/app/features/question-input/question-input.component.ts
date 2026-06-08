import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AnthropicService } from '../../core/services/anthropic.service';
import { ModelsService } from '../../core/services/models.service';
import { PacksService } from '../../core/services/packs.service';
import { QuestionsService } from '../../core/services/questions.service';
import { SettingsService } from '../../core/services/settings.service';
import { StorageService } from '../../core/services/storage.service';
import { Question } from '../../core/models/question.model';
import {
  parseDomainFromResponse,
  parseTitleFromResponse,
  stripInferredMetadata,
} from '../../core/utils/domain-inference.util';

@Component({
  selector: 'app-question-input',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="input-card">
      <header class="card-header">
        <h2>New Question</h2>
        <p class="subtitle">Paste the full exam question with all alternatives.</p>
      </header>

      @if (!hasApiKey()) {
        <div class="warning" role="alert">
          Set your Anthropic API key in Settings before generating reviews.
        </div>
      }

      <label class="textarea-wrap">
        <span class="visually-hidden">Question text</span>
        <textarea
          [(ngModel)]="draft"
          [disabled]="!hasApiKey() || loading()"
          rows="8"
          placeholder="Paste the question stem and all alternatives (A, B, C, D) here..."
          class="textarea"
        ></textarea>
      </label>

      <label class="model-row">
        <span class="model-label">Model</span>
        <select
          class="model-select"
          [ngModel]="selectedModel()"
          (ngModelChange)="onSelectModel($event)"
          [disabled]="loading()"
          aria-label="Model for this generation"
        >
          @for (model of availableModels(); track model.id) {
            <option [value]="model.id">{{ model.displayName }} — {{ model.tier }}</option>
          }
        </select>
      </label>

      <button
        type="button"
        class="generate-btn"
        (click)="onGenerate()"
        [disabled]="!canGenerate()"
      >
        @if (loading()) {
          <span class="spinner" aria-hidden="true"></span>
          <span>Generating...</span>
        } @else {
          <span>Generate Review</span>
        }
      </button>

      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .input-card {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
        padding: var(--space-lg);
        background: var(--bg-surface);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);
      }
      .card-header h2 {
        font-size: var(--font-size-xl);
        margin-bottom: var(--space-xs);
      }
      .subtitle {
        color: var(--text-muted);
        font-size: var(--font-size-sm);
      }
      .warning {
        background: var(--bg-elevated);
        color: var(--color-amber);
        padding: var(--space-sm) var(--space-md);
        border-radius: var(--radius-md);
        border: 1px solid var(--color-amber);
        font-size: var(--font-size-sm);
      }
      .model-row {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }
      .model-label {
        font-size: var(--font-size-sm);
        color: var(--text-muted);
      }
      .model-select {
        flex: 1;
        min-height: 36px;
        padding: 0 var(--space-sm);
        border-radius: var(--radius-md);
        border: 1px solid var(--bg-border);
        background: var(--bg-input);
        color: var(--text-primary);
        font-size: var(--font-size-sm);
      }
      .model-select:focus-visible {
        outline: none;
        border-color: var(--color-purple);
      }
      .model-select:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .textarea-wrap {
        display: block;
      }
      .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        margin: -1px;
        padding: 0;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
        border: 0;
      }
      .textarea {
        width: 100%;
        min-height: 180px;
        padding: var(--space-md);
        border-radius: var(--radius-md);
        border: 1px solid var(--bg-border);
        background: var(--bg-input);
        color: var(--text-primary);
        font-family: var(--font-family);
        font-size: var(--font-size-base);
        line-height: 1.55;
        resize: vertical;
        transition: border-color var(--transition-fast);
      }
      .textarea:focus-visible {
        outline: none;
        border-color: var(--color-purple);
      }
      .textarea:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .generate-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-sm);
        width: 100%;
        min-height: 48px;
        padding: 0 var(--space-lg);
        border-radius: var(--radius-md);
        background: linear-gradient(135deg, var(--color-purple), var(--color-blue));
        color: #ffffff;
        font-weight: 600;
        font-size: var(--font-size-lg);
        transition: filter var(--transition-fast);
      }
      .generate-btn:hover:not(:disabled) {
        filter: brightness(1.08);
      }
      .generate-btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .spinner {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.4);
        border-top-color: #ffffff;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      .error {
        color: var(--color-red);
        font-size: var(--font-size-sm);
      }
    `,
  ],
})
export class QuestionInputComponent {
  private readonly anthropic = inject(AnthropicService);
  private readonly storage = inject(StorageService);
  private readonly settings = inject(SettingsService);
  private readonly questionsService = inject(QuestionsService);
  private readonly modelsService = inject(ModelsService);
  private readonly packs = inject(PacksService);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly modelOverride = signal<string | null>(null);
  protected draft = '';

  readonly hasApiKey = computed(() => !!this.storage.apiKey());
  readonly canGenerate = computed(() => this.hasApiKey() && !this.loading());
  readonly availableModels = this.modelsService.models;
  readonly selectedModel = computed(
    () => this.modelOverride() ?? this.modelsService.resolveModel(this.settings.defaultModel()),
  );

  readonly generated = output<Question>();

  onSelectModel(value: string): void {
    this.modelOverride.set(value);
  }

  async onGenerate(): Promise<void> {
    const text = this.draft.trim();
    if (!text) {
      this.error.set('Question text cannot be empty.');
      return;
    }
    const apiKey = this.storage.getApiKey();
    if (!apiKey) {
      this.error.set('Missing API key. Open Settings to add it.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const activePack = this.packs.activePack();
      const domains = activePack.domains;
      const certName = activePack.name;
      const awsOptions = apiKey.startsWith('AEA')
        ? { workspaceId: this.settings.awsWorkspaceId(), region: this.settings.awsRegion() }
        : undefined;
      const raw = await this.anthropic.generateReview(
        text,
        apiKey,
        certName,
        domains,
        awsOptions,
        this.selectedModel(),
      );
      const domain = parseDomainFromResponse(raw, domains);
      const fallbackTitle = text.slice(0, 80).replace(/\s+/g, ' ').trim();
      const title = parseTitleFromResponse(raw, fallbackTitle);
      const review = stripInferredMetadata(raw);

      const question: Question = {
        id: crypto.randomUUID(),
        packId: activePack.id,
        title,
        domain,
        review,
        createdAt: Date.now(),
      };

      this.questionsService.add(question);
      this.draft = '';
      this.modelOverride.set(null);
      this.generated.emit(question);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to generate review.');
    } finally {
      this.loading.set(false);
    }
  }
}
