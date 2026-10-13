import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({ effects: [] }));
vi.mock("react", () => ({
  useEffect: (effect) => hooks.effects.push(effect),
  useRef: (current) => ({ current }),
}));

import { dismissOnBackdrop, useModalFocus } from "@/lib/use-modal-focus";

describe("dialog keyboard and focus behavior", () => {
  let keydown;
  let first;
  let last;
  let previous;
  let dialog;
  let onClose;
  let cleanup;

  beforeEach(() => {
    hooks.effects = [];
    class Element {
      focus = vi.fn();
      getClientRects = () => [{}];
    }
    first = new Element();
    last = new Element();
    previous = new Element();
    dialog = new Element();
    dialog.querySelector = () => first;
    dialog.querySelectorAll = () => [first, last];
    dialog.contains = (element) => element === first || element === last;
    vi.stubGlobal("HTMLElement", Element);
    vi.stubGlobal("document", {
      activeElement: previous,
      body: { style: { overflow: "auto" } },
      contains: () => true,
      addEventListener: (type, callback) => { if (type === "keydown") keydown = callback; },
      removeEventListener: vi.fn(),
    });
    onClose = vi.fn();
    const ref = useModalFocus(true, onClose);
    ref.current = dialog;
    hooks.effects[0]();
    cleanup = hooks.effects[1]();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("lets a dropdown consume Escape before closing the dialog", () => {
    const preventDefault = vi.fn();
    keydown({ key: "Escape", defaultPrevented: true, preventDefault });
    expect(onClose).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
    keydown({ key: "Escape", defaultPrevented: false, preventDefault });
    expect(onClose).toHaveBeenCalledOnce();
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it("keeps Tab navigation inside the dialog and restores focus and scrolling", () => {
    expect(first.focus).toHaveBeenCalledOnce();
    expect(document.body.style.overflow).toBe("hidden");
    document.activeElement = last;
    const preventDefault = vi.fn();
    keydown({ key: "Tab", shiftKey: false, preventDefault });
    expect(first.focus).toHaveBeenCalledTimes(2);
    document.activeElement = first;
    keydown({ key: "Tab", shiftKey: true, preventDefault });
    expect(last.focus).toHaveBeenCalledOnce();
    expect(preventDefault).toHaveBeenCalledTimes(2);
    cleanup();
    expect(document.body.style.overflow).toBe("auto");
    expect(previous.focus).toHaveBeenCalledOnce();
    cleanup = () => {};
  });

  it("only dismisses when the backdrop itself is pressed", () => {
    dismissOnBackdrop({ target: first, currentTarget: dialog }, onClose);
    expect(onClose).not.toHaveBeenCalled();
    dismissOnBackdrop({ target: dialog, currentTarget: dialog }, onClose);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
