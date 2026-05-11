import { BaseAgent } from '../core/BaseAgent.js';
import { join } from 'path';

/**
 * FrontendQualityAgent - Analyzes React frontend for quality, accessibility, and UX issues.
 *
 * PMs care about: Does the UI work for all users? Is it accessible? Does it handle errors gracefully?
 * Is performance acceptable? Will it work on mobile?
 */
export class FrontendQualityAgent extends BaseAgent {
  constructor() {
    super('FrontendQualityAgent', 'Analyzes React frontend for accessibility, error handling, performance, type safety, and UX patterns');
  }

  async analyze(state, config) {
    const { scanner, projectRoot } = config;
    const frontendDir = join(projectRoot, 'frontend', 'src');

    let allFiles;
    try {
      allFiles = await scanner.scanDirectory(frontendDir, {
        extensions: ['.tsx', '.ts', '.jsx', '.js'],
      });
    } catch {
      console.log('[FrontendQualityAgent] Frontend directory not accessible');
      return { summary: 'Frontend not accessible' };
    }

    const pages = allFiles.filter((f) => f.relativePath.replace(/\\/g, '/').includes('/pages/'));
    const components = allFiles.filter((f) => f.relativePath.replace(/\\/g, '/').includes('/components/'));

    for (const file of allFiles) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      this._checkErrorBoundaries(state, content, file);
      this._checkLoadingStates(state, content, file);
      this._checkAccessibility(state, content, file);
      this._checkTypeScript(state, content, file);
      this._checkMemoryLeaks(state, content, file);
      this._checkFormHandling(state, content, file);
      this._checkAPIErrorHandling(state, content, file);
      this._checkResponsiveness(state, content, file);
      this._checkHardcodedStrings(state, content, file);
      this._checkConsoleStatements(state, content, file);
    }

    await this._checkRouteProtection(state, allFiles, scanner);
    await this._checkBundleSize(state, config);
    await this._checkI18nCoverage(state, pages, scanner);

