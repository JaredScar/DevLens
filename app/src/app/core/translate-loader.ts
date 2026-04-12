/**
 * Inline translate loader factory — bundles translations at compile time.
 *
 * ngx-translate's HTTP loader silently fails when the app runs under Electron's
 * `file://` protocol (HttpClient cannot fetch `file://` URLs).  This factory
 * returns a plain object with a `getTranslation` method so that translations are
 * bundled into the JS bundle and available immediately on first render.
 *
 * A factory function (useFactory) is used instead of a class that extends
 * TranslateLoader to avoid a spurious rxjs TypeScript type-identity conflict
 * caused by the monorepo having two different rxjs installs
 * (app/node_modules and root node_modules).  At runtime both are 7.8.x and
 * fully compatible.
 */
import { of } from 'rxjs';
import en from '../../../public/assets/i18n/en.json';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TRANSLATIONS: Record<string, any> = { en };

/** Factory used with `useFactory` in TranslateModule.forRoot(). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function inlineTranslateLoader(): any {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getTranslation(lang: string): any {
      return of(TRANSLATIONS[lang] ?? TRANSLATIONS['en'] ?? {});
    },
  };
}
