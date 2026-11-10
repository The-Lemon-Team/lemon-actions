import { routes } from './app.routes';

describe('App Routes', () => {
  it('should define high-level routes for core, home, code, and arena', () => {
    const paths = routes.map((r) => r.path);
    expect(paths).toContain('core');
    expect(paths).toContain('home');
    expect(paths).toContain('code');
    expect(paths).toContain('arena');
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
    const homeRoute = routes.find((r) => r.path === 'home');
    const codeRoute = routes.find((r) => r.path === 'code');
    const arenaRoute = routes.find((r) => r.path === 'arena');

    expect(coreRoute?.loadComponent).toBeDefined();
    expect(homeRoute?.loadComponent).toBeDefined();
    expect(codeRoute?.loadComponent).toBeDefined();
    expect(arenaRoute?.loadComponent).toBeDefined();

    const coreComponent = await (coreRoute!.loadComponent as () => Promise<unknown>)();
    const homeComponent = await (homeRoute!.loadComponent as () => Promise<unknown>)();
    const codeComponent = await (codeRoute!.loadComponent as () => Promise<unknown>)();
    const arenaComponent = await (arenaRoute!.loadComponent as () => Promise<unknown>)();

    expect(coreComponent).toBeTruthy();
    expect(homeComponent).toBeTruthy();
    expect(codeComponent).toBeTruthy();
    expect(arenaComponent).toBeTruthy();
  });
});
