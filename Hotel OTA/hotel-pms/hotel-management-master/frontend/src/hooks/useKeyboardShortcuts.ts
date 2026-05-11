import { useEffect } from 'react';
import { useProperty } from '../context/PropertyContext';
import { useNavigate } from 'react-router-dom';

/**
 * useKeyboardShortcuts Hook
 *
 * Implements global keyboard shortcuts for multi-property navigation.
 *
 * Shortcuts:
 * - Cmd/Ctrl + K: Open property switcher (triggers click on property selector)
 * - Cmd/Ctrl + 0: Switch to portfolio view (all properties)
 * - Cmd/Ctrl + 1-9: Quick switch to property by index (1st, 2nd, ..., 9th property)
 *
 * @example
 * ```tsx
 * function App() {
 *   useKeyboardShortcuts();
 *   return <YourApp />;
 * }
 * ```
 */
export function useKeyboardShortcuts() {
  const { properties, setSelectedPropertyId, setViewMode, viewMode } = useProperty();
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Cmd (Mac) or Ctrl (Windows/Linux)
      const isCmdOrCtrl = event.metaKey || event.ctrlKey;

      if (!isCmdOrCtrl) return;

      // Cmd/Ctrl + K: Open property switcher
      if (event.key === 'k' || event.key === 'K') {
        event.preventDefault();

        // Find and click the property selector button
        const propertySelector = document.querySelector('[aria-label="Select property"]') as HTMLButtonElement;
        if (propertySelector) {
          propertySelector.click();
        }

        return;
      }

      // Cmd/Ctrl + 0: Switch to portfolio view (all properties)
      if (event.key === '0') {
        event.preventDefault();

        if (properties.length > 1) {
          setViewMode('all');
          // Navigate to portfolio dashboard
          navigate('/admin/portfolio');
        }

        return;
      }

      // Cmd/Ctrl + 1-9: Quick switch to property by index
      const numberKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
      const keyIndex = numberKeys.indexOf(event.key);

      if (keyIndex !== -1) {
        event.preventDefault();

        // Check if property at this index exists
        if (properties[keyIndex]) {
          setSelectedPropertyId(properties[keyIndex]._id);

          // If currently on portfolio page, navigate to single property dashboard
          if (window.location.pathname === '/admin/portfolio') {
            navigate('/admin/dashboard');
          }
        }

        return;
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [properties, setSelectedPropertyId, setViewMode, navigate]);
}

export default useKeyboardShortcuts;
