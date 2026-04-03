import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/shell/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: 'new-tab',
        loadComponent: () =>
          import('./features/new-tab/new-tab.component').then((m) => m.NewTabComponent),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.component').then((m) => m.SettingsComponent),
      },
      { path: '', pathMatch: 'full', redirectTo: 'new-tab' },
    ],
  },
];
