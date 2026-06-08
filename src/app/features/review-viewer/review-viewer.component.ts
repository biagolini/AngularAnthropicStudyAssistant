import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Question } from '../../core/models/question.model';
import { QuestionsService } from '../../core/services/questions.service';
import { DomainBadgeComponent } from '../../shared/components/domain-badge.component';
import { MarkdownRendererComponent } from './markdown-renderer.component';

@Component({
  selector: 'app-review-viewer',
  standalone: true,
  imports: [DomainBadgeComponent, MarkdownRendererComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="viewer">
      @if (current(); as question) {
        <header class="viewer-header">
          @if (showBackButton()) {
            <button
              type="button"
              class="back-btn"
              (click)="back.emit()"
              aria-label="Back to question list"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M15 6l-6 6 6 6"
                />
              </svg>
              <span>Back</span>
            </button>
          }
          <div class="title-block">
            <h2>{{ question.title }}</h2>
            <app-domain-badge [domain]="question.domain" />
          </div>
          <button
            type="button"
            class="delete-btn"
            (click)="onDelete(question.id)"
            aria-label="Delete this question"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"
              />
            </svg>
          </button>
        </header>
        <div class="viewer-body">
          <app-markdown-renderer [source]="question.review" />
        </div>
      } @else {
        <div class="viewer-empty">
          <p class="empty-title">No question selected.</p>
          <p class="empty-body">Generate a new review or pick one from the list to view it here.</p>
        </div>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }
      .viewer {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--bg-surface);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);
        overflow: hidden;
      }
      .viewer-header {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        padding: var(--space-md) var(--space-lg);
        border-bottom: 1px solid var(--bg-border);
        background: var(--bg-surface);
      }
      .back-btn {
        display: inline-flex;
        align-items: center;
        gap: var(--space-xs);
        min-height: var(--touch-min);
        padding: 0 var(--space-sm);
        border-radius: var(--radius-md);
        color: var(--text-secondary);
        font-size: var(--font-size-sm);
      }
      .back-btn:hover {
        background: var(--bg-subtle);
        color: var(--text-primary);
      }
      .title-block {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }
      .title-block h2 {
        font-size: var(--font-size-lg);
        color: var(--text-primary);
        line-height: 1.3;
        overflow-wrap: anywhere;
      }
      .delete-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: var(--touch-min);
        height: var(--touch-min);
        border-radius: var(--radius-md);
        color: var(--text-muted);
      }
      .delete-btn:hover {
        background: var(--bg-subtle);
        color: var(--color-red);
      }
      .viewer-body {
        flex: 1;
        overflow-y: auto;
        padding: var(--space-lg);
      }
      .viewer-empty {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--space-xs);
        padding: var(--space-xl);
        color: var(--text-muted);
        text-align: center;
      }
      .empty-title {
        font-size: var(--font-size-lg);
        color: var(--text-secondary);
      }
      .empty-body {
        font-size: var(--font-size-sm);
      }
    `,
  ],
})
export class ReviewViewerComponent {
  private readonly questionsService = inject(QuestionsService);

  readonly question = input<Question | null>(null);
  readonly showBackButton = input<boolean>(false);

  readonly current = computed(() => this.question());

  readonly back = output<void>();
  readonly deleted = output<string>();

  onDelete(id: string): void {
    this.questionsService.remove(id);
    this.deleted.emit(id);
  }
}
