import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { fetchFormSettings, saveFormSettings } from '../api/formSettingsApi';

const normalizeScopePart = (value) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');

const areSettingsEqual = (left, right) => {
  try {
    return JSON.stringify(left || {}) === JSON.stringify(right || {});
  } catch (_error) {
    return false;
  }
};

export const buildCompanyScopedFormSettingsKey = (baseKey, company = {}) => {
  const safeCompany = company || {};
  const companyScope = [
    safeCompany.companyId !== undefined && safeCompany.companyId !== null ? `id:${safeCompany.companyId}` : '',
    safeCompany.dbName ? `db:${normalizeScopePart(safeCompany.dbName)}` : '',
    safeCompany.serverName ? `server:${normalizeScopePart(safeCompany.serverName)}` : '',
  ].filter(Boolean);

  return `${baseKey}::company:${encodeURIComponent(companyScope.join('|') || 'unselected')}`;
};

export const useCompanyScopedFormSettings = (
  baseStorageKey,
  readSavedFormSettings,
  readArgs = [],
) => {
  const { company } = useAuth();
  const storageKey = useMemo(
    () => buildCompanyScopedFormSettingsKey(baseStorageKey, company),
    [baseStorageKey, company?.companyId, company?.dbName, company?.serverName],
  );

  const readSettings = useCallback(
    (key = storageKey) => readSavedFormSettings(...readArgs, key),
    [readSavedFormSettings, storageKey, ...readArgs],
  );

  const [state, setState] = useState(() => ({
    storageKey,
    settings: readSettings(storageKey),
    loaded: false,
    saveVersion: 0,
  }));

  useEffect(() => {
    let isCancelled = false;

    setState({
      storageKey,
      settings: readSettings(storageKey),
      loaded: false,
      saveVersion: 0,
    });

    fetchFormSettings(baseStorageKey)
      .then((payload) => {
        if (isCancelled) return;

        const backendSettings = payload?.settings;
        const hasBackendSettings =
          backendSettings && typeof backendSettings === 'object' && !Array.isArray(backendSettings);

        if (hasBackendSettings && typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(storageKey, JSON.stringify(backendSettings));
        }

        const nextSettings = hasBackendSettings ? readSettings(storageKey) : readSettings(storageKey);

        setState((previous) => {
          if (previous.storageKey !== storageKey || previous.saveVersion > 0) {
            return previous;
          }

          return {
            storageKey,
            settings: nextSettings,
            loaded: true,
            saveVersion: 0,
          };
        });
      })
      .catch((error) => {
        if (isCancelled) return;
        console.warn('[FORM_SETTINGS] Unable to load backend settings:', error?.message || error);
        setState((previous) => (
          previous.storageKey === storageKey
            ? { ...previous, loaded: true }
            : previous
        ));
      });

    return () => {
      isCancelled = true;
    };
  }, [storageKey]);

  useEffect(() => {
    if (state.storageKey !== storageKey || typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(state.settings));

    if (!state.loaded || state.saveVersion <= 0) return;

    const saveTimer = window.setTimeout(() => {
      saveFormSettings(baseStorageKey, state.settings).catch((error) => {
        console.warn('[FORM_SETTINGS] Unable to save backend settings:', error?.message || error);
      });
    }, 250);

    return () => window.clearTimeout(saveTimer);
  }, [baseStorageKey, state, storageKey]);

  const setScopedFormSettings = useCallback(
    (nextSettings) => {
      setState((previous) => {
        const isCurrentScope = previous.storageKey === storageKey;
        const currentSettings =
          isCurrentScope ? previous.settings : readSettings(storageKey);
        const resolvedSettings =
          typeof nextSettings === 'function' ? nextSettings(currentSettings) : nextSettings;
        const didChange = !areSettingsEqual(currentSettings, resolvedSettings);

        if (isCurrentScope && !didChange) {
          return previous;
        }

        return {
          storageKey,
          settings: resolvedSettings,
          loaded: isCurrentScope ? previous.loaded : false,
          saveVersion: didChange && isCurrentScope && previous.loaded
            ? (previous.saveVersion || 0) + 1
            : (isCurrentScope ? (previous.saveVersion || 0) : 0),
        };
      });
    },
    [readSettings, storageKey],
  );

  return [
    state.storageKey === storageKey ? state.settings : readSettings(storageKey),
    setScopedFormSettings,
    storageKey,
  ];
};
