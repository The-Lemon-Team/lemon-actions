export type OpenMode = 'webview' | 'browser';

export type HealthStatus = 'unknown' | 'checking' | 'online' | 'offline';

export interface StackApp {
  id: string;
  name: string;
  shortName: string;
  url: string;
  icon: string;
  color: string;
  openMode: OpenMode;
  pinned: boolean;
  description?: string;
}

export interface DockConfig {
  alwaysOnTop: boolean;
  apps: StackApp[];
}
