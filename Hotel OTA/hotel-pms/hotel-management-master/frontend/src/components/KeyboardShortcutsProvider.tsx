import { ReactNode } from 'react';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

/**
 * KeyboardShortcutsProvider Component
 *
 * Wrapper component that enables keyboard shortcuts for multi-property navigation.
 * Must be used inside PropertyProvider.
 *
 * @example
 * ```tsx
 * <PropertyProvider>
 *   <KeyboardShortcutsProvider>
 *     <App />
 *   </KeyboardShortcutsProvider>
 * </PropertyProvider>
 * ```
 */
export function KeyboardShortcutsProvider({ children }: { children: ReactNode }) {
  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  // Just render children, hook handles the shortcuts
  return <>{children}</>;
}

export default KeyboardShortcutsProvider;
