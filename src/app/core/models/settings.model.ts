export type ThemeMode = 'light' | 'dark';

export interface AppSettings {
  certificationName: string;
  domains: string[];
  theme: ThemeMode;
}

export const DEFAULT_SETTINGS: AppSettings = {
  certificationName: '',
  domains: [],
  theme: 'light',
};

export const DEFAULT_DOMAIN = 'General';

export const MAX_DOMAINS = 20;
