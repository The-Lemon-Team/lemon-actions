import { Routes } from '@angular/router';
import { AppNavItem, AppShellManifest } from './app-shell.models';

export const FULL_NAV_ITEMS: readonly AppNavItem[] = [
  {
    id: 'projectarium',
    route: '/projectarium',
    label: 'Projectarium',
    icon: 'domain',
    badge: { text: 'Cockpit', variant: 'primary' },
  },
  {
    id: 'actions',
    route: '/actions',
    label: 'Lemon Actions',
    icon: 'style',
  },
  {
    id: 'core',
    route: '/core',
    label: 'Core Console',
    icon: 'hub',
  },
  {
    id: 'seasons',
    route: '/seasons',
    label: 'Seasons Neurons',
    icon: 'bubble_chart',
    badge: { text: 'Live', variant: 'primary' },
  },
  {
    id: 'media',
    route: '/media',
    label: 'Media Neurons',
    icon: 'perm_media',
    badge: { text: 'Admin', variant: 'success' },
  },
  {
    id: 'ai',
    route: '/ai',
    label: 'AI-neurons',
    icon: 'auto_awesome',
    badge: { text: 'Umniy', variant: 'primary' },
  },
];

export const FULL_ROUTES: Routes = [
  {
    path: 'projectarium',
    loadComponent: () =>
      import('../../components/projectarium/projectarium-cockpit.component').then(
        (m) => m.ProjectariumCockpitComponent,
      ),
    title: 'Lemon Projectarium | Stand Cockpit & Port Shield',
  },
  {
    path: 'actions',
    loadComponent: () =>
      import('../../components/lemon-workers/worker-board.component').then(
        (m) => m.WorkerBoardComponent,
      ),
    title: 'Lemon Actions | Worker Cards & Streams',
  },
  {
    path: 'core',
    loadComponent: () =>
      import('../../components/flow-dashboard/flow-dashboard.component').then(
        (m) => m.FlowDashboardComponent,
      ),
    title: 'Flow Combinator Console | Lemon Actions',
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
    path: 'media',
    loadComponent: () =>
      import('../../components/media-neurons/media-admin.component').then(
        (m) => m.MediaAdminComponent,
      ),
    title: 'Media Neurons | Content Moderation Admin',
  },
  {
    path: 'ai',
    loadComponent: () =>
      import('../../components/ai-neurons/ai-neurons.component').then(
        (m) => m.AiNeuronsComponent,
      ),
    title: 'AI-neurons | Umniy Lemon Studio',
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
  shellId: 'full',
  defaultMode: 'core',
  clusterLabel: 'Lemon Shield · Production',
  navItems: FULL_NAV_ITEMS,
  routes: FULL_ROUTES,
};
