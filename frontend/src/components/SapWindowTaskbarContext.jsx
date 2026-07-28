import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  buildCompanyScopedSessionKey,
  buildCompanyStorageScope,
  createActiveCompanyScopedRouteState,
  getActiveCompanyStorageScope,
} from "../utils/companyStorageScope";
import { mergeWindowTaskState } from "../utils/windowTaskState";

const SapWindowTaskbarContext = createContext(null);
const TASKBAR_STORAGE_KEY = "sap-window-taskbar/tasks";
const WINDOW_STATE_STORAGE_PREFIX = "sap-window-state:";

const normalizeTaskPath = (path = "") =>
  `/${String(path || "").replace(/^\/+/, "")}`.replace(/\/+$/g, "") || "/";

const prettifyTaskTitle = (pathname = "") => {
  const cleaned = normalizeTaskPath(pathname)
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean)
    .filter((segment) => !/^\d+$/.test(segment));

  if (!cleaned.length) return "Window";

  return cleaned
    .map((segment) =>
      segment
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase()),
    )
    .join(" / ");
};

const getCurrentRouteState = () => {
  if (typeof window === "undefined") return null;

  const historyState = window.history?.state;
  if (historyState?.usr && typeof historyState.usr === "object") {
    return historyState.usr;
  }

  if (historyState?.state && typeof historyState.state === "object") {
    return historyState.state;
  }

  return null;
};

