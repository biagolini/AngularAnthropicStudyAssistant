export type ThemeMode = 'light' | 'dark';

export interface AppSettings {
  theme: ThemeMode;
  awsWorkspaceId: string;
  awsRegion: string;
  defaultModel: string;
  activePackId: string;
}

export const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  awsWorkspaceId: '',
  awsRegion: 'us-east-1',
  defaultModel: DEFAULT_MODEL,
  activePackId: '',
};

export const DEFAULT_DOMAIN = 'General';

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
