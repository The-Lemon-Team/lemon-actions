import { Routes } from '@angular/router';
import { AppNavItem, AppShellManifest } from './app-shell.models';

/**
 * Single-application App Shell manifest for Lemon-Projectarium production deployment.
 * Compiled via Angular fileReplacements when using the `projectarium-production` configuration.
 */
export const PROJECTARIUM_PROD_NAV_ITEMS: readonly AppNavItem[] = [
  {
    id: 'projectarium',
    route: '/projectarium',
    label: 'Projectarium',
    icon: 'domain',
    badge: { text: 'Live', variant: 'success' },
  },
];

export const PROJECTARIUM_PROD_ROUTES: Routes = [
  {
    path: 'projectarium',
    loadComponent: () =>
      import('../../components/projectarium/projectarium-cockpit.component').then(
        (m) => m.ProjectariumCockpitComponent,
      ),
    title: 'Lemon Projectarium | Stand Cockpit & Port Shield',
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
  clusterLabel: 'Projectarium · Production',
  hideSidebar: true,
  navItems: PROJECTARIUM_PROD_NAV_ITEMS,
  routes: PROJECTARIUM_PROD_ROUTES,
};
