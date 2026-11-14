import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { APP_SHELL_MANIFEST } from './core/shell/app-shell.models';
import { APP_SHELL_MANIFEST_DATA } from './core/shell/shell.manifest';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(),
    provideRouter(routes, withComponentInputBinding()),
    { provide: APP_SHELL_MANIFEST, useValue: APP_SHELL_MANIFEST_DATA },
  ],
};
