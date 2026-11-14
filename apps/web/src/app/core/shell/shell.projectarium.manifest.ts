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
  clusterLabel: 'Projectarium · Dev Stand',
  hideSidebar: true,
  navItems: PROJECTARIUM_NAV_ITEMS,
  routes: PROJECTARIUM_ROUTES,
};
