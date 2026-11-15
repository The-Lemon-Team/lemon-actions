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
    id: 'registrar',
    route: '/registrar',
    label: 'Port Shield',
    icon: 'verified_user',
    badge: { text: 'Live', variant: 'success' },
  },
  {
    id: 'home',
    route: '/home',
    label: 'Lemon Home',
    icon: 'home',
  },
  {
    id: 'code',
    route: '/code',
    label: 'Lemon Code',
    icon: 'terminal',
  },
  {
    id: 'core',
    route: '/core',
    label: 'Core Console',
    icon: 'hub',
  },
  {
    id: 'arena',
    route: '/arena',
    label: 'Neuron Arena',
    icon: 'diversity_3',
  },
  {
    id: 'seasons',
    route: '/seasons',
    label: 'Seasons Map',
    icon: 'bubble_chart',
    badge: { text: 'Live', variant: 'primary' },
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
    path: 'registrar',
    loadComponent: () =>
      import('../../components/app-registrar/app-registrar.component').then(
        (m) => m.AppRegistrarComponent,
      ),
    title: 'Lemon Registrar | Live Service Mesh & Port Shield',
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
    path: 'home',
    loadComponent: () =>
      import('../../components/home-tracker/home-tracker.component').then(
        (m) => m.HomeTrackerComponent,
      ),
    title: 'Lemon Home | Lemon Actions',
  },
  {
    path: 'code',
    loadComponent: () =>
      import('../../components/code-lab/code-lab.component').then(
        (m) => m.CodeLabComponent,
      ),
    title: 'Lemon Code Lab | Lemon Actions',
  },
  {
    path: 'arena',
    loadComponent: () =>
      import('../../components/neuron-arena/neuron-arena.component').then(
        (m) => m.NeuronArenaComponent,
      ),
    title: 'Neuron Arena | Lemon Actions',
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
  navItems: FULL_NAV_ITEMS,
  routes: FULL_ROUTES,
};
