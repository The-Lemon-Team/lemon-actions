import { Routes } from '@angular/router';
import { AppNavItem, AppShellManifest } from './app-shell.models';

/**
 * Single-application App Shell manifest for Core Combinator production deployment.
 * Replaced at build time via Angular `fileReplacements` (`core-production` configuration),
 * ensuring unused feature apps are completely tree-shaken from the production bundle.
 */
export const CORE_NAV_ITEMS: readonly AppNavItem[] = [
  {
    id: 'core',
    route: '/core',
    label: 'Core Console',
    icon: 'hub',
  },
];

export const CORE_ROUTES: Routes = [
  {
    path: 'core',
    loadComponent: () =>
      import('../../components/flow-dashboard/flow-dashboard.component').then(
        (m) => m.FlowDashboardComponent,
      ),
    title: 'Core Console | Core Combinator',
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'core',
  },
  {
    path: '**',
    redirectTo: 'core',
  },
];

export const APP_SHELL_MANIFEST_DATA: AppShellManifest = {
  shellId: 'core',
  defaultMode: 'core',
  clusterLabel: 'Core Combinator · LAN',
  navItems: CORE_NAV_ITEMS,
  routes: CORE_ROUTES,
};
