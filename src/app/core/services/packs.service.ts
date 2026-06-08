import { Injectable, computed, inject, signal } from '@angular/core';
import {
  DEFAULT_PACK_COLOR,
  DEFAULT_PACK_NAME,
  MAX_PACK_DOMAINS,
  Pack,
  isValidPackColor,
} from '../models/pack.model';
import { SettingsService } from './settings.service';
import { StorageService } from './storage.service';

export interface PackDraft {
  name: string;
  version: string;
  domains: string[];
  color: string;
}

@Injectable({ providedIn: 'root' })
export class PacksService {
  private readonly storage = inject(StorageService);
  private readonly settings = inject(SettingsService);

  private readonly state = signal<Pack[]>(this.bootstrapPacks());

  readonly packs = computed(() =>
    [...this.state()].sort((a, b) => a.createdAt - b.createdAt),
  );

  readonly activePack = computed<Pack>(() => {
    const id = this.settings.activePackId();
    const all = this.state();
    const found = all.find((p) => p.id === id);
    if (found) return found;
    const fallback = all[0];
    if (fallback) {
      // Repair active pointer when the saved one is missing.
      this.settings.setActivePackId(fallback.id);
      return fallback;
    }
    return this.seedDefaultPack();
  });

  readonly activeName = computed(() => this.activePack().name);
  readonly activeDomains = computed(() => this.activePack().domains);
  readonly activeColor = computed(() => this.activePack().color);

  create(draft: PackDraft): Pack {
    const now = Date.now();
    const pack: Pack = {
      id: this.uuid(),
      name: draft.name.trim() || DEFAULT_PACK_NAME,
      version: draft.version.trim(),
      domains: this.normalizeDomains(draft.domains),
      color: isValidPackColor(draft.color) ? draft.color : DEFAULT_PACK_COLOR,
      createdAt: now,
      updatedAt: now,
    };
    const next = [...this.state(), pack];
    this.persist(next);
    this.settings.setActivePackId(pack.id);
    return pack;
  }

  update(id: string, draft: PackDraft): void {
    const next = this.state().map((p) =>
      p.id === id
        ? {
            ...p,
            name: draft.name.trim() || p.name,
            version: draft.version.trim(),
            domains: this.normalizeDomains(draft.domains),
            color: isValidPackColor(draft.color) ? draft.color : p.color,
            updatedAt: Date.now(),
          }
        : p,
    );
    this.persist(next);
  }

  remove(id: string): void {
    const remaining = this.state().filter((p) => p.id !== id);
    if (remaining.length === 0) {
      // Always keep at least one pack so the app has somewhere to go.
      const replacement = this.makeSeedPack();
      this.persist([replacement]);
      this.settings.setActivePackId(replacement.id);
      return;
    }
    this.persist(remaining);
    if (this.settings.activePackId() === id) {
      this.settings.setActivePackId(remaining[0].id);
    }
  }

  setActive(id: string): void {
    if (!this.state().some((p) => p.id === id)) return;
    this.settings.setActivePackId(id);
  }

  getById(id: string): Pack | undefined {
    return this.state().find((p) => p.id === id);
  }

  private normalizeDomains(domains: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const domain of domains) {
      const trimmed = domain.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(trimmed);
      if (result.length >= MAX_PACK_DOMAINS) break;
    }
    return result;
  }

  private bootstrapPacks(): Pack[] {
    const stored = this.storage.getPacks();
    if (stored.length > 0) return stored;
    const seed = this.makeSeedPack();
    this.storage.savePacks([seed]);
    this.settings.setActivePackId(seed.id);
    return [seed];
  }

  private seedDefaultPack(): Pack {
    const seed = this.makeSeedPack();
    this.state.set([seed]);
    this.storage.savePacks([seed]);
    this.settings.setActivePackId(seed.id);
    return seed;
  }

  private makeSeedPack(): Pack {
    const now = Date.now();
    return {
      id: this.uuid(),
      name: DEFAULT_PACK_NAME,
      version: '',
      domains: [],
      color: DEFAULT_PACK_COLOR,
      createdAt: now,
      updatedAt: now,
    };
  }

  private persist(packs: Pack[]): void {
    this.state.set(packs);
    this.storage.savePacks(packs);
  }

  private uuid(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
