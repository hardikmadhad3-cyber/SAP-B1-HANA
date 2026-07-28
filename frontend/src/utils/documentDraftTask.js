import { createActiveCompanyScopedRouteState } from './companyStorageScope';

const normalizeDocumentTaskPath = (path = '') =>
  `/${String(path || '').replace(/^\/+/, '')}`.replace(/\/+$/g, '') || '/';

export const buildDocumentDraftTask = ({
  routedWindow = null,
  pathname = '',
  title = 'Document',
  draftState = {},
} = {}) => {
  const path = normalizeDocumentTaskPath(routedWindow?.path || pathname);
  const sapWindow = routedWindow?.id
    ? {
      ...routedWindow,
      path,
      title: routedWindow.title || title,
    }
    : {
      id: `page-window:${path}`,
      path,
      title,
    };

  return {
    id: sapWindow.id,
    path,
    title: sapWindow.title,
    state: createActiveCompanyScopedRouteState({
      ...(draftState || {}),
      sapWindow,
    }),
  };
};

export default buildDocumentDraftTask;
