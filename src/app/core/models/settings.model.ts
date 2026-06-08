export type ThemeMode = 'light' | 'dark';

export interface AppSettings {
  certificationName: string;
  domains: string[];
  theme: ThemeMode;
  awsWorkspaceId: string;
  awsRegion: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  certificationName: '',
  domains: [],
  theme: 'light',
  awsWorkspaceId: '',
  awsRegion: 'us-east-1',
};

export const DEFAULT_DOMAIN = 'General';

export const MAX_DOMAINS = 20;

export const AWS_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-2',
  'eu-west-1',
  'eu-central-1',
  'ap-northeast-1',
  'ap-southeast-1',
  'ap-southeast-2',
] as const;

export function isAwsApiKey(apiKey: string): boolean {
  return apiKey.startsWith('AEA');
}
