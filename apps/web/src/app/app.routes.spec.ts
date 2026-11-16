import { routes } from './app.routes';

describe('App Routes', () => {
  it('should define high-level routes for core, projectarium, actions, seasons, and media', () => {
    const paths = routes.map((r) => r.path);
    expect(paths).toContain('core');
    expect(paths).toContain('projectarium');
    expect(paths).toContain('actions');
    expect(paths).toContain('seasons');
    expect(paths).toContain('media');
    expect(paths).toContain('ai');
  });

  it('should redirect root path to core', () => {
    const rootRoute = routes.find((r) => r.path === '');
    expect(rootRoute).toBeDefined();
    expect(rootRoute?.redirectTo).toBe('core');
    expect(rootRoute?.pathMatch).toBe('full');
  });

  it('should redirect wildcard path to core', () => {
    const wildcardRoute = routes.find((r) => r.path === '**');
    expect(wildcardRoute).toBeDefined();
    expect(wildcardRoute?.redirectTo).toBe('core');
  });

  it('should lazily resolve components for all main routes', async () => {
    const coreRoute = routes.find((r) => r.path === 'core');
    const projectariumRoute = routes.find((r) => r.path === 'projectarium');
    const actionsRoute = routes.find((r) => r.path === 'actions');
    const seasonsRoute = routes.find((r) => r.path === 'seasons');
    const mediaRoute = routes.find((r) => r.path === 'media');
    const aiRoute = routes.find((r) => r.path === 'ai');

    expect(coreRoute?.loadComponent).toBeDefined();
    expect(projectariumRoute?.loadComponent).toBeDefined();
    expect(actionsRoute?.loadComponent).toBeDefined();
    expect(seasonsRoute?.loadComponent).toBeDefined();
    expect(mediaRoute?.loadComponent).toBeDefined();
    expect(aiRoute?.loadComponent).toBeDefined();

    const coreComponent = await (coreRoute!.loadComponent as () => Promise<unknown>)();
    const projectariumComponent = await (projectariumRoute!.loadComponent as () => Promise<unknown>)();
    const actionsComponent = await (actionsRoute!.loadComponent as () => Promise<unknown>)();
    const seasonsComponent = await (seasonsRoute!.loadComponent as () => Promise<unknown>)();
    const mediaComponent = await (mediaRoute!.loadComponent as () => Promise<unknown>)();
    const aiComponent = await (aiRoute!.loadComponent as () => Promise<unknown>)();

    expect(coreComponent).toBeTruthy();
    expect(projectariumComponent).toBeTruthy();
    expect(actionsComponent).toBeTruthy();
    expect(seasonsComponent).toBeTruthy();
    expect(mediaComponent).toBeTruthy();
    expect(aiComponent).toBeTruthy();
  });
});
