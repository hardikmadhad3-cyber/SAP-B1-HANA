import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchMenu, fetchUserCompanies, loginAdminUser, loginUser, selectCompany } from '../api/authApi';
import {
  clearAdminSession,
  clearAuthSession,
  clearPendingAuth,
  getAdminSession,
  getAuthSession,
  getLastSelectedCompanyId,
  getLastSelectedCompanyInfo,
  getPendingAuth,
  setAdminSession,
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
  generalSettings: selectionResult.generalSettings || {},
  menus: selectionResult.menus || [],
  menuPaths: selectionResult.menuPaths || [],
});

const buildAdminSession = (loginResult) => ({
  token: loginResult.token,
  user: loginResult.user,
  roleId: loginResult.roleId,
  roleName: loginResult.roleName,
});

export const AuthProvider = ({ children }) => {
  const [session, setSessionState] = useState(() => getAuthSession());
  const [adminSession, setAdminSessionState] = useState(() => getAdminSession());
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

  const adminLogin = useCallback(async (username, password) => {
    const response = await loginAdminUser({ username, password });
    const nextAdminSession = buildAdminSession(response);

    setAdminSession(nextAdminSession);
    setAdminSessionState(nextAdminSession);
    return nextAdminSession;
  }, []);

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

  const adminLogout = useCallback(() => {
    clearAdminSession();
    setAdminSessionState(null);
  }, []);

  const getRememberedCompanyId = useCallback(
    () => getLastSelectedCompanyId(pendingAuth?.user?.userId),
    [pendingAuth?.user?.userId],
  );

  const value = {
    session,
    adminSession,
    pendingAuth,
    isBootstrapping,
    isAuthenticated: Boolean(session?.token),
    isAdminAuthenticated: Boolean(adminSession?.token),
    hasPendingSelection: Boolean(pendingAuth?.preAuthToken && pendingAuth?.user?.userId),
    user: session?.user || pendingAuth?.user || null,
    adminUser: adminSession?.user || null,
    company: session?.company || null,
    menus: session?.menus || [],
    menuPaths: session?.menuPaths || [],
    roleName: session?.roleName || '',
    adminRoleName: adminSession?.roleName || '',
    defaultRoute: getDefaultRoute(session?.menuPaths || []),
    login,
    adminLogin,
    loadCompanies,
    completeCompanySelection,
    logout,
    adminLogout,
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
