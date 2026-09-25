import { afterEach, describe, expect, it, vi } from "vitest";
import { revealValidationTarget } from "../lib/validation-navigation";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("validation navigation", () => {
  it.each([
    [false, "smooth"],
    [true, "auto"],
  ])("focuses the field and scrolls its rendered warning (reduced motion: %s)", (reducedMotion, behavior) => {
    const field = { focus: vi.fn() };
    const warning = { scrollIntoView: vi.fn() };
    const elements = { field, warning };
    const requestAnimationFrame = vi.fn((callback) => callback());
    vi.stubGlobal("window", { requestAnimationFrame, matchMedia: () => ({ matches: reducedMotion }) });
    vi.stubGlobal("document", { getElementById: (id) => elements[id] });

    revealValidationTarget("warning", "field");

    expect(requestAnimationFrame).toHaveBeenCalledOnce();
    expect(field.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(warning.scrollIntoView).toHaveBeenCalledWith({ behavior, block: "center" });
  });

  it("does nothing until the warning is in the page", () => {
    const focus = vi.fn();
    vi.stubGlobal("window", { requestAnimationFrame: (callback) => callback() });
    vi.stubGlobal("document", { getElementById: (id) => id === "field" ? { focus } : null });

    revealValidationTarget("warning", "field");

    expect(focus).not.toHaveBeenCalled();
  });
});