    return {
      summary: `Frontend quality analysis complete. ${pages.length} pages, ${components.length} components analyzed.`,
      pages: pages.length,
      components: components.length,
    };
  }

  _checkErrorBoundaries(state, content, file) {
    if (!file.relativePath.includes('pages')) return;

    // Pages should be wrapped in error boundaries
    const usesErrorBoundary = /ErrorBoundary|error.?boundary|componentDidCatch|onError/i.test(content);
    const hasTryCatch = /try\s*\{|\.catch\s*\(|onError/i.test(content);

    if (!usesErrorBoundary && !hasTryCatch) {
      // Check if it's a substantial page (not a simple redirect)
      const isSubstantial = content.length > 500;
      if (isSubstantial) {
        this.addFinding(state, {
          severity: 'medium',
          category: 'frontend',
          title: `Page without error boundary: ${file.name}`,
          description: `${file.relativePath} has no error boundary. If any child component throws, the ENTIRE page crashes with a white screen. Users see nothing — no error message, no way to recover.`,
          file: file.relativePath,
          suggestion: 'Wrap page content in <ErrorBoundary fallback={<ErrorPage />}>. Import from your ErrorBoundary component.',
          fixable: true,
        });
      }
    }
  }

  _checkLoadingStates(state, content, file) {
    // Components that fetch data should have loading states
    const fetchesData = /useQuery|useFetch|useEffect.*fetch|axios\.|api\./i.test(content);
    const hasLoadingState = /isLoading|loading|Loading|Spinner|skeleton|Skeleton|pending/i.test(content);

    if (fetchesData && !hasLoadingState) {
      this.addFinding(state, {
        severity: 'low',
        category: 'frontend',
        title: `Missing loading state: ${file.name}`,
        description: `${file.relativePath} fetches data but doesn't show a loading indicator. Users see a blank screen or stale data while the API call is in progress, making the app feel broken.`,
        file: file.relativePath,
        suggestion: 'Add loading state: if (isLoading) return <LoadingSpinner />. Use skeleton screens for better UX.',
        fixable: true,
      });
    }
  }

  _checkAccessibility(state, content, file) {
    // Forms without labels
    if (/<input|<textarea|<select/i.test(content)) {
      const inputs = (content.match(/<(?:input|textarea|select)/gi) || []).length;
      const labels = (content.match(/<label|aria-label|aria-labelledby|htmlFor/gi) || []).length;

      if (inputs > 0 && labels < inputs / 2) {
        this.addFinding(state, {
          severity: 'medium',
          category: 'frontend',
          title: `Accessibility: ${inputs - labels} form inputs without labels in ${file.name}`,
          description: `${file.relativePath} has form inputs without associated labels. Screen readers cannot identify these inputs, making the form unusable for visually impaired users. This also violates WCAG 2.1 Success Criterion 1.3.1.`,
          file: file.relativePath,
          suggestion: 'Add <label htmlFor="inputId"> or aria-label attribute to every form input.',
          fixable: true,
        });
      }
    }

    // Clickable elements without keyboard access
    const clickableDiv = /<div[^>]*onClick/gi;
    if (clickableDiv.test(content)) {
      const hasKeyboard = /onKeyDown|onKeyPress|onKeyUp|role=.button|tabIndex/i.test(content);
      if (!hasKeyboard) {
        this.addFinding(state, {
          severity: 'medium',
          category: 'frontend',
          title: `Accessibility: Clickable div without keyboard support in ${file.name}`,
          description: `${file.relativePath} has clickable <div> elements without keyboard event handlers. Keyboard-only users cannot interact with these elements. Use <button> instead, or add role="button", tabIndex, and onKeyDown.`,
          file: file.relativePath,
          suggestion: 'Replace <div onClick> with <button onClick>. If div is required, add: role="button" tabIndex={0} onKeyDown={handleKeyDown}.',
          fixable: true,
        });
      }
    }

    // Images without alt text
    const imgWithoutAlt = /<img(?![^>]*alt\s*=)/gi;
    if (imgWithoutAlt.test(content)) {
      this.addFinding(state, {
        severity: 'medium',
        category: 'frontend',
        title: `Accessibility: Images without alt text in ${file.name}`,
        description: `${file.relativePath} has <img> tags without alt attributes. Screen readers announce these as "image" with no context. WCAG 2.1 Success Criterion 1.1.1 requires text alternatives.`,
        file: file.relativePath,
        suggestion: 'Add meaningful alt text. For decorative images, use alt="" (empty string).',
        fixable: true,
      });
    }
  }

  _checkTypeScript(state, content, file) {
    if (!file.ext.includes('ts')) return;

    // Excessive 'any' usage
    const anyCount = (content.match(/:\s*any\b/g) || []).length;
    if (anyCount > 5) {
      this.addFinding(state, {
        severity: 'low',
        category: 'frontend',
        title: `Excessive TypeScript 'any' usage: ${anyCount} in ${file.name}`,
        description: `${file.relativePath} uses 'any' type ${anyCount} times. Each 'any' disables type checking, defeating TypeScript's purpose. Type errors that TypeScript would catch become runtime bugs.`,
        file: file.relativePath,
        suggestion: 'Replace any with proper types. Use unknown for truly unknown types, then narrow with type guards.',
        fixable: true,
      });
    }

    // @ts-ignore comments
    const tsIgnore = (content.match(/@ts-ignore|@ts-nocheck/g) || []).length;
    if (tsIgnore > 2) {
      this.addFinding(state, {
        severity: 'low',
        category: 'frontend',
        title: `${tsIgnore} @ts-ignore directives in ${file.name}`,
        description: `${file.relativePath} suppresses ${tsIgnore} TypeScript errors. These hide real type mismatches that will fail at runtime.`,
        file: file.relativePath,
        suggestion: 'Fix the underlying type errors instead of suppressing them. If truly needed, use @ts-expect-error with a comment explaining why.',
        fixable: true,
      });
    }
  }

  _checkMemoryLeaks(state, content, file) {
    // useEffect without cleanup for subscriptions/timers
    const effectWithSubscription = /useEffect\s*\(\s*\(\)\s*=>\s*\{[\s\S]*?(?:setInterval|setTimeout|addEventListener|subscribe|on\s*\()/g;
    let match;
    while ((match = effectWithSubscription.exec(content))) {
      const effectBody = content.substring(match.index, match.index + 500);
      const hasCleanup = /return\s*\(\s*\)\s*=>\s*\{|clearInterval|clearTimeout|removeEventListener|unsubscribe|off\s*\(/i.test(effectBody);

      if (!hasCleanup) {
        const lineNum = content.substring(0, match.index).split('\n').length;
        this.addFinding(state, {
          severity: 'medium',
          category: 'frontend',
          title: `Memory leak: useEffect without cleanup in ${file.name}`,
          description: `At line ${lineNum}: useEffect subscribes to events/timers but has no cleanup function. On component unmount, the subscription stays active, causing memory leaks and "setState on unmounted component" warnings.`,
          file: file.relativePath,
          line: lineNum,
          suggestion: 'Return a cleanup function from useEffect: return () => { clearInterval(timer); unsubscribe(); }.',
          fixable: true,
        });
        break;
      }
    }
  }

  _checkFormHandling(state, content, file) {
    // Forms without validation
    if (/<form|onSubmit|handleSubmit/i.test(content)) {
      const hasValidation = /useForm|validate|validation|required|pattern|zod|yup|joi/i.test(content);
      if (!hasValidation) {
        this.addFinding(state, {
          severity: 'medium',
          category: 'frontend',
          title: `Form without client-side validation in ${file.name}`,
          description: `${file.relativePath} has a form without apparent validation. Users can submit invalid data, causing backend errors with poor error messages. Client-side validation provides instant feedback.`,
          file: file.relativePath,
          suggestion: 'Use react-hook-form with Zod schema validation. Validate on blur for individual fields, on submit for the full form.',
          fixable: true,
        });
      }
    }
  }

  _checkAPIErrorHandling(state, content, file) {
    // API calls without error handling
    const apiCalls = /axios\.\w+\s*\(|api\.\w+\s*\(|fetch\s*\(/g;
    let match;
    let unhandled = 0;
    while ((match = apiCalls.exec(content))) {
      const surrounding = content.substring(match.index - 200, match.index + 500);
      if (!surrounding.includes('.catch(') && !surrounding.includes('try') && !surrounding.includes('onError')) {
        unhandled++;
      }
    }

    if (unhandled > 2) {
      this.addFinding(state, {
        severity: 'medium',
        category: 'frontend',
        title: `${unhandled} API calls without error handling in ${file.name}`,
        description: `${file.relativePath} makes ${unhandled} API calls without error handling. Network failures, 500 errors, or auth expiry cause uncaught promise rejections. Users see nothing — the action silently fails.`,
        file: file.relativePath,
        suggestion: 'Handle API errors: show toast notification, display inline error message, or redirect to error page. Use React Query\'s onError callback.',
        fixable: true,
      });
    }
  }

  _checkResponsiveness(state, content, file) {
    // Check for fixed pixel widths that break mobile
    const fixedWidths = content.match(/width:\s*(?:['"]?\d{4,}px|['"]?\d+px(?!.*max))/g);
    if (fixedWidths && fixedWidths.length > 3) {
      this.addFinding(state, {
        severity: 'low',
        category: 'frontend',
        title: `Fixed pixel widths may break mobile: ${file.name}`,
        description: `${file.relativePath} uses ${fixedWidths.length} fixed pixel widths. These don't adapt to different screen sizes, breaking the layout on mobile devices and tablets.`,
        file: file.relativePath,
        suggestion: 'Use responsive units: %, vw, rem. Use Tailwind responsive prefixes: sm:, md:, lg:. Set max-width instead of width.',
        fixable: true,
      });
    }
  }

  _checkHardcodedStrings(state, content, file) {
    if (!file.relativePath.includes('pages')) return;

    // Check for hardcoded UI strings (i18n gap)
    const hasTranslation = /useTranslation|t\s*\(|i18n|intl|formatMessage|LocalizedText/i.test(content);
    const hasStringLiterals = content.match(/>[\s]*[A-Z][a-z]+ [a-z]+[\s]*</g); // JSX text content

    if (!hasTranslation && hasStringLiterals && hasStringLiterals.length > 5) {
      this.addFinding(state, {
        severity: 'low',
        category: 'frontend',
        title: `Hardcoded UI strings (no i18n): ${file.name}`,
        description: `${file.relativePath} has ${hasStringLiterals.length}+ hardcoded text strings without i18n translation. Multi-language support requires all UI strings to go through a translation layer.`,
        file: file.relativePath,
        suggestion: 'Use translation hook: const { t } = useTranslation(). Replace "Check In" with {t("booking.checkIn")}.',
        fixable: true,
      });
    }
  }

  _checkConsoleStatements(state, content, file) {
    const consoleLogs = (content.match(/console\.(log|warn|error|debug|info)\s*\(/g) || []).length;
    if (consoleLogs > 5) {
      this.addFinding(state, {
        severity: 'low',
        category: 'frontend',
        title: `${consoleLogs} console statements in ${file.name}`,
        description: `${file.relativePath} has ${consoleLogs} console statements. These pollute the browser console in production, can leak sensitive data, and slow down rendering.`,
        file: file.relativePath,
        suggestion: 'Remove console.log statements or use a logger that disables in production. Keep console.error for genuine error reporting.',
        fixable: true,
      });
    }
  }

  async _checkRouteProtection(state, allFiles, scanner) {
    // Check if authenticated routes are protected in the router
    const routerFiles = allFiles.filter((f) => /router|routes|App/i.test(f.name));
    for (const file of routerFiles.slice(0, 5)) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      if (content.includes('Route') || content.includes('route')) {
        const hasProtectedRoute = /ProtectedRoute|PrivateRoute|RequireAuth|AuthGuard|isAuthenticated/.test(content);
        const hasAdminRoute = /admin|Admin/.test(content);

        if (hasAdminRoute && !hasProtectedRoute) {
          this.addFinding(state, {
            severity: 'high',
            category: 'frontend',
            title: 'Admin routes may not be protected on the frontend',
            description: `${file.relativePath} defines admin routes without a route guard component. While backend auth prevents data access, unprotected frontend routes expose admin UI to unauthenticated users.`,
            file: file.relativePath,
            suggestion: 'Wrap admin routes: <ProtectedRoute roles={["admin"]}><AdminDashboard /></ProtectedRoute>.',
            fixable: true,
          });
        }
      }
    }
  }

  async _checkBundleSize(state, config) {
    const { scanner, projectRoot } = config;
    const packageJson = await scanner.readFileContent(join(projectRoot, 'frontend', 'package.json'));
    if (!packageJson) return;

    try {
      const pkg = JSON.parse(packageJson);
      const deps = Object.keys(pkg.dependencies || {});

      // Check for heavy dependencies
      const heavyDeps = [
        { name: 'moment', size: '280kb', alt: 'date-fns or dayjs (2-7kb)' },
        { name: 'lodash', size: '72kb', alt: 'lodash-es with tree-shaking or native methods' },
        { name: 'jquery', size: '87kb', alt: 'native DOM APIs' },
      ];

      for (const { name, size, alt } of heavyDeps) {
        if (deps.includes(name)) {
          this.addFinding(state, {
            severity: 'low',
            category: 'frontend',
            title: `Heavy dependency: ${name} (~${size} gzipped)`,
            description: `Frontend includes ${name} which adds ~${size} to the bundle. This increases load time, especially on mobile networks.`,
            suggestion: `Replace with ${alt}.`,
            fixable: true,
          });
        }
      }
    } catch {
      // Invalid package.json
    }
  }

  async _checkI18nCoverage(state, pages, scanner) {
    let pagesWithI18n = 0;
    let pagesWithout = 0;

    for (const page of pages.slice(0, 40)) {
      const content = await scanner.readFileContent(page.path);
      if (!content) continue;

      if (/useTranslation|t\s*\(|i18n|LocalizedText/i.test(content)) {
        pagesWithI18n++;
      } else {
        pagesWithout++;
      }
    }

    const total = pagesWithI18n + pagesWithout;
    if (total > 0 && pagesWithout > pagesWithI18n) {
      this.addFinding(state, {
        severity: 'medium',
        category: 'frontend',
        title: `i18n coverage gap: ${pagesWithout}/${total} sampled pages lack translations`,
        description: `${pagesWithout} out of ${total} sampled pages don't use the translation system. For international hotels, this means large parts of the UI are English-only, excluding non-English speaking staff and guests.`,
        suggestion: 'Integrate i18n into all pages using useTranslation hook. Extract all hardcoded strings to locale files.',
        fixable: true,
      });
    }
  }
}
