import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CORE_NAV_ITEMS } from '../../core/shell/shell.core.manifest';
import { FULL_NAV_ITEMS } from '../../core/shell/shell.manifest';
import { PROJECTARIUM_NAV_ITEMS } from '../../core/shell/shell.projectarium.manifest';
import { LayoutComponent } from './layout.component';

describe('LayoutComponent', () => {
  it('renders only a single Core Console navigation item when supplied with CORE_NAV_ITEMS', async () => {
    await TestBed.configureTestingModule({
      imports: [LayoutComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(LayoutComponent);
    fixture.componentRef.setInput('appMode', 'core');
    fixture.componentRef.setInput('navItems', CORE_NAV_ITEMS);
    fixture.componentRef.setInput('clusterLabel', 'Core Combinator · LAN');
    fixture.detectChanges();

    const links = fixture.nativeElement.querySelectorAll('nav[aria-label="Apps Navigation"] a');
    expect(links.length).toBe(1);
    expect(links[0].textContent).toContain('Core Console');
    expect(fixture.nativeElement.textContent).toContain('Core Combinator · LAN');
  });

  it('renders all suite navigation items when supplied with FULL_NAV_ITEMS', async () => {
    await TestBed.configureTestingModule({
      imports: [LayoutComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(LayoutComponent);
    fixture.componentRef.setInput('appMode', 'core');
    fixture.componentRef.setInput('navItems', FULL_NAV_ITEMS);
    fixture.detectChanges();

    const links = fixture.nativeElement.querySelectorAll('nav[aria-label="Apps Navigation"] a');
    expect(links.length).toBe(FULL_NAV_ITEMS.length);
  });

  it('renders Projectarium shell navigation items and hides sidebar when hideSidebar is true', async () => {
    await TestBed.configureTestingModule({
      imports: [LayoutComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(LayoutComponent);
    fixture.componentRef.setInput('appMode', 'projectarium');
    fixture.componentRef.setInput('navItems', PROJECTARIUM_NAV_ITEMS);
    fixture.componentRef.setInput('clusterLabel', 'Projectarium · Dev Stand');
    fixture.componentRef.setInput('hideSidebar', true);
    fixture.detectChanges();

    const links = fixture.nativeElement.querySelectorAll('nav[aria-label="Apps Navigation"] a');
    expect(links.length).toBe(PROJECTARIUM_NAV_ITEMS.length);
    expect(links[0].textContent).toContain('Projectarium');
    expect(links[1].textContent).toContain('Seasons Map');
    expect(fixture.nativeElement.textContent).toContain('Projectarium · Dev Stand');
    expect(fixture.nativeElement.querySelector('.xl\\:col-span-3')).toBeNull();
  });
});
