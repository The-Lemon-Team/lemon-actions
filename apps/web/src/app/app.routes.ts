import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'projectarium',
    loadComponent: () =>
      import('./components/projectarium/projectarium-cockpit.component').then(
        (m) => m.ProjectariumCockpitComponent,
      ),
    title: 'Lemon Projectarium | Stand Cockpit & Port Shield',
  },
  {
    path: 'actions',
    loadComponent: () =>
      import('./components/lemon-workers/worker-board.component').then(
        (m) => m.WorkerBoardComponent,
      ),
    title: 'Lemon Actions | Worker Cards & Streams',
  },
  {
    path: 'registrar',
    loadComponent: () =>
      import('./components/app-registrar/app-registrar.component').then(
        (m) => m.AppRegistrarComponent,
      ),
    title: 'Lemon Registrar | Live Service Mesh & Port Shield',
  },
  {
    path: 'core',
    loadComponent: () =>
      import('./components/flow-dashboard/flow-dashboard.component').then(
        (m) => m.FlowDashboardComponent,
      ),
    title: 'Flow Combinator Console | Lemon Actions',
  },
  {
    path: 'home',
    loadComponent: () =>
      import('./components/home-tracker/home-tracker.component').then(
        (m) => m.HomeTrackerComponent,
      ),
    title: 'Lemon Home | Lemon Actions',
  },
  {
    path: 'code',
    loadComponent: () =>
      import('./components/code-lab/code-lab.component').then(
        (m) => m.CodeLabComponent,
      ),
    title: 'Lemon Code Lab | Lemon Actions',
  },
  {
    path: 'arena',
    loadComponent: () =>
      import('./components/neuron-arena/neuron-arena.component').then(
        (m) => m.NeuronArenaComponent,
      ),
    title: 'Neuron Arena | Lemon Actions',
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