const readStoredTasks = (storageKey) => {
  if (typeof window === "undefined") return [];

  try {
    const rawValue = window.sessionStorage.getItem(storageKey);
    if (!rawValue) return [];

    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch (_error) {
    return [];
  }
};

export function SapWindowTaskbarProvider({ children }) {
  const { company } = useAuth();
  const companyScope = useMemo(
    () => buildCompanyStorageScope(company),
    [company?.companyId, company?.dbName, company?.serverName],
  );
  const taskbarStorageKey = useMemo(
    () => buildCompanyScopedSessionKey(TASKBAR_STORAGE_KEY, companyScope),
    [companyScope],
  );
  const [taskStore, setTaskStore] = useState(() => ({
    storageKey: taskbarStorageKey,
    tasks: readStoredTasks(taskbarStorageKey),
  }));
  const tasks = taskStore.tasks;

  const upsertTask = useCallback((task) => {
    if (!task?.id) return;

    setTaskStore((store) => {
      const current = store.tasks;
      const normalizedTask = {
        id: task.id,
        title: task.title || "Window",
        path: task.path || window.location.pathname,
        state: Object.prototype.hasOwnProperty.call(task, "state") ? task.state : undefined,
      };
      const existingIndex = current.findIndex((entry) => entry.id === normalizedTask.id);

      if (existingIndex === -1) {
        return {
          ...store,
          tasks: [...current, { ...normalizedTask, state: normalizedTask.state ?? null }],
        };
      }

      const next = [...current];
      const existingTask = next[existingIndex];
      const mergedTask = {
        ...existingTask,
        id: normalizedTask.id,
        title: normalizedTask.title,
        path: normalizedTask.path,
        state: mergeWindowTaskState(existingTask.state, normalizedTask.state),
      };
      if (
        existingTask.title === mergedTask.title
        && existingTask.path === mergedTask.path
        && JSON.stringify(existingTask.state || null) === JSON.stringify(mergedTask.state || null)
      ) {
        return store;
      }

      next[existingIndex] = mergedTask;
      return {
        ...store,
        tasks: next,
      };
    });
  }, []);

  const removeTask = useCallback((taskId) => {
    setTaskStore((store) => {
      const current = store.tasks;
      const next = current.filter((task) => task.id !== taskId);
      return next.length === current.length
        ? store
        : {
            ...store,
            tasks: next,
          };
    });
  }, []);

  useEffect(() => {
    setTaskStore({
      storageKey: taskbarStorageKey,
      tasks: readStoredTasks(taskbarStorageKey),
    });
  }, [taskbarStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (taskStore.storageKey !== taskbarStorageKey) return;
    window.sessionStorage.setItem(taskStore.storageKey, JSON.stringify(taskStore.tasks));
  }, [taskStore, taskbarStorageKey]);

  const value = useMemo(
    () => ({
      companyScope,
      tasks,
      upsertTask,
      removeTask,
    }),
    [companyScope, removeTask, tasks, upsertTask],
  );

  return (
    <SapWindowTaskbarContext.Provider value={value}>
      {children}
    </SapWindowTaskbarContext.Provider>
  );
}

export function useSapWindowTaskbar() {
  return useContext(SapWindowTaskbarContext);
}

export function useSapWindowTaskbarActions() {
  const taskbar = useSapWindowTaskbar();
  const navigate = useNavigate();
  const companyScope = taskbar?.companyScope || getActiveCompanyStorageScope();
  const getWindowStateStorageKey = useCallback(
    (taskId) => buildCompanyScopedSessionKey(`${WINDOW_STATE_STORAGE_PREFIX}${taskId}`, companyScope),
    [companyScope],
  );

  const minimizeCurrentRouteTask = useCallback((excludeId = null) => {
    if (typeof window === "undefined") return;

    const currentPath = normalizeTaskPath(window.location.pathname);
    const currentRouteState = getCurrentRouteState();
    const currentWindow = currentRouteState?.sapWindow || null;
    const currentTaskId = currentWindow?.id || `page-window:${currentPath}`;

    if (!currentTaskId || currentTaskId === excludeId) {
      return;
    }

    window.sessionStorage.setItem(
      getWindowStateStorageKey(currentTaskId),
      JSON.stringify({ isMaximized: false, isMinimized: true })
    );

    taskbar?.upsertTask?.({
      id: currentTaskId,
      path: currentWindow?.path || currentPath,
      title: currentWindow?.title || prettifyTaskTitle(currentPath),
      state: currentRouteState ? createActiveCompanyScopedRouteState(currentRouteState) : undefined,
    });
  }, [getWindowStateStorageKey, taskbar]);

  const restoreTask = useCallback((task, { minimizeActive = true } = {}) => {
    if (!task) return false;
    if (minimizeActive) {
      minimizeCurrentRouteTask(task.id);
      window.dispatchEvent(new CustomEvent("sap-window-minimize-active", { detail: { excludeId: task.id } }));
    }
    if (typeof window !== "undefined") {
      const storageKey = getWindowStateStorageKey(task.id);
      const nextState = {
        isMaximized: false,
        isMinimized: false,
      };
      window.sessionStorage.setItem(storageKey, JSON.stringify(nextState));
    }
    taskbar?.removeTask(task.id);
    window.dispatchEvent(new CustomEvent("sap-window-restore", { detail: { id: task.id } }));

    if (task.path) {
      const navigationOptions = task.state ? { state: task.state } : undefined;
      if (task.path !== window.location.pathname) {
        navigate(task.path, navigationOptions);
      } else if (task.state) {
        navigate(task.path, { ...navigationOptions, replace: true });
      }
    }
    return true;
  }, [getWindowStateStorageKey, minimizeCurrentRouteTask, navigate, taskbar]);

  const closeActiveAndRestorePrevious = useCallback(() => {
    const previousTask = taskbar?.tasks?.[taskbar.tasks.length - 1];
    if (!previousTask) return false;
    return restoreTask(previousTask, { minimizeActive: false });
  }, [restoreTask, taskbar]);

  return {
    closeActiveAndRestorePrevious,
    minimizeCurrentRouteTask,
    removeTask: taskbar?.removeTask,
    restoreTask,
    upsertTask: taskbar?.upsertTask,
    taskCount: taskbar?.tasks?.length || 0,
  };
}

export function SapWindowTaskbar() {
  const taskbar = useSapWindowTaskbar();
  const { restoreTask } = useSapWindowTaskbarActions();

  if (!taskbar?.tasks?.length) {
    return null;
  }

  return (
    <div className="sap-window-taskbar" aria-label="Minimized windows">
      {taskbar.tasks.map((task) => (
        <button
          key={task.id}
          type="button"
          className="sap-window-taskbar__item"
          onClick={() => restoreTask(task)}
          title={task.title}
        >
          <span className="sap-window-taskbar__icon" aria-hidden="true" />
          <span className="sap-window-taskbar__title">{task.title}</span>
        </button>
      ))}
    </div>
  );
}
