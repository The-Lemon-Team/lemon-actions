import { TestBed } from '@angular/core/testing';
import { I18nService } from './i18n.service';
import { FlowStatus, FlowType } from '../models/flow.models';

describe('I18nService', () => {
  let service: I18nService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(I18nService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should default to Russian locale or resolve locale correctly', () => {
    expect(['ru', 'en']).toContain(service.currentLocale);
  });

  it('should translate keys correctly in Russian and English', () => {
    service.setLocale('ru');
    expect(service.t('nav.flows')).toBe('Потоки');
    expect(service.t('commandRibbon.title')).toBe('Командная лента · Домены и папки');

    service.setLocale('en');
    expect(service.t('nav.flows')).toBe('Flows');
    expect(service.t('commandRibbon.title')).toBe('Command Ribbon · Domains & Folders');
  });

  it('should interpolate parameters', () => {
    service.setLocale('ru');
    const interpolated = service.t('commandRibbon.subDomainsOf', { name: 'Core' });
    expect(interpolated).toBe('Поддомены Core');

    service.setLocale('en');
    const interpolatedEn = service.t('commandRibbon.subDomainsOf', { name: 'Core' });
    expect(interpolatedEn).toBe('Sub-Domains of Core');
  });

  it('should toggle locale between ru and en', () => {
    service.setLocale('ru');
    service.toggleLocale();
    expect(service.currentLocale).toBe('en');
    service.toggleLocale();
    expect(service.currentLocale).toBe('ru');
  });

  it('should translate standard folder names', () => {
    service.setLocale('ru');
    expect(service.translateFolder('Workspace')).toBe('Рабочее пространство');
    expect(service.translateFolder('Custom Folder')).toBe('Custom Folder');

    service.setLocale('en');
    expect(service.translateFolder('Workspace')).toBe('Workspace');
  });

  it('should translate flow types and statuses', () => {
    service.setLocale('ru');
    expect(service.translateFlowType(FlowType.TIMER)).toBe('Интервальный таймер');
    expect(service.translateFlowStatus(FlowStatus.ACTIVE)).toBe('Активен');
    expect(service.translateFlowStatus(FlowStatus.PAUSED)).toBe('На паузе');
  });
});
