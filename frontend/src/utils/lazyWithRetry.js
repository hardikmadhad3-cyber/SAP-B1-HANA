import { lazy } from 'react';

const STALE_CHUNK_RELOAD_KEY = 'sapb1.lazyReloadPath';

const isRecoverableChunkError = (error) => {
  const message = `${error?.name || ''} ${error?.message || ''}`.toLowerCase();
  return (
    message.includes('loading chunk') ||
    message.includes('failed to fetch dynamically imported module') ||
    message.includes("unexpected token '<'") ||
    message.includes('importing a module script failed') ||
    message.includes('mime type')
  );
};

const reloadOnceForStaleChunk = (error) => {
  if (typeof window === 'undefined' || !isRecoverableChunkError(error)) return false;
  const currentPath = `${window.location.pathname}${window.location.search}`;
  const lastReloadPath = window.sessionStorage?.getItem(STALE_CHUNK_RELOAD_KEY);
  if (lastReloadPath === currentPath) return false;

  window.sessionStorage?.setItem(STALE_CHUNK_RELOAD_KEY, currentPath);
  window.location.reload();
  return true;
};

/**
 * lazyWithRetry
 * Wraps React.lazy() with retry logic for failed chunk loads
 * 
 * @param {Function} componentImport - The dynamic import function
 * @param {number} retries - Number of retry attempts (default: 3)
 * @param {number} interval - Delay between retries in ms (default: 1000)
 * @returns {React.LazyExoticComponent}
 */
function lazyWithRetry(componentImport, retries = 3, interval = 1000) {
  return lazy(() => {
    return new Promise((resolve, reject) => {
      const attemptLoad = (attemptsLeft) => {
        componentImport()
          .then((module) => {
            if (typeof window !== 'undefined') {
              window.sessionStorage?.removeItem(STALE_CHUNK_RELOAD_KEY);
            }
            resolve(module);
          })
          .catch((error) => {
            if (attemptsLeft === 1) {
              if (reloadOnceForStaleChunk(error)) return;
              // No more retries left
              reject(error);
              return;
            }
            
            // Retry after interval
            console.warn(`Chunk load failed, retrying... (${attemptsLeft - 1} attempts left)`);
            setTimeout(() => {
              attemptLoad(attemptsLeft - 1);
            }, interval);
          });
      };
      
      attemptLoad(retries);
    });
  });
}

export default lazyWithRetry;
