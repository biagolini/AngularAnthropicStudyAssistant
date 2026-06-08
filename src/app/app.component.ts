import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Question } from './core/models/question.model';
import { QuestionsService } from './core/services/questions.service';
import { SettingsService } from './core/services/settings.service';
import { ThemeService } from './core/services/theme.service';
import { ExportComponent } from './features/export/export.component';
import { QuestionInputComponent } from './features/question-input/question-input.component';
import { QuestionListComponent } from './features/question-list/question-list.component';
import { ReviewViewerComponent } from './features/review-viewer/review-viewer.component';
import { SettingsComponent } from './features/settings/settings.component';
import { ThemeToggleComponent } from './shared/components/theme-toggle.component';

type Tab = 'input' | 'questions' | 'export';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    QuestionInputComponent,
    QuestionListComponent,
    ReviewViewerComponent,
    ExportComponent,
    SettingsComponent,
    ThemeToggleComponent,
  ],
  styleUrl: './app.component.scss',
  template: `
    <div class="shell">
      <header class="app-header">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true"></span>
          <div class="brand-text">
            <span class="brand-title">{{ headerTitle() }}</span>
            <span class="brand-subtitle">IT Certification Study App</span>
          </div>
        </div>
        <div class="header-actions">
          <app-theme-toggle />
          <button
            type="button"
            class="icon-btn"
            (click)="openSettings()"
            aria-label="Open settings"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linejoin="round"
                d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z"
              />
              <path
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linejoin="round"
                d="M19.4 13.5l1.6 1-2 3.4-1.9-.6a7.6 7.6 0 01-2 1.2l-.5 2H10.4l-.5-2a7.6 7.6 0 01-2-1.2l-1.9.6-2-3.4 1.6-1A7.6 7.6 0 014.5 12c0-.5.1-1 .2-1.5l-1.6-1 2-3.4 1.9.6a7.6 7.6 0 012-1.2l.5-2h4.2l.5 2c.7.3 1.4.7 2 1.2l1.9-.6 2 3.4-1.6 1c.1.5.2 1 .2 1.5s-.1 1-.2 1.5z"
              />
            </svg>
          </button>
        </div>
      </header>

      <main class="app-main" [class.mode-export]="showExport()">
        @if (showLeftColumn()) {
          <section class="column column-left">
            <div class="stack">
              @if (showInputForm()) {
                <app-question-input (generated)="onGenerated($event)" />
              }
              @if (showListPanel()) {
                <app-question-list
                  [activeId]="activeQuestionId()"
                  (opened)="onOpenQuestion($event)"
                />
              }
            </div>
          </section>
        }

        @if (showViewerPanel()) {
          <section class="column column-right">
            <app-review-viewer
              [question]="activeQuestion()"
              [showBackButton]="isMobile()"
              (back)="onCloseViewer()"
              (deleted)="onDeleted($event)"
            />
          </section>
        }

        @if (showExport()) {
          <section class="column column-export">
            <app-export />
          </section>
        }
      </main>

      <nav class="tabbar" aria-label="Primary">
        <button
          type="button"
          class="tab"
          [class.active]="activeTab() === 'input'"
          (click)="setTab('input')"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4 5h16v14H4zM4 9h16M8 13h8M8 16h5"
            />
          </svg>
          <span>Input</span>
        </button>
        <button
          type="button"
          class="tab"
          [class.active]="activeTab() === 'questions'"
          (click)="setTab('questions')"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4 6h16M4 12h16M4 18h10"
            />
          </svg>
          <span>Questions</span>
          @if (questionCount() > 0) {
            <span class="badge">{{ questionCount() }}</span>
          }
        </button>
        <button
          type="button"
          class="tab"
          [class.active]="activeTab() === 'export'"
          (click)="setTab('export')"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 4v12M7 11l5 5 5-5M4 20h16"
            />
          </svg>
          <span>Export</span>
          @if (selectedCount() > 0) {
            <span class="badge">{{ selectedCount() }}</span>
          }
        </button>
      </nav>

      @if (settingsOpen()) {
        <div class="overlay" (click)="closeSettings()" aria-hidden="true"></div>
        <aside class="drawer-host" role="dialog" aria-label="Settings">
          <app-settings (closed)="closeSettings()" />
        </aside>
      }
    </div>
  `,
})
export class AppComponent {
  private readonly settings = inject(SettingsService);
  private readonly questionsService = inject(QuestionsService);
  protected readonly themeService = inject(ThemeService);

  protected readonly activeTab = signal<Tab>('input');
  protected readonly activeQuestionId = signal<string | null>(null);
  protected readonly settingsOpen = signal(false);
  private readonly viewportWidth = signal<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1024,
  );

  readonly headerTitle = computed(() => this.settings.certificationName() || 'Study Workspace');
  readonly questionCount = this.questionsService.count;
  readonly selectedCount = this.questionsService.selectedCount;

  readonly isMobile = computed(() => this.viewportWidth() < 768);

  readonly activeQuestion = computed(() => {
    const id = this.activeQuestionId();
    if (!id) return null;
    return this.questionsService.questions().find((q) => q.id === id) ?? null;
  });

  readonly showExport = computed(() => this.activeTab() === 'export');

  readonly showInputForm = computed(() => {
    if (this.showExport()) return false;
    if (this.isMobile()) return this.activeTab() === 'input';
    return true;
  });

  readonly showListPanel = computed(() => {
    if (this.showExport()) return false;
    if (this.isMobile()) {
      return this.activeTab() === 'questions' && !this.activeQuestionId();
    }
    return true;
  });

  readonly showViewerPanel = computed(() => {
    if (this.showExport()) return false;
    if (this.isMobile()) {
      return this.activeTab() === 'questions' && !!this.activeQuestionId();
    }
    return true;
  });

  readonly showLeftColumn = computed(() => this.showInputForm() || this.showListPanel());

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.viewportWidth.set(window.innerWidth));
    }
    effect(() => {
      const open = this.settingsOpen();
      if (typeof document === 'undefined') return;
      document.body.style.overflow = open ? 'hidden' : '';
    });
  }

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
    if (tab !== 'questions') {
      this.activeQuestionId.set(null);
    }
  }

  openSettings(): void {
    this.settingsOpen.set(true);
  }

  closeSettings(): void {
    this.settingsOpen.set(false);
  }

  onGenerated(question: Question): void {
    this.activeQuestionId.set(question.id);
    if (this.isMobile()) this.activeTab.set('questions');
  }

  onOpenQuestion(question: Question): void {
    this.activeQuestionId.set(question.id);
    if (this.isMobile()) this.activeTab.set('questions');
  }

  onCloseViewer(): void {
    this.activeQuestionId.set(null);
  }

  onDeleted(id: string): void {
    if (this.activeQuestionId() === id) {
      this.activeQuestionId.set(null);
    }
  }
}
