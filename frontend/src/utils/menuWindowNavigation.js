import { normalizePath } from '../auth/routeUtils';
import { createCompanyScopedRouteState } from './companyStorageScope';

const MULTI_INSTANCE_MENU_PATHS = new Set([
  '/ap-credit-memo',
]);

let windowInstanceSequence = 0;

const createWindowInstanceToken = () => {
  if (typeof window !== 'undefined' && typeof window.crypto?.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }

  windowInstanceSequence += 1;
  return `${Date.now().toString(36)}-${windowInstanceSequence.toString(36)}`;
};

export const supportsMultipleMenuWindows = (path = '') =>
  MULTI_INSTANCE_MENU_PATHS.has(normalizePath(path));

export const createMenuWindowRouteState = ({
  path,
  title = 'Window',
  company,
} = {}) => {
  const normalizedPath = normalizePath(path);
  const sapWindow = {
    id: `page-window:${normalizedPath}:instance-${createWindowInstanceToken()}`,
    path: normalizedPath,
    title,
  };

  return createCompanyScopedRouteState({ sapWindow }, company);
};
