import { Injectable, computed, inject, signal } from '@angular/core';
import { AppSettings, MAX_DOMAINS, ThemeMode } from '../models/settings.model';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly storage = inject(StorageService);

  private readonly state = signal<AppSettings>(this.storage.getSettings());

  readonly settings = this.state.asReadonly();
  readonly certificationName = computed(() => this.state().certificationName);
  readonly domains = computed(() => this.state().domains);
  readonly theme = computed(() => this.state().theme);
  readonly hasDomains = computed(() => this.state().domains.length > 0);
  readonly domainCount = computed(() => this.state().domains.length);
  readonly canAddDomain = computed(() => this.state().domains.length < MAX_DOMAINS);

  setCertificationName(name: string): void {
    const trimmed = name.trim();
    this.update((s) => ({ ...s, certificationName: trimmed }));
  }

  addDomain(domain: string): boolean {
    const trimmed = domain.trim();
    if (!trimmed) return false;
    const current = this.state().domains;
    if (current.length >= MAX_DOMAINS) return false;
    const exists = current.some((d) => d.toLowerCase() === trimmed.toLowerCase());
    if (exists) return false;
    this.update((s) => ({ ...s, domains: [...s.domains, trimmed] }));
    return true;
  }

  removeDomain(domain: string): void {
    this.update((s) => ({ ...s, domains: s.domains.filter((d) => d !== domain) }));
  }

  reorderDomains(domains: string[]): void {
    this.update((s) => ({ ...s, domains: [...domains] }));
  }

  setTheme(theme: ThemeMode): void {
    this.update((s) => ({ ...s, theme }));
  }

  private update(updater: (current: AppSettings) => AppSettings): void {
    const next = updater(this.state());
    this.state.set(next);
    this.storage.saveSettings(next);
  }
}
