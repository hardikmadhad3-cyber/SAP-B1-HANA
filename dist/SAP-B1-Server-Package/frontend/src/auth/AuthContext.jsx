import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchMenu, fetchUserCompanies, loginUser, selectCompany } from '../api/authApi';
import {
  clearAuthSession,
  clearPendingAuth,
  getAuthSession,
  getLastSelectedCompanyId,
  getLastSelectedCompanyInfo,
  getPendingAuth,
  setAuthSession,
  setLastSelectedCompanyId,
  setLastSelectedCompanyInfo,
  setPendingAuth,
} from './storage';
import { getDefaultRoute } from './routeUtils';

const AuthContext = createContext(null);

const buildSessionFromSelection = (selectionResult, pendingAuth) => ({
  token: selectionResult.token,
  user: pendingAuth.user,
  company: selectionResult.company,
  roleId: selectionResult.roleId,
  roleName: selectionResult.roleName,
  menus: selectionResult.menus || [],
  menuPaths: selectionResult.menuPaths || [],
});

export const AuthProvider = ({ children }) => {
  const [session, setSessionState] = useState(() => getAuthSession());
  const [pendingAuth, setPendingAuthState] = useState(() => getPendingAuth());
  const [isBootstrapping, setIsBootstrapping] = useState(() => Boolean(getAuthSession()?.token));

  useEffect(() => {
    let isCancelled = false;

    const refreshMenus = async () => {
      if (!session?.token) {
        setIsBootstrapping(false);
        return;
      }

      try {
        const menuResponse = await fetchMenu();
        if (isCancelled) return;

        setSessionState((current) => {
          if (!current) return current;

          const nextSession = {
            ...current,
            menus: menuResponse.menus || [],
            menuPaths: menuResponse.menuPaths || [],
          };

          setAuthSession(nextSession);
          return nextSession;
        });
      } catch (_error) {
        if (isCancelled) return;
        clearAuthSession();
        setSessionState(null);
      } finally {
        if (!isCancelled) {
          setIsBootstrapping(false);
        }
      }
    };

    refreshMenus();
    return () => {
      isCancelled = true;
    };
  }, [session?.token, session?.roleId]);

  const login = useCallback(async (username, password) => {
    const response = await loginUser({ username, password });
    const nextPendingAuth = {
      preAuthToken: response.preAuthToken,
      user: response.user,
    };

    clearAuthSession();
    setSessionState(null);
    setPendingAuth(nextPendingAuth);
    setPendingAuthState(nextPendingAuth);
    return nextPendingAuth;
  }, []);

  const loadCompanies = useCallback(async (userId) => fetchUserCompanies(userId), []);

  const completeCompanySelection = useCallback(async (companyId) => {
    const activePendingAuth = pendingAuth || getPendingAuth();

    if (!activePendingAuth?.user?.userId) {
      throw new Error('Sign in again to continue.');
    }

    const response = await selectCompany({
      userId: activePendingAuth.user.userId,
      companyId,
    });

    const nextSession = buildSessionFromSelection(response, activePendingAuth);
    clearPendingAuth();
    setPendingAuthState(null);
    setAuthSession(nextSession);
    setSessionState(nextSession);
    setLastSelectedCompanyId(activePendingAuth.user.userId, companyId);
    setLastSelectedCompanyInfo(nextSession.company);
    return nextSession;
  }, [pendingAuth]);

  const logout = useCallback(() => {
    clearAuthSession();
    clearPendingAuth();
    setIsBootstrapping(false);
    setSessionState(null);
    setPendingAuthState(null);
  }, []);

  const getRememberedCompanyId = useCallback(
    () => getLastSelectedCompanyId(pendingAuth?.user?.userId),
    [pendingAuth?.user?.userId],
  );

  const value = {
    session,
    pendingAuth,
    isBootstrapping,
    isAuthenticated: Boolean(session?.token),
    hasPendingSelection: Boolean(pendingAuth?.preAuthToken && pendingAuth?.user?.userId),
    user: session?.user || pendingAuth?.user || null,
    company: session?.company || null,
    menus: session?.menus || [],
    menuPaths: session?.menuPaths || [],
    roleName: session?.roleName || '',
    defaultRoute: getDefaultRoute(session?.menuPaths || []),
    login,
    loadCompanies,
    completeCompanySelection,
    logout,
    getRememberedCompanyId,
    getLastSelectedCompanyInfo,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }
  return context;
};
