import { Injectable, signal } from '@angular/core';
import { Question } from '../models/question.model';
import {
  DEFAULT_PACK_COLOR,
  DEFAULT_PACK_NAME,
  Pack,
} from '../models/pack.model';
import { AppSettings, DEFAULT_SETTINGS } from '../models/settings.model';

const PREFIX = 'cert_study__';
const KEY_API = `${PREFIX}api_key`;
const KEY_QUESTIONS = `${PREFIX}questions`;
const KEY_SETTINGS = `${PREFIX}settings`;
const KEY_PACKS = `${PREFIX}packs`;

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly apiKeyState = signal<string | null>(this.read(KEY_API));
  readonly apiKey = this.apiKeyState.asReadonly();

  constructor() {
    this.migrateIfNeeded();
  }

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
      return Array.isArray(parsed)
        ? parsed.filter((q) => q && typeof q.id === 'string' && typeof q.packId === 'string')
        : [];
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

  getPacks(): Pack[] {
    const raw = this.read(KEY_PACKS);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as Pack[];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string')
        .map((p) => ({
          id: p.id,
          name: p.name,
          version: typeof p.version === 'string' ? p.version : '',
          domains: Array.isArray(p.domains) ? p.domains.filter((d): d is string => typeof d === 'string') : [],
          color: typeof p.color === 'string' && p.color ? p.color : DEFAULT_PACK_COLOR,
          createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
          updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : Date.now(),
        }));
    } catch {
      return [];
    }
  }

  savePacks(packs: Pack[]): void {
    this.write(KEY_PACKS, JSON.stringify(packs));
  }

  getSettings(): AppSettings {
    const raw = this.read(KEY_SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS };
    try {
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return {
        theme: parsed.theme === 'dark' ? 'dark' : 'light',
        awsWorkspaceId: typeof parsed.awsWorkspaceId === 'string' ? parsed.awsWorkspaceId : DEFAULT_SETTINGS.awsWorkspaceId,
        awsRegion: typeof parsed.awsRegion === 'string' && parsed.awsRegion ? parsed.awsRegion : DEFAULT_SETTINGS.awsRegion,
        defaultModel: typeof parsed.defaultModel === 'string' && parsed.defaultModel ? parsed.defaultModel : DEFAULT_SETTINGS.defaultModel,
        activePackId: typeof parsed.activePackId === 'string' ? parsed.activePackId : DEFAULT_SETTINGS.activePackId,
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  saveSettings(settings: AppSettings): void {
    this.write(KEY_SETTINGS, JSON.stringify(settings));
  }

  private migrateIfNeeded(): void {
    if (this.read(KEY_PACKS)) return;

    const legacyRaw = this.read(KEY_SETTINGS);
    let legacyName = '';
    let legacyDomains: string[] = [];
    if (legacyRaw) {
      try {
        const legacy = JSON.parse(legacyRaw) as Partial<{
          certificationName: string;
          domains: string[];
        }>;
        if (typeof legacy.certificationName === 'string') legacyName = legacy.certificationName.trim();
        if (Array.isArray(legacy.domains)) {
          legacyDomains = legacy.domains.filter((d): d is string => typeof d === 'string');
        }
      } catch {
        // ignore
      }
    }

    const legacyQuestions = this.getQuestionsLoose();
    const hasLegacyData = !!legacyName || legacyDomains.length > 0 || legacyQuestions.length > 0;

    const now = Date.now();
    const seedPack: Pack = {
      id: this.uuid(),
      name: hasLegacyData ? legacyName || DEFAULT_PACK_NAME : DEFAULT_PACK_NAME,
      version: '',
      domains: legacyDomains,
      color: DEFAULT_PACK_COLOR,
      createdAt: now,
      updatedAt: now,
    };

    this.savePacks([seedPack]);

    if (legacyQuestions.length > 0) {
      const migrated = legacyQuestions.map((q) => ({ ...q, packId: q.packId || seedPack.id }));
      this.saveQuestions(migrated);
    }

    const current = this.getSettings();
    this.saveSettings({ ...current, activePackId: seedPack.id });
  }

  private getQuestionsLoose(): Question[] {
    const raw = this.read(KEY_QUESTIONS);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as Array<Partial<Question> & { id?: string; title?: string }>;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((q): q is Question & { packId?: string } => !!q && typeof q.id === 'string')
        .map((q) => ({
          id: q.id!,
          packId: typeof q.packId === 'string' ? q.packId : '',
          title: typeof q.title === 'string' ? q.title : '',
          domain: typeof q.domain === 'string' ? q.domain : 'General',
          review: typeof q.review === 'string' ? q.review : '',
          createdAt: typeof q.createdAt === 'number' ? q.createdAt : Date.now(),
        }));
    } catch {
      return [];
    }
  }

  private uuid(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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
