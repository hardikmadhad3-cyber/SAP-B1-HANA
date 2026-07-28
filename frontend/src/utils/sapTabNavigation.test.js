import {
  consumePendingLookupQuery,
  installSapTabNavigation,
} from "./sapTabNavigation";

describe("SAP lookup Tab navigation", () => {
  let restoreClientRects;
  let cleanupNavigation;

  beforeEach(() => {
    const originalGetClientRects = HTMLElement.prototype.getClientRects;
    HTMLElement.prototype.getClientRects = function getClientRects() {
      return [{ width: 100, height: 20 }];
    };
    restoreClientRects = () => {
      HTMLElement.prototype.getClientRects = originalGetClientRects;
    };

    window.__sapB1TabNavigationInstalled = false;
    window.__sapB1PendingLookupQuery = "";
    cleanupNavigation = installSapTabNavigation();
  });

  afterEach(() => {
    cleanupNavigation?.();
    restoreClientRects?.();
    document.body.replaceChildren();
    delete window.__sapB1PendingLookupQuery;
  });

  test("opens a payment lookup with the value entered before Tab", () => {
    const wrapper = document.createElement("span");
    wrapper.className = "sap-lookup";
    const input = document.createElement("input");
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.sapLookupButton = "true";
    button.textContent = "...";
    wrapper.append(input, button);
    document.body.append(wrapper);

    const openLookup = jest.fn(() => consumePendingLookupQuery());
    button.addEventListener("click", openLookup);

    input.focus();
    input.value = "V20000";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    }));

    expect(openLookup).toHaveBeenCalledTimes(1);
    expect(openLookup).toHaveReturnedWith("V20000");
    expect(window.__sapB1PendingLookupQuery).toBe("");
  });

  test("normal Tab navigation does not reopen an unchanged resolved value", () => {
    const wrapper = document.createElement("span");
    wrapper.className = "sap-lookup";
    const input = document.createElement("input");
    input.value = "V20000";
    input.dataset.sapLookupResolvedValue = "V20000";
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.sapLookupButton = "true";
    wrapper.append(input, button);
    document.body.append(wrapper);

    const openLookup = jest.fn();
    button.addEventListener("click", openLookup);

    input.focus();
    input.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    }));

    expect(openLookup).not.toHaveBeenCalled();
  });
});
