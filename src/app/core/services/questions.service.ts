import { Injectable, computed, inject, signal } from '@angular/core';
import { Question } from '../models/question.model';
import { DEFAULT_DOMAIN } from '../models/settings.model';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class QuestionsService {
  private readonly storage = inject(StorageService);

  private readonly state = signal<Question[]>(this.storage.getQuestions());
  private readonly selectedIdsState = signal<ReadonlySet<string>>(new Set());

  readonly questions = computed(() =>
    [...this.state()].sort((a, b) => b.createdAt - a.createdAt),
  );
  readonly count = computed(() => this.state().length);
  readonly selectedIds = this.selectedIdsState.asReadonly();
  readonly selectedCount = computed(() => this.selectedIdsState().size);

  readonly selectedQuestions = computed(() => {
    const ids = this.selectedIdsState();
    return this.questions().filter((q) => ids.has(q.id));
  });

  readonly domainBreakdown = computed(() => {
    const counts = new Map<string, number>();
    for (const q of this.selectedQuestions()) {
      counts.set(q.domain, (counts.get(q.domain) ?? 0) + 1);
    }
    return [...counts.entries()].map(([domain, total]) => ({ domain, total }));
  });

  add(question: Question): void {
    const next = [question, ...this.state()];
    this.persist(next);
  }

  updateDomain(id: string, domain: string): void {
    const next = this.state().map((q) =>
      q.id === id ? { ...q, domain: domain || DEFAULT_DOMAIN } : q,
    );
    this.persist(next);
  }

  remove(id: string): void {
    this.persist(this.state().filter((q) => q.id !== id));
    this.deselect(id);
  }

  clearAll(): void {
    this.state.set([]);
    this.storage.clearQuestions();
    this.selectedIdsState.set(new Set());
  }

  toggleSelected(id: string): void {
    const next = new Set(this.selectedIdsState());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedIdsState.set(next);
  }

  selectAll(): void {
    this.selectedIdsState.set(new Set(this.state().map((q) => q.id)));
  }

  deselectAll(): void {
    this.selectedIdsState.set(new Set());
  }

  deselect(id: string): void {
    if (!this.selectedIdsState().has(id)) return;
    const next = new Set(this.selectedIdsState());
    next.delete(id);
    this.selectedIdsState.set(next);
  }

  getById(id: string): Question | undefined {
    return this.state().find((q) => q.id === id);
  }

  private persist(next: Question[]): void {
    this.state.set(next);
    this.storage.saveQuestions(next);
  }
}
