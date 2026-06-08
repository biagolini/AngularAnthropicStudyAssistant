import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { Question } from '../../core/models/question.model';
import { SettingsService } from '../../core/services/settings.service';
import { DEFAULT_DOMAIN } from '../../core/models/settings.model';
import { DomainBadgeComponent } from '../../shared/components/domain-badge.component';
import { TruncatePipe } from '../../shared/pipes/truncate.pipe';

@Component({
  selector: 'app-question-item',
  standalone: true,
  imports: [DomainBadgeComponent, TruncatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row" [class.active]="active()">
      <label class="check" [attr.aria-label]="checkboxLabel()">
        <input
          type="checkbox"
          [checked]="selected()"
          (change)="selectionToggled.emit()"
        />
        <span class="check-box" aria-hidden="true"></span>
      </label>

      <button
        type="button"
        class="content"
        (click)="opened.emit()"
        [attr.aria-label]="'Open review for ' + question().title"
      >
        <span class="title">{{ question().title | truncate: 120 }}</span>
      </button>

      <div class="domain-control" (click)="$event.stopPropagation()">
        @if (showPicker()) {
          <select
            class="domain-select"
            [value]="question().domain"
            (change)="onPickDomain($event)"
            (blur)="closePicker()"
            aria-label="Change domain"
          >
            @for (option of domainOptions(); track option) {
              <option [value]="option">{{ option }}</option>
            }
          </select>
        } @else {
          <button
            type="button"
            class="badge-btn"
            (click)="openPicker()"
            aria-label="Change domain"
          >
            <app-domain-badge [domain]="question().domain" />
          </button>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .row {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: var(--space-sm);
        padding: var(--space-sm) var(--space-md);
        background: var(--bg-surface);
        border-radius: var(--radius-md);
        border: 1px solid transparent;
        transition: background var(--transition-fast), border-color var(--transition-fast);
      }
      .row:hover {
        background: var(--bg-elevated);
      }
      .row.active {
        border-color: var(--color-purple);
        background: var(--bg-elevated);
      }
      .check {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: var(--touch-min);
        height: var(--touch-min);
        cursor: pointer;
        position: relative;
      }
      .check input {
        position: absolute;
        opacity: 0;
        width: 100%;
        height: 100%;
        margin: 0;
        cursor: pointer;
      }
      .check-box {
        width: 20px;
        height: 20px;
        border-radius: var(--radius-sm);
        border: 1.5px solid var(--bg-border);
        background: var(--bg-input);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: background var(--transition-fast), border-color var(--transition-fast);
      }
      .check input:checked + .check-box {
        background: var(--color-purple);
        border-color: var(--color-purple);
      }
      .check input:checked + .check-box::after {
        content: '';
        width: 10px;
        height: 6px;
        border-left: 2px solid #ffffff;
        border-bottom: 2px solid #ffffff;
        transform: rotate(-45deg) translate(0, -2px);
      }
      .content {
        text-align: left;
        min-height: var(--touch-min);
        display: flex;
        align-items: center;
        color: var(--text-primary);
        font-size: var(--font-size-base);
        line-height: 1.4;
        padding: var(--space-xs) 0;
      }
      .title {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .domain-control {
        display: inline-flex;
      }
      .badge-btn {
        display: inline-flex;
        align-items: center;
        min-height: var(--touch-min);
        padding: 0 var(--space-xs);
      }
      .domain-select {
        height: 32px;
        padding: 0 var(--space-sm);
        border-radius: var(--radius-md);
        border: 1px solid var(--bg-border);
        background: var(--bg-input);
        color: var(--text-primary);
        font-size: var(--font-size-sm);
      }
    `,
  ],
})
export class QuestionItemComponent {
  private readonly settings = inject(SettingsService);

  readonly question = input.required<Question>();
  readonly selected = input.required<boolean>();
  readonly active = input<boolean>(false);

  readonly opened = output<void>();
  readonly selectionToggled = output<void>();
  readonly domainChanged = output<string>();

  protected readonly pickerOpen = signal(false);
  readonly showPicker = computed(() => this.pickerOpen());

  readonly domainOptions = computed(() => {
    const defined = this.settings.domains();
    const current = this.question().domain;
    const merged = [...defined];
    if (!merged.includes(DEFAULT_DOMAIN)) merged.push(DEFAULT_DOMAIN);
    if (current && !merged.includes(current)) merged.unshift(current);
    return merged;
  });

  readonly checkboxLabel = computed(() =>
    this.selected() ? `Deselect ${this.question().title}` : `Select ${this.question().title}`,
  );

  openPicker(): void {
    this.pickerOpen.set(true);
  }

  closePicker(): void {
    this.pickerOpen.set(false);
  }

  onPickDomain(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.domainChanged.emit(value);
    this.pickerOpen.set(false);
  }
}
