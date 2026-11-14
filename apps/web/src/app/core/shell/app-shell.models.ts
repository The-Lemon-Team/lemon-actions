import { InjectionToken } from '@angular/core';
import { Routes } from '@angular/router';
import { AppMode } from '../models/flow.models';

export type AppNavBadgeVariant = 'primary' | 'success';

export interface AppNavItemBadge {
  readonly text: string;
  readonly variant: AppNavBadgeVariant;
}

/** Focused navigation item contract for the App Shell header (ISP). */
export interface AppNavItem {
  readonly id: AppMode;
  readonly route: string;
  readonly label: string;
  readonly icon: string;
  readonly badge?: AppNavItemBadge;
}

/** Pluggable App Shell & Header manifest contract (OCP / DIP). */
export interface AppShellManifest {
  readonly shellId: 'full' | 'core' | 'projectarium';
  readonly defaultMode: AppMode;
  readonly clusterLabel?: string;
  readonly hideSidebar?: boolean;
  readonly navItems: readonly AppNavItem[];
  readonly routes: Routes;
}

export const APP_SHELL_MANIFEST = new InjectionToken<AppShellManifest>('APP_SHELL_MANIFEST');
