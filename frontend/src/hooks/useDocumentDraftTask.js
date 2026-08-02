import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useSapWindowTaskbarActions } from '../components/SapWindowTaskbarContext';
import { buildDocumentDraftTask } from '../utils/documentDraftTask';

const useDocumentDraftTask = ({
  buildDraftState,
  enabled = true,
  title = 'Document',
} = {}) => {
  const location = useLocation();
  const { upsertTask } = useSapWindowTaskbarActions();
  const buildDraftStateRef = useRef(buildDraftState);

  buildDraftStateRef.current = buildDraftState;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return undefined;
    }

    const preserveDraftOnMinimize = (event) => {
      const draftState = buildDraftStateRef.current?.();
      if (!draftState) return;

      const draftTask = buildDocumentDraftTask({
        routedWindow: location.state?.sapWindow,
        pathname: location.pathname,
        title,
        draftState,
      });

      if (event.detail?.excludeId === draftTask.id) return;
      upsertTask?.(draftTask);
    };

    window.addEventListener('sap-window-minimize-active', preserveDraftOnMinimize);
    return () => {
      window.removeEventListener('sap-window-minimize-active', preserveDraftOnMinimize);
    };
  }, [enabled, location.pathname, location.state?.sapWindow, title, upsertTask]);
};

export default useDocumentDraftTask;
