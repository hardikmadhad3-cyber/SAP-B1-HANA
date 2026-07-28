import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { replaceRouteStatePreservingWindow } from '../utils/copyToState';
import useDocumentDraftTask from './useDocumentDraftTask';

const useStandardDocumentDraftTask = ({
  draftKey,
  draftValues,
  restoreDraft,
  title,
} = {}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const draftValuesRef = useRef(draftValues);
  const restoreDraftRef = useRef(restoreDraft);

  draftValuesRef.current = draftValues;
  restoreDraftRef.current = restoreDraft;

  useEffect(() => {
    if (!draftKey) return;

    const draft = location.state?.[draftKey];
    if (!draft) return;

    restoreDraftRef.current?.(draft);
    replaceRouteStatePreservingWindow(navigate, location.pathname, location.state);
  }, [draftKey, location.pathname, location.state, navigate]);

  useDocumentDraftTask({
    buildDraftState: () => (
      draftKey
        ? { [draftKey]: draftValuesRef.current }
        : null
    ),
    enabled: Boolean(draftKey),
    title,
  });
};

export default useStandardDocumentDraftTask;
