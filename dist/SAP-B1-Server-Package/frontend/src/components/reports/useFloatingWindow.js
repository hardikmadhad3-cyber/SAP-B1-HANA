import { useCallback, useEffect, useRef, useState } from "react";
import { useSapWindowTaskbar } from "../SapWindowTaskbarContext";

const WINDOW_STATE_STORAGE_PREFIX = "sap-window-state:";
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const readPersistedWindowState = (taskId) => {
  if (!taskId || typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(`${WINDOW_STATE_STORAGE_PREFIX}${taskId}`);
    if (!rawValue) return null;

    const parsedValue = JSON.parse(rawValue);
    return parsedValue && typeof parsedValue === "object" ? parsedValue : null;
  } catch (_error) {
    return null;
  }
};

const writePersistedWindowState = (taskId, value) => {
  if (!taskId || typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(`${WINDOW_STATE_STORAGE_PREFIX}${taskId}`, JSON.stringify(value));
};

const clearPersistedWindowState = (taskId) => {
  if (!taskId || typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(`${WINDOW_STATE_STORAGE_PREFIX}${taskId}`);
};

function useFloatingWindow({
  isOpen = true,
  defaultTop = 16,
  minMargin = 8,
  resetOnClose = true,
  taskId,
  taskTitle,
  taskPath,
} = {}) {
  const taskbar = useSapWindowTaskbar();
  const removeTask = taskbar?.removeTask;
  const upsertTask = taskbar?.upsertTask;
  const persistedStateRef = useRef(readPersistedWindowState(taskId));
  const windowRef = useRef(null);
  const dragStateRef = useRef(null);
  const restoreAfterMountRef = useRef(false);
  const [position, setPosition] = useState(persistedStateRef.current?.position ?? null);
  const [isMinimized, setIsMinimized] = useState(Boolean(persistedStateRef.current?.isMinimized));
  const [isMaximized, setIsMaximized] = useState(Boolean(persistedStateRef.current?.isMaximized));
  const lastFloatingPositionRef = useRef(persistedStateRef.current?.position ?? null);

  const centerWindow = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const node = windowRef.current;
    if (!node) {
      return;
    }

    const rect = node.getBoundingClientRect();
    const maxLeft = Math.max(minMargin, window.innerWidth - rect.width - minMargin);
    const maxTop = Math.max(minMargin, window.innerHeight - rect.height - minMargin);
    const centeredLeft = (window.innerWidth - rect.width) / 2;
    const nextLeft = clamp(centeredLeft - 80, minMargin, maxLeft);
    const nextTop = clamp(defaultTop, minMargin, maxTop);

    const nextPosition = {
      left: nextLeft,
      top: nextTop,
    };

    lastFloatingPositionRef.current = nextPosition;
    setPosition(nextPosition);
  }, [defaultTop, minMargin]);

  useEffect(() => {
    if (!taskId) return;

    writePersistedWindowState(taskId, {
      isMaximized,
      isMinimized,
      position,
    });
  }, [isMaximized, isMinimized, position, taskId]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const shouldMarkMaximized = isOpen && isMaximized && !isMinimized;
    document.body.classList.toggle("sap-floating-window-maximized", shouldMarkMaximized);
    return () => {
      document.body.classList.remove("sap-floating-window-maximized");
    };
  }, [isMaximized, isMinimized, isOpen]);

  useEffect(() => {
    if (!taskId) return;

    if (!isOpen) {
      removeTask?.(taskId);
      return;
    }

    if (isMinimized) {
      upsertTask?.({
        id: taskId,
        path: taskPath || (typeof window !== "undefined" ? window.location.pathname : ""),
        title: taskTitle || "Window",
      });
      return;
    }

    removeTask?.(taskId);
  }, [isMinimized, isOpen, removeTask, taskId, taskPath, taskTitle, upsertTask]);

  useEffect(() => {
    if (!isOpen) {
      if (resetOnClose) {
        dragStateRef.current = null;
        lastFloatingPositionRef.current = null;
        setPosition(null);
        setIsMaximized(false);
        setIsMinimized(false);
        clearPersistedWindowState(taskId);
        removeTask?.(taskId);
      }
      return undefined;
    }

    if (position || isMaximized) {
      return undefined;
    }

    const frameId = window.requestAnimationFrame(centerWindow);
    return () => window.cancelAnimationFrame(frameId);
  }, [centerWindow, isMaximized, isOpen, position, removeTask, resetOnClose, taskId]);

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") {
      return undefined;
    }

    const handleMouseMove = (event) => {
      const dragState = dragStateRef.current;
      if (!dragState || isMaximized || isMinimized) {
        return;
      }

      const maxLeft = Math.max(minMargin, window.innerWidth - dragState.width - minMargin);
      const maxTop = Math.max(minMargin, window.innerHeight - dragState.height - minMargin);
      const nextPosition = {
        left: clamp(dragState.startLeft + (event.clientX - dragState.startX), minMargin, maxLeft),
        top: clamp(dragState.startTop + (event.clientY - dragState.startY), minMargin, maxTop),
      };

      lastFloatingPositionRef.current = nextPosition;
      setPosition(nextPosition);
    };

    const handleMouseUp = () => {
      dragStateRef.current = null;
      document.body.style.userSelect = "";
    };

    const handleResize = () => {
      const node = windowRef.current;
      if (!node || isMaximized) {
        return;
      }

      const rect = node.getBoundingClientRect();
      setPosition((current) => {
        if (!current) {
          return current;
        }

        const maxLeft = Math.max(minMargin, window.innerWidth - rect.width - minMargin);
        const maxTop = Math.max(minMargin, window.innerHeight - rect.height - minMargin);
        const nextPosition = {
          left: clamp(current.left, minMargin, maxLeft),
          top: clamp(current.top, minMargin, maxTop),
        };

        lastFloatingPositionRef.current = nextPosition;
        return nextPosition;
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("resize", handleResize);
      document.body.style.userSelect = "";
    };
  }, [isMaximized, isMinimized, isOpen, minMargin]);

  useEffect(() => {
    if (!taskId || typeof window === "undefined") {
      return undefined;
    }

    const handleRestore = (event) => {
      if (event.detail?.id !== taskId) {
        return;
      }

      restoreAfterMountRef.current = true;
      setIsMinimized(false);
      setIsMaximized(false);
    };

    const handleMinimizeActive = (event) => {
      if (!isOpen || event.detail?.excludeId === taskId) {
        return;
      }

      setIsMinimized(true);
    };

    window.addEventListener("sap-window-restore", handleRestore);
    window.addEventListener("sap-window-minimize-active", handleMinimizeActive);

    return () => {
      window.removeEventListener("sap-window-restore", handleRestore);
      window.removeEventListener("sap-window-minimize-active", handleMinimizeActive);
    };
  }, [isOpen, taskId]);

  useEffect(() => {
    if (!restoreAfterMountRef.current || isMinimized || isMaximized) {
      return;
    }

    restoreAfterMountRef.current = false;
    if (position) {
      return;
    }

    const frameId = window.requestAnimationFrame(centerWindow);
    return () => window.cancelAnimationFrame(frameId);
  }, [centerWindow, isMaximized, isMinimized, position]);

  const handleTitleBarMouseDown = (event) => {
    if (event.button !== 0 || isMaximized || isMinimized) {
      return;
    }

    const interactiveTarget = event.target.closest("button, input, select, textarea, a, label");
    if (interactiveTarget) {
      return;
    }

    const node = windowRef.current;
    if (!node) {
      return;
    }

    const rect = node.getBoundingClientRect();
    dragStateRef.current = {
      height: rect.height,
      startLeft: position?.left ?? rect.left,
      startTop: position?.top ?? rect.top,
      startX: event.clientX,
      startY: event.clientY,
      width: rect.width,
    };
    document.body.style.userSelect = "none";
    event.preventDefault();
  };

  const restoreWindow = useCallback(() => {
    setIsMinimized(false);
    setIsMaximized(false);

    if (lastFloatingPositionRef.current) {
      setPosition(lastFloatingPositionRef.current);
      return;
    }

    const frameId = window.requestAnimationFrame(centerWindow);
    return () => window.cancelAnimationFrame(frameId);
  }, [centerWindow]);

  const toggleMinimize = useCallback(() => {
    setIsMinimized((current) => !current);
  }, []);

  const toggleMaximize = useCallback(() => {
    setIsMinimized(false);
    setIsMaximized((current) => {
      if (current) {
        const nextPosition = lastFloatingPositionRef.current;
        setPosition(nextPosition);
        return false;
      }

      const node = windowRef.current;
      if (node) {
        const rect = node.getBoundingClientRect();
        lastFloatingPositionRef.current = {
          left: position?.left ?? rect.left,
          top: position?.top ?? rect.top,
        };
      } else if (position) {
        lastFloatingPositionRef.current = position;
      }

      return true;
    });
  }, [position]);

  return {
    isMaximized,
    isMinimized,
    restoreWindow,
    titleBarProps: {
      onMouseDown: handleTitleBarMouseDown,
    },
    toggleMaximize,
    toggleMinimize,
    windowProps: {
      ref: windowRef,
      style: isMaximized
        ? {
            height: `calc(100vh - var(--sap-topbar-height, 64px) - ${minMargin}px)`,
            left: `${minMargin}px`,
            position: "fixed",
            top: `calc(var(--sap-topbar-height, 64px) + ${minMargin}px)`,
            width: `calc(100vw - ${minMargin * 2}px)`,
            zIndex: 1390,
          }
        : position
          ? {
              left: `${position.left}px`,
              position: "absolute",
              top: `${position.top}px`,
            }
          : undefined,
    },
  };
}

export default useFloatingWindow;
