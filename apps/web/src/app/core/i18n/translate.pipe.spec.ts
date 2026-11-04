import { TestBed } from '@angular/core/testing';
import { I18nService } from './i18n.service';
import { TranslatePipe } from './translate.pipe';

describe('TranslatePipe', () => {
  let pipe: TranslatePipe;
  let service: I18nService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TranslatePipe, I18nService],
    });
    pipe = TestBed.inject(TranslatePipe);
    service = TestBed.inject(I18nService);
  });

  it('should transform key to translation', () => {
    service.setLocale('ru');
    expect(pipe.transform('dashboard.home')).toBe('Главная');

    service.setLocale('en');
    expect(pipe.transform('dashboard.home')).toBe('Home');
  });

  it('should handle params interpolation', () => {
    service.setLocale('ru');
    expect(pipe.transform('metrics.flowsCount', { count: 5 })).toBe('5 потоков');
  });

  it('should return empty string for empty key', () => {
    expect(pipe.transform('')).toBe('');
  });
});
