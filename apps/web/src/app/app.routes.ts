import { Routes } from '@angular/router';

export const routes: Routes = [
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
