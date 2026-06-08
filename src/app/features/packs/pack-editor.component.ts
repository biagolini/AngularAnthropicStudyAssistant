import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MCP_CATALOG } from '../../core/models/mcp.model';
import {
  DEFAULT_PACK_COLOR,
  MAX_PACK_DOMAINS,
  PACK_COLORS,
  Pack,
} from '../../core/models/pack.model';
import { PacksService } from '../../core/services/packs.service';
import { QuestionsService } from '../../core/services/questions.service';

@Component({
  selector: 'app-pack-editor',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="pack-editor-title">
      <div class="card">
        <header class="card-header">
          <h2 id="pack-editor-title">
            {{ isEditMode() ? 'Edit pack' : 'New pack' }}
          </h2>
          <button
            type="button"
            class="close-btn"
            (click)="cancelled.emit()"
            aria-label="Close editor"
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

        <div class="card-body">
          <label class="field">
            <span class="field-label">Name</span>
            <input
              class="text-input"
              type="text"
              [(ngModel)]="nameDraft"
              placeholder="e.g. AWS Solutions Architect SAA-C03"
              aria-label="Pack name"
            />
          </label>

          <label class="field">
            <span class="field-label">Version (optional)</span>
            <input
              class="text-input"
              type="text"
              [(ngModel)]="versionDraft"
              placeholder="e.g. Practice exam 1"
              aria-label="Pack version"
            />
            <span class="field-hint">Shown after the name in the switcher.</span>
          </label>

          <div class="field">
            <span class="field-label">Color</span>
            <div class="color-grid" role="radiogroup" aria-label="Pack color">
              @for (color of colors; track color.id) {
                <button
                  type="button"
                  class="color-swatch"
                  role="radio"
                  [attr.aria-checked]="colorDraft() === color.value"
                  [attr.aria-label]="color.name"
                  [class.selected]="colorDraft() === color.value"
                  [style.background]="color.value"
                  (click)="setColor(color.value)"
                ></button>
              }
            </div>
          </div>

          @if (mcpCatalog.length > 0) {
            <div class="field">
              <span class="field-label">External knowledge (MCP)</span>
              <span class="field-hint">
                When enabled, the model can call these servers during Generate / Refine to look up authoritative content. Off by default.
              </span>
              <ul class="mcp-list">
                @for (entry of mcpCatalog; track entry.id) {
                  <li class="mcp-row">
                    <label class="mcp-label">
                      <input
                        type="checkbox"
                        [checked]="isMcpEnabled(entry.id)"
                        (change)="toggleMcp(entry.id)"
                        [attr.aria-label]="'Enable ' + entry.name"
                      />
                      <span class="mcp-meta">
                        <span class="mcp-name">{{ entry.name }}</span>
                        <span class="mcp-desc">{{ entry.description }}</span>
                      </span>
                    </label>
                  </li>
                }
              </ul>
            </div>
          }

          <div class="field">
            <span class="field-label">Knowledge Domains</span>
            <span class="field-hint">
              The AI classifies each question into one of these. Leave empty to label every question as General.
            </span>
            <div class="domain-input">
              <input
                class="text-input"
                type="text"
                [(ngModel)]="domainDraft"
                (keyup.enter)="onAddDomain()"
                placeholder="Add a domain"
                [disabled]="domains().length >= maxDomains"
                aria-label="New domain"
              />
              <button
                type="button"
                class="btn btn-secondary"
                (click)="onAddDomain()"
                [disabled]="!domainDraft.trim() || domains().length >= maxDomains"
              >
                Add
              </button>
            </div>
            @if (domainError()) {
              <p class="error">{{ domainError() }}</p>
            }
            <p class="count">{{ domains().length }} / {{ maxDomains }} domains</p>
            @if (domains().length > 0) {
              <ul class="chips">
                @for (domain of domains(); track domain) {
                  <li class="chip">
                    <span>{{ domain }}</span>
                    <button
                      type="button"
                      class="chip-remove"
                      (click)="removeDomain(domain)"
                      [attr.aria-label]="'Remove ' + domain"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                        <path
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          d="M5 5l14 14M19 5L5 19"
                        />
                      </svg>
                    </button>
                  </li>
                }
              </ul>
            }
          </div>
        </div>

        <footer class="card-footer">
          @if (isEditMode()) {
            <button type="button" class="btn btn-danger" (click)="onDeleteRequested()">
              Delete pack
            </button>
          }
          <span class="spacer"></span>
          <button type="button" class="btn btn-ghost" (click)="cancelled.emit()">Cancel</button>
          <button
            type="button"
            class="btn btn-primary"
            (click)="onSave()"
            [disabled]="!nameDraft.trim()"
          >
            Save
          </button>
        </footer>

        @if (confirmingDelete()) {
          <div class="confirm-overlay" role="dialog" aria-modal="true">
            <div class="confirm">
              <h3>Delete pack?</h3>
              <p>
                This deletes <strong>{{ nameDraft || 'this pack' }}</strong> and its {{ questionsInPack() }} question{{ questionsInPack() === 1 ? '' : 's' }} permanently. Other packs are not affected.
              </p>
              <div class="confirm-actions">
                <button type="button" class="btn btn-ghost" (click)="onCancelDelete()">Cancel</button>
                <button type="button" class="btn btn-danger" (click)="onConfirmDelete()">Delete</button>
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: contents;
      }
      .overlay {
        position: fixed;
        inset: 0;
        z-index: 60;
        background: var(--overlay-bg);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-md);
      }
      .card {
        position: relative;
        background: var(--bg-surface);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        width: min(480px, 100%);
        max-height: 90dvh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-md);
        padding: var(--space-md) var(--space-lg);
        border-bottom: 1px solid var(--bg-border);
      }
      .card-header h2 {
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
      .card-body {
        flex: 1;
        overflow-y: auto;
        padding: var(--space-lg);
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }
      .field-label {
        font-size: var(--font-size-sm);
        font-weight: 600;
        color: var(--text-primary);
      }
      .field-hint {
        font-size: var(--font-size-sm);
        color: var(--text-muted);
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
      }
      .text-input:focus-visible {
        outline: none;
        border-color: var(--color-purple);
      }
      .color-grid {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: var(--space-xs);
        max-width: 320px;
      }
      .color-swatch {
        width: 100%;
        aspect-ratio: 1;
        border-radius: var(--radius-md);
        border: 2px solid transparent;
        cursor: pointer;
        transition: transform var(--transition-fast), border-color var(--transition-fast);
      }
      .color-swatch:hover {
        transform: scale(1.05);
      }
      .color-swatch.selected {
        border-color: var(--text-primary);
        transform: scale(1.05);
        box-shadow: 0 0 0 2px var(--bg-surface), 0 0 0 4px var(--text-primary);
      }
      .domain-input {
        display: flex;
        gap: var(--space-sm);
      }
      .domain-input .text-input {
        flex: 1;
      }
      .mcp-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }
      .mcp-row {
        list-style: none;
      }
      .mcp-label {
        display: flex;
        align-items: flex-start;
        gap: var(--space-sm);
        padding: var(--space-sm);
        border-radius: var(--radius-md);
        border: 1px solid var(--bg-border);
        background: var(--bg-elevated);
        cursor: pointer;
        transition: border-color var(--transition-fast);
      }
      .mcp-label:hover {
        border-color: var(--color-purple);
      }
      .mcp-label input[type='checkbox'] {
        margin-top: 3px;
        accent-color: var(--color-purple);
        flex-shrink: 0;
      }
      .mcp-meta {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .mcp-name {
        font-weight: 600;
        color: var(--text-primary);
        font-size: var(--font-size-base);
      }
      .mcp-desc {
        font-size: var(--font-size-sm);
        color: var(--text-muted);
        line-height: 1.45;
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
      .btn-secondary {
        background: var(--bg-elevated);
        color: var(--text-primary);
        border: 1px solid var(--bg-border);
      }
      .btn-secondary:hover:not(:disabled) {
        background: var(--bg-subtle);
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
      .count {
        font-size: var(--font-size-sm);
        color: var(--text-faint);
      }
      .error {
        font-size: var(--font-size-sm);
        color: var(--color-red);
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
      .card-footer {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        padding: var(--space-md) var(--space-lg);
        border-top: 1px solid var(--bg-border);
      }
      .spacer {
        flex: 1;
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
export class PackEditorComponent {
  private readonly packs = inject(PacksService);
  private readonly questionsService = inject(QuestionsService);

  readonly pack = input<Pack | null>(null);
  readonly cancelled = output<void>();
  readonly saved = output<Pack>();
  readonly deleted = output<string>();

  protected readonly colors = PACK_COLORS;
  protected readonly maxDomains = MAX_PACK_DOMAINS;
  protected readonly mcpCatalog = MCP_CATALOG;

  protected nameDraft = '';
  protected versionDraft = '';
  protected domainDraft = '';
  protected readonly colorDraft = signal<string>(DEFAULT_PACK_COLOR);
  protected readonly domainsDraft = signal<string[]>([]);
  protected readonly mcpsDraft = signal<string[]>([]);
  protected readonly domainError = signal<string | null>(null);
  protected readonly confirmingDelete = signal(false);

  readonly isEditMode = computed(() => !!this.pack());
  readonly domains = this.domainsDraft.asReadonly();
  readonly questionsInPack = computed(() => {
    const p = this.pack();
    return p ? this.questionsService.allQuestions().filter((q) => q.packId === p.id).length : 0;
  });

  constructor() {
    // Sync drafts whenever the input pack changes.
    const sync = () => {
      const p = this.pack();
      this.nameDraft = p?.name ?? '';
      this.versionDraft = p?.version ?? '';
      this.colorDraft.set(p?.color ?? DEFAULT_PACK_COLOR);
      this.domainsDraft.set(p ? [...p.domains] : []);
      this.mcpsDraft.set(p ? [...(p.enabledMcps ?? [])] : []);
      this.domainDraft = '';
      this.domainError.set(null);
      this.confirmingDelete.set(false);
    };
    // Run sync once on construction.
    queueMicrotask(sync);
  }

  setColor(value: string): void {
    this.colorDraft.set(value);
  }

  onAddDomain(): void {
    const value = this.domainDraft.trim();
    if (!value) {
      this.domainError.set('Domain name cannot be empty.');
      return;
    }
    const current = this.domainsDraft();
    if (current.some((d) => d.toLowerCase() === value.toLowerCase())) {
      this.domainError.set('Domain already exists.');
      return;
    }
    if (current.length >= MAX_PACK_DOMAINS) {
      this.domainError.set(`Maximum ${MAX_PACK_DOMAINS} domains reached.`);
      return;
    }
    this.domainsDraft.set([...current, value]);
    this.domainDraft = '';
    this.domainError.set(null);
  }

  removeDomain(domain: string): void {
    this.domainsDraft.set(this.domainsDraft().filter((d) => d !== domain));
  }

  isMcpEnabled(id: string): boolean {
    return this.mcpsDraft().includes(id);
  }

  toggleMcp(id: string): void {
    const current = this.mcpsDraft();
    this.mcpsDraft.set(
      current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id],
    );
  }

  onSave(): void {
    const draft = {
      name: this.nameDraft.trim(),
      version: this.versionDraft.trim(),
      domains: this.domainsDraft(),
      color: this.colorDraft(),
      enabledMcps: this.mcpsDraft(),
    };
    if (!draft.name) return;
    const existing = this.pack();
    if (existing) {
      this.packs.update(existing.id, draft);
      const updated = this.packs.getById(existing.id);
      if (updated) this.saved.emit(updated);
    } else {
      const created = this.packs.create(draft);
      this.saved.emit(created);
    }
  }

  onDeleteRequested(): void {
    this.confirmingDelete.set(true);
  }

  onCancelDelete(): void {
    this.confirmingDelete.set(false);
  }

  onConfirmDelete(): void {
    const target = this.pack();
    if (!target) return;
    this.questionsService.removeByPackId(target.id);
    this.packs.remove(target.id);
    this.confirmingDelete.set(false);
    this.deleted.emit(target.id);
  }
}
