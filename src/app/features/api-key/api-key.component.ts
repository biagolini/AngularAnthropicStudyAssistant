import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StorageService } from '../../core/services/storage.service';
import { EyeToggleComponent } from '../../shared/components/eye-toggle.component';

const ALLOWED_PREFIXES = ['sk-ant-', 'AEA'] as const;

@Component({
  selector: 'app-api-key',
  standalone: true,
  imports: [FormsModule, EyeToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="api-key">
      <header class="section-header">
        <h3>API Key</h3>
        <p class="notice">
          Your API key is stored in this browser's local storage. Usage is billed to your Anthropic account (keys starting with <code>sk-ant-</code>) or to your AWS account (Claude Platform on AWS keys starting with <code>AEA</code>).
        </p>
      </header>

      @if (isEditing()) {
        <div class="field">
          <div class="input-row">
            <input
              [type]="visible() ? 'text' : 'password'"
              [(ngModel)]="draft"
              placeholder="sk-ant-... or AEA..."
              autocomplete="off"
              spellcheck="false"
              aria-label="Anthropic API key"
              class="text-input"
            />
            <app-eye-toggle [visible]="visible()" (toggle)="toggleVisibility()" />
          </div>
          @if (error()) {
            <p class="error">{{ error() }}</p>
          }
          <div class="actions">
            <button type="button" class="btn btn-primary" (click)="onSave()">Save</button>
            @if (hasStoredKey()) {
              <button type="button" class="btn btn-ghost" (click)="onCancel()">Cancel</button>
            }
          </div>
        </div>
      } @else {
        <div class="stored">
          <span class="masked" aria-label="Stored API key, masked">{{ maskedKey() }}</span>
          <button type="button" class="btn btn-ghost" (click)="onEdit()">Edit</button>
        </div>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .api-key {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }
      .section-header h3 {
        font-size: var(--font-size-lg);
        color: var(--text-primary);
        margin-bottom: var(--space-xs);
      }
      .notice {
        font-size: var(--font-size-sm);
        color: var(--text-muted);
        line-height: 1.45;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .input-row {
        display: flex;
        align-items: center;
        gap: var(--space-xs);
      }
      .text-input {
        flex: 1;
        height: var(--touch-min);
        padding: 0 var(--space-md);
        border-radius: var(--radius-md);
        border: 1px solid var(--bg-border);
        background: var(--bg-input);
        color: var(--text-primary);
        font-family: var(--font-mono);
        font-size: var(--font-size-base);
        transition: border-color var(--transition-fast);
      }
      .text-input:focus-visible {
        border-color: var(--color-purple);
        outline: none;
      }
      .actions {
        display: flex;
        gap: var(--space-sm);
      }
      .btn {
        min-height: var(--touch-min);
        padding: 0 var(--space-md);
        border-radius: var(--radius-md);
        font-weight: 600;
        font-size: var(--font-size-base);
        transition: background var(--transition-fast), color var(--transition-fast);
      }
      .btn-primary {
        background: var(--color-purple);
        color: #ffffff;
      }
      .btn-primary:hover {
        background: var(--color-blue);
      }
      .btn-ghost {
        background: transparent;
        color: var(--text-secondary);
        border: 1px solid var(--bg-border);
      }
      .btn-ghost:hover {
        background: var(--bg-subtle);
      }
      .error {
        color: var(--color-red);
        font-size: var(--font-size-sm);
      }
      .stored {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-sm);
        padding: var(--space-sm) var(--space-md);
        border-radius: var(--radius-md);
        background: var(--bg-elevated);
        border: 1px solid var(--bg-border);
      }
      .masked {
        font-family: var(--font-mono);
        color: var(--text-secondary);
        font-size: var(--font-size-base);
        letter-spacing: 0.04em;
      }
    `,
  ],
})
export class ApiKeyComponent {
  private readonly storage = inject(StorageService);

  private readonly storedKey = this.storage.apiKey;
  protected readonly visible = signal(false);
  protected readonly editing = signal(this.storedKey() === null);
  protected readonly error = signal<string | null>(null);

  protected draft = '';

  readonly hasStoredKey = computed(() => this.storedKey() !== null);
  readonly isEditing = computed(() => this.editing());
  readonly maskedKey = computed(() => {
    const key = this.storedKey();
    if (!key) return '';
    const prefix = ALLOWED_PREFIXES.find((p) => key.startsWith(p)) ?? key.slice(0, 3);
    const tail = key.slice(-4);
    const stars = Math.max(4, key.length - prefix.length - 4);
    return `${prefix}${'*'.repeat(stars)}${tail}`;
  });

  toggleVisibility(): void {
    this.visible.update((v) => !v);
  }

  onEdit(): void {
    this.draft = this.storedKey() ?? '';
    this.editing.set(true);
    this.error.set(null);
  }

  onCancel(): void {
    this.draft = '';
    this.editing.set(false);
    this.error.set(null);
    this.visible.set(false);
  }

  onSave(): void {
    const value = this.draft.trim();
    if (!value) {
      this.error.set('API key cannot be empty.');
      return;
    }
    const validPrefix = ALLOWED_PREFIXES.some((p) => value.startsWith(p));
    if (!validPrefix) {
      this.error.set('Key must start with "sk-ant-" (Anthropic Console) or "AEA" (Claude Platform on AWS).');
      return;
    }
    this.storage.setApiKey(value);
    this.draft = '';
    this.visible.set(false);
    this.editing.set(false);
    this.error.set(null);
  }
}
