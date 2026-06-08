import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { QuestionsService } from '../../core/services/questions.service';
import { SettingsService } from '../../core/services/settings.service';
import { ApiKeyComponent } from '../api-key/api-key.component';

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
            <h3>Certification Name</h3>
          </header>
          <input
            class="text-input"
            type="text"
            placeholder="e.g. AWS Solutions Architect SAA-C03"
            [ngModel]="certName()"
            (ngModelChange)="onCertNameChange($event)"
            (blur)="commitCertName()"
            (keyup.enter)="commitCertName()"
            aria-label="Certification name"
          />
        </section>

        <section class="block">
          <header class="section-header">
            <h3>Knowledge Domains</h3>
            <p class="helper">
              Define the domains for this certification. The AI will classify each question into one of these domains. If left empty, all questions go to General.
            </p>
          </header>

          <div class="domain-input">
            <input
              class="text-input"
              type="text"
              placeholder="Add a domain"
              [(ngModel)]="domainDraft"
              (keyup.enter)="onAddDomain()"
              aria-label="New domain name"
              [disabled]="!canAdd()"
            />
            <button
              type="button"
              class="btn btn-primary"
              (click)="onAddDomain()"
              [disabled]="!canAdd() || !domainDraft.trim()"
            >
              Add
            </button>
          </div>
          @if (domainError()) {
            <p class="error">{{ domainError() }}</p>
          }
          <p class="count">{{ domains().length }} / 20 domains</p>

          @if (domains().length > 0) {
            <ul class="chips">
              @for (domain of domains(); track domain) {
                <li class="chip">
                  <span>{{ domain }}</span>
                  <button
                    type="button"
                    class="chip-remove"
                    (click)="onRemoveDomain(domain)"
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
          } @else {
            <p class="empty">No domains defined yet. Questions will be classified as General.</p>
          }
        </section>

        <section class="block">
          <app-api-key />
        </section>

        <section class="block danger">
          <header class="section-header">
            <h3>Danger Zone</h3>
          </header>
          <button
            type="button"
            class="btn btn-danger"
            (click)="onClearRequested()"
            [disabled]="questionCount() === 0"
          >
            Clear all questions
          </button>
          <p class="helper">{{ questionCount() }} stored question{{ questionCount() === 1 ? '' : 's' }}.</p>
        </section>
      </div>

      @if (confirmingClear()) {
        <div class="confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div class="confirm">
            <h3 id="confirm-title">Clear all questions?</h3>
            <p>
              This will permanently delete all {{ questionCount() }} question{{ questionCount() === 1 ? '' : 's' }}. Your settings and API key will not be affected.
            </p>
            <div class="confirm-actions">
              <button type="button" class="btn btn-ghost" (click)="onCancelClear()">Cancel</button>
              <button type="button" class="btn btn-danger" (click)="onConfirmClear()">Delete all</button>
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
      .count {
        font-size: var(--font-size-sm);
        color: var(--text-faint);
      }
      .error {
        color: var(--color-red);
        font-size: var(--font-size-sm);
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

  protected readonly certNameDraft = signal(this.settings.certificationName());
  protected readonly domainError = signal<string | null>(null);
  protected readonly confirmingClear = signal(false);
  protected domainDraft = '';

  readonly closed = output<void>();

  readonly certName = computed(() => this.certNameDraft());
  readonly domains = this.settings.domains;
  readonly canAdd = this.settings.canAddDomain;
  readonly questionCount = this.questionsService.count;

  onCertNameChange(value: string): void {
    this.certNameDraft.set(value);
  }

  commitCertName(): void {
    this.settings.setCertificationName(this.certNameDraft());
  }

  onAddDomain(): void {
    const value = this.domainDraft.trim();
    if (!value) {
      this.domainError.set('Domain name cannot be empty.');
      return;
    }
    const added = this.settings.addDomain(value);
    if (!added) {
      const exists = this.settings
        .domains()
        .some((d) => d.toLowerCase() === value.toLowerCase());
      this.domainError.set(exists ? 'Domain already exists.' : 'Maximum 20 domains reached.');
      return;
    }
    this.domainDraft = '';
    this.domainError.set(null);
  }

  onRemoveDomain(domain: string): void {
    this.settings.removeDomain(domain);
  }

  onClearRequested(): void {
    this.confirmingClear.set(true);
  }

  onCancelClear(): void {
    this.confirmingClear.set(false);
  }

  onConfirmClear(): void {
    this.questionsService.clearAll();
    this.confirmingClear.set(false);
  }
}
