import { Injectable, computed, inject, signal } from '@angular/core';
import { AppSettings, ThemeMode } from '../models/settings.model';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly storage = inject(StorageService);

  private readonly state = signal<AppSettings>(this.storage.getSettings());

  readonly settings = this.state.asReadonly();
  readonly theme = computed(() => this.state().theme);
  readonly awsWorkspaceId = computed(() => this.state().awsWorkspaceId);
  readonly awsRegion = computed(() => this.state().awsRegion);
  readonly defaultModel = computed(() => this.state().defaultModel);
  readonly activePackId = computed(() => this.state().activePackId);

  setTheme(theme: ThemeMode): void {
    this.update((s) => ({ ...s, theme }));
  }

  setAwsWorkspaceId(value: string): void {
    this.update((s) => ({ ...s, awsWorkspaceId: value.trim() }));
  }

  setAwsRegion(value: string): void {
    this.update((s) => ({ ...s, awsRegion: value.trim() || 'us-east-1' }));
  }

  setDefaultModel(value: string): void {
    this.update((s) => ({ ...s, defaultModel: value.trim() || s.defaultModel }));
  }

  setActivePackId(id: string): void {
    if (id === this.state().activePackId) return;
    this.update((s) => ({ ...s, activePackId: id }));
  }

  private update(updater: (current: AppSettings) => AppSettings): void {
    const next = updater(this.state());
    this.state.set(next);
    this.storage.saveSettings(next);
  }
}
