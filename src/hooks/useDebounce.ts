import { useEffect, useState } from 'react';

/**
 * Hook for debounce.
 *
 * @param value - Value, that's needs to be debounced.
 * @param delay - timeout in ms. Default is 500ms
 * @returns Delayed value.
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // clear interval after changing
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
