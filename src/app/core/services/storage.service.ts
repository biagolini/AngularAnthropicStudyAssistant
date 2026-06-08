import { Injectable, signal } from '@angular/core';
import { AppSettings, DEFAULT_SETTINGS } from '../models/settings.model';
import { Question } from '../models/question.model';

const PREFIX = 'cert_study__';
const KEY_API = `${PREFIX}api_key`;
const KEY_QUESTIONS = `${PREFIX}questions`;
const KEY_SETTINGS = `${PREFIX}settings`;

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly apiKeyState = signal<string | null>(this.read(KEY_API));
  readonly apiKey = this.apiKeyState.asReadonly();

  getApiKey(): string | null {
    return this.apiKeyState();
  }

  setApiKey(key: string): void {
    this.write(KEY_API, key);
    this.apiKeyState.set(key);
  }

  clearApiKey(): void {
    this.remove(KEY_API);
    this.apiKeyState.set(null);
  }

  getQuestions(): Question[] {
    const raw = this.read(KEY_QUESTIONS);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as Question[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  saveQuestions(questions: Question[]): void {
    this.write(KEY_QUESTIONS, JSON.stringify(questions));
  }

  clearQuestions(): void {
    this.remove(KEY_QUESTIONS);
  }

  getSettings(): AppSettings {
    const raw = this.read(KEY_SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS };
    try {
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return {
        certificationName: typeof parsed.certificationName === 'string' ? parsed.certificationName : DEFAULT_SETTINGS.certificationName,
        domains: Array.isArray(parsed.domains) ? parsed.domains.filter((d): d is string => typeof d === 'string') : [],
        theme: parsed.theme === 'dark' ? 'dark' : 'light',
        awsWorkspaceId: typeof parsed.awsWorkspaceId === 'string' ? parsed.awsWorkspaceId : DEFAULT_SETTINGS.awsWorkspaceId,
        awsRegion: typeof parsed.awsRegion === 'string' && parsed.awsRegion ? parsed.awsRegion : DEFAULT_SETTINGS.awsRegion,
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  saveSettings(settings: AppSettings): void {
    this.write(KEY_SETTINGS, JSON.stringify(settings));
  }

  private read(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private write(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore quota/security errors silently
    }
  }

  private remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}
