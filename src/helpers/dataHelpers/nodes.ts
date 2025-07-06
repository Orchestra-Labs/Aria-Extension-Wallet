const ERROR_COUNTS_KEY = 'nodeErrorCounts';

// Retrieve error counts from localStorage
export const getNodeErrorCounts = (): Record<string, number> => {
  const errorCounts = localStorage.getItem(ERROR_COUNTS_KEY);
  return errorCounts ? JSON.parse(errorCounts) : {};
};

// Store error counts in localStorage
export const storeNodeErrorCounts = (errorCounts: Record<string, number>): void => {
  localStorage.setItem(ERROR_COUNTS_KEY, JSON.stringify(errorCounts));
};

// Reset error counts (e.g., on login)
export const resetNodeErrorCounts = (): void => {
  localStorage.removeItem(ERROR_COUNTS_KEY);
};
