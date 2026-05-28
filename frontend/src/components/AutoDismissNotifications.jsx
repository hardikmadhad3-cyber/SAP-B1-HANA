import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const DISMISS_AFTER_MS = 6500;
const FADE_MS = 180;

const ALERT_SELECTOR = [
  ".so-alert",
  ".po-alert",
  ".del-alert",
  ".im-alert",
  ".uom-alert",
  ".coa-alert",
  ".tc-alert",
  ".pt-alert",
  ".st-alert",
  ".br-alert",
  ".sap-alert",
  ".admin-panel-alert",
  ".auth-alert",
  ".rs-message",
  ".gr-message",
  ".alert.alert-success",
  ".alert.alert-danger",
  ".alert.alert-warning",
  ".alert.alert-info",
].join(",");

const DISMISS_EXCLUDED_SELECTOR = [
  "[data-auto-dismiss='false']",
  ".sap-auto-dismiss-exempt",
  "[role='dialog']",
  ".modal",
  ".modal-dialog",
].join(",");

const timers = new WeakMap();

const isDismissibleAlert = (element) => {
  if (!(element instanceof HTMLElement)) return false;
  if (!element.matches(ALERT_SELECTOR)) return false;
  if (element.closest(DISMISS_EXCLUDED_SELECTOR)) return false;

  const text = element.textContent?.trim() || "";
  if (!text || /^loading(?:\.{1,3}|\u2026|\s|$)/i.test(text)) return false;

  return true;
};

const findAlertElement = (node) => {
  if (node instanceof HTMLElement && node.matches(ALERT_SELECTOR)) {
    return node;
  }

  return node?.parentElement?.closest?.(ALERT_SELECTOR) || null;
};

const queueDismiss = (element) => {
  if (!isDismissibleAlert(element)) return;

  const existingTimer = timers.get(element);
  if (existingTimer) {
    window.clearTimeout(existingTimer);
  }

  element.hidden = false;
  element.removeAttribute("aria-hidden");
  element.classList.add("sap-auto-dismiss-notification");
  element.classList.remove("is-dismissing");

  const timer = window.setTimeout(() => {
    if (!element.isConnected || !isDismissibleAlert(element)) return;

    element.classList.add("is-dismissing");
    window.setTimeout(() => {
      if (!element.isConnected) return;
      element.hidden = true;
      element.setAttribute("aria-hidden", "true");
      timers.delete(element);
    }, FADE_MS);
  }, DISMISS_AFTER_MS);

  timers.set(element, timer);
};

const scanAlerts = (root) => {
  if (!(root instanceof Element || root instanceof Document)) return;

  if (root instanceof HTMLElement) {
    queueDismiss(root);
  }

  root.querySelectorAll?.(ALERT_SELECTOR).forEach(queueDismiss);
};

function AutoDismissNotifications() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }

    scanAlerts(document);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              scanAlerts(node);
            }
          });
          return;
        }

        if (mutation.type === "characterData") {
          queueDismiss(findAlertElement(mutation.target));
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [location.pathname]);

  return null;
}

export default AutoDismissNotifications;
