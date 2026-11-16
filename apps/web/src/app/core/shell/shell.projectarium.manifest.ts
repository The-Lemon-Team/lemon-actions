import { Routes } from '@angular/router';
import { AppNavItem, AppShellManifest } from './app-shell.models';

/**
 * Single-application App Shell manifest for the standalone Lemon Projectarium Dev Stand.
 * Compiled via Angular fileReplacements when using the `projectarium-dev` configuration.
 */
export const PROJECTARIUM_NAV_ITEMS: readonly AppNavItem[] = [
  {
    id: 'projectarium',
    route: '/projectarium',
    label: 'Projectarium',
    icon: 'domain',
    badge: { text: 'Dev Stand', variant: 'success' },
  },
  {
    id: 'seasons',
    route: '/seasons',
    label: 'Seasons Neurons',
    icon: 'bubble_chart',
    badge: { text: 'Bubbles', variant: 'primary' },
  },
];

export const PROJECTARIUM_ROUTES: Routes = [
  {
    path: 'projectarium',
    loadComponent: () =>
      import('../../components/projectarium/projectarium-cockpit.component').then(
        (m) => m.ProjectariumCockpitComponent,
      ),
    title: 'Lemon Projectarium | Dev Stand',
  },
  {
    path: 'seasons',
    loadComponent: () =>
      import('../../components/seasons-bubbles/seasons-explorer.component').then(
        (m) => m.SeasonsExplorerComponent,
      ),
    title: 'Lemon Seasons | Streams & Feeds Bubbles',
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'projectarium',
  },
  {
    path: '**',
    redirectTo: 'projectarium',
  },
];

export const APP_SHELL_MANIFEST_DATA: AppShellManifest = {
  shellId: 'projectarium',
  defaultMode: 'projectarium',
  appTitle: 'Lemon Projectarium',
  appIcon: 'domain',
  clusterLabel: 'Projectarium · Dev Stand',
  hideSidebar: true,
  navItems: PROJECTARIUM_NAV_ITEMS,
  routes: PROJECTARIUM_ROUTES,
};
