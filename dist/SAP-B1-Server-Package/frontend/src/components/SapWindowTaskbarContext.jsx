import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const SapWindowTaskbarContext = createContext(null);
const TASKBAR_STORAGE_KEY = "sap-window-taskbar/tasks";
const WINDOW_STATE_STORAGE_PREFIX = "sap-window-state:";

const readStoredTasks = () => {
  if (typeof window === "undefined") return [];

  try {
    const rawValue = window.sessionStorage.getItem(TASKBAR_STORAGE_KEY);
    if (!rawValue) return [];

    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch (_error) {
    return [];
  }
};

export function SapWindowTaskbarProvider({ children }) {
  const [tasks, setTasks] = useState(readStoredTasks);

  const upsertTask = useCallback((task) => {
    if (!task?.id) return;

    setTasks((current) => {
      const normalizedTask = {
        id: task.id,
        title: task.title || "Window",
        path: task.path || window.location.pathname,
        state: Object.prototype.hasOwnProperty.call(task, "state") ? task.state : undefined,
      };
      const existingIndex = current.findIndex((entry) => entry.id === normalizedTask.id);

      if (existingIndex === -1) {
        return [...current, { ...normalizedTask, state: normalizedTask.state ?? null }];
      }

      const next = [...current];
      const existingTask = next[existingIndex];
      const mergedTask = {
        ...existingTask,
        id: normalizedTask.id,
        title: normalizedTask.title,
        path: normalizedTask.path,
        state: normalizedTask.state === undefined ? existingTask.state : normalizedTask.state,
      };
      if (
        existingTask.title === mergedTask.title
        && existingTask.path === mergedTask.path
        && JSON.stringify(existingTask.state || null) === JSON.stringify(mergedTask.state || null)
      ) {
        return current;
      }

      next[existingIndex] = mergedTask;
      return next;
    });
  }, []);

  const removeTask = useCallback((taskId) => {
    setTasks((current) => {
      const next = current.filter((task) => task.id !== taskId);
      return next.length === current.length ? current : next;
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(TASKBAR_STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const value = useMemo(
    () => ({
      tasks,
      upsertTask,
      removeTask,
    }),
    [removeTask, tasks, upsertTask],
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

  const restoreTask = useCallback((task, { minimizeActive = true } = {}) => {
    if (!task) return false;
    if (minimizeActive) {
      window.dispatchEvent(new CustomEvent("sap-window-minimize-active", { detail: { excludeId: task.id } }));
    }
    if (typeof window !== "undefined") {
      const storageKey = `${WINDOW_STATE_STORAGE_PREFIX}${task.id}`;
      const nextState = {
        isMaximized: false,
        isMinimized: false,
      };
      window.sessionStorage.setItem(storageKey, JSON.stringify(nextState));
    }
    taskbar?.removeTask(task.id);
    window.dispatchEvent(new CustomEvent("sap-window-restore", { detail: { id: task.id } }));

    if (task.path && task.path !== window.location.pathname) {
      navigate(task.path, task.state ? { state: task.state } : undefined);
    }
    return true;
  }, [navigate, taskbar]);

  const closeActiveAndRestorePrevious = useCallback(() => {
    const previousTask = taskbar?.tasks?.[taskbar.tasks.length - 1];
    if (!previousTask) return false;
    return restoreTask(previousTask, { minimizeActive: false });
  }, [restoreTask, taskbar]);

  return {
    closeActiveAndRestorePrevious,
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
