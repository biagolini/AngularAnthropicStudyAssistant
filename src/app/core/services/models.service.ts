import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { isAwsApiKey } from '../models/settings.model';
import { SettingsService } from './settings.service';
import { StorageService } from './storage.service';

export type ModelTier = 'fast' | 'balanced' | 'deep' | 'other';

export interface ModelOption {
  id: string;
  displayName: string;
  tier: ModelTier;
}

export const DEFAULT_MODEL_ID = 'claude-sonnet-4-5-20250929';

const FALLBACK_MODELS: ModelOption[] = [
  { id: 'claude-haiku-4-5-20251001', displayName: 'Claude Haiku 4.5', tier: 'fast' },
  { id: 'claude-sonnet-4-5-20250929', displayName: 'Claude Sonnet 4.5', tier: 'balanced' },
  { id: 'claude-opus-4-5-20251101', displayName: 'Claude Opus 4.5', tier: 'deep' },
];

const ANTHROPIC_VERSION = '2023-06-01';

interface ApiModel {
  id: string;
  display_name?: string;
}

interface ApiModelsResponse {
  data?: ApiModel[];
  error?: { message?: string };
}

@Injectable({ providedIn: 'root' })
export class ModelsService {
  private readonly storage = inject(StorageService);
  private readonly settings = inject(SettingsService);

  private readonly state = signal<ModelOption[]>(FALLBACK_MODELS);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private lastFetchKey = '';

  readonly models = this.state.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly tierLabel: Record<ModelTier, string> = {
    fast: 'fast',
    balanced: 'balanced',
    deep: 'deep',
    other: 'other',
  };

  readonly availableIds = computed(() => this.state().map((m) => m.id));

  constructor() {
    effect(() => {
      const key = this.storage.apiKey() ?? '';
      const workspace = this.settings.awsWorkspaceId();
      const region = this.settings.awsRegion();
      if (!key) {
        this.lastFetchKey = '';
        this.state.set(FALLBACK_MODELS);
        return;
      }
      const fingerprint = isAwsApiKey(key)
        ? `aws|${region}|${workspace}|${key.slice(0, 12)}`
        : `console|${key.slice(0, 12)}`;
      if (fingerprint === this.lastFetchKey) return;
      this.lastFetchKey = fingerprint;
      void this.refresh();
    });
  }

  async refresh(): Promise<void> {
    const key = this.storage.apiKey();
    if (!key) return;
    const useAws = isAwsApiKey(key);
    const region = this.settings.awsRegion();
    const workspaceId = this.settings.awsWorkspaceId();
    if (useAws && (!workspaceId || !region)) return;

    this.loadingState.set(true);
    this.errorState.set(null);
    try {
      const base = useAws
        ? `https://aws-external-anthropic.${region}.api.aws`
        : 'https://api.anthropic.com';
      const headers: Record<string, string> = {
        'x-api-key': key,
        'anthropic-version': ANTHROPIC_VERSION,
      };
      if (useAws) headers['anthropic-workspace-id'] = workspaceId;
      else headers['anthropic-dangerous-direct-browser-access'] = 'true';

      const response = await fetch(`${base}/v1/models?limit=100`, { method: 'GET', headers });
      const data = (await response.json().catch(() => null)) as ApiModelsResponse | null;
      if (!response.ok) {
        throw new Error(data?.error?.message ?? `Request failed with status ${response.status}.`);
      }
      const items = data?.data ?? [];
      const mapped = items
        .filter((m) => /claude-(opus|sonnet|haiku)/i.test(m.id))
        .map((m) => toModelOption(m));
      this.state.set(mapped.length > 0 ? mapped : FALLBACK_MODELS);
    } catch (err) {
      this.errorState.set(err instanceof Error ? err.message : 'Failed to load models.');
      this.state.set(FALLBACK_MODELS);
    } finally {
      this.loadingState.set(false);
    }
  }

  resolveModel(preferred: string): string {
    const available = this.availableIds();
    if (preferred && available.includes(preferred)) return preferred;
    const settingsDefault = this.settings.defaultModel();
    if (settingsDefault && available.includes(settingsDefault)) return settingsDefault;
    return available.includes(DEFAULT_MODEL_ID) ? DEFAULT_MODEL_ID : available[0] ?? DEFAULT_MODEL_ID;
  }
}

function toModelOption(model: ApiModel): ModelOption {
  const id = model.id;
  const displayName = model.display_name || prettifyId(id);
  return { id, displayName, tier: tierFor(id) };
}

function tierFor(id: string): ModelTier {
  const lower = id.toLowerCase();
  if (lower.includes('haiku')) return 'fast';
  if (lower.includes('sonnet')) return 'balanced';
  if (lower.includes('opus')) return 'deep';
  return 'other';
}

function prettifyId(id: string): string {
  return id
    .replace(/^claude-/, 'Claude ')
    .replace(/-(\d+)-(\d+)/, ' $1.$2')
    .replace(/-/g, ' ');
}
