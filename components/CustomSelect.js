"use client";

import { Children, isValidElement, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export default function CustomSelect({ value, onChange, children, className = "", disabled = false, name, id, "aria-label": ariaLabel, ...rest }) {
  const options = Children.toArray(children)
    .filter((child) => isValidElement(child) && child.type === "option")
    .map((child) => ({ value: String(child.props.value ?? child.props.children), label: child.props.children, disabled: Boolean(child.props.disabled) }));
  const selectedIndex = options.findIndex((option) => option.value === String(value ?? ""));
  const selected = options[selectedIndex];
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    function closeOnScroll(event) {
      if (!listRef.current?.contains(event.target)) setOpen(false);
    }
    function closeOnResize() { setOpen(false); }
    document.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("resize", closeOnResize);
    return () => {
      document.removeEventListener("scroll", closeOnScroll, true);
      window.removeEventListener("resize", closeOnResize);
    };
  }, [open]);

  function nextEnabled(from, direction) {
    if (!options.some((option) => !option.disabled)) return -1;
    let index = from;
    do {
      index = (index + direction + options.length) % options.length;
    } while (options[index].disabled);
    return index;
  }

  function openMenu(index = selectedIndex) {
    if (disabled || options.length === 0) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = Math.min(rect.width, window.innerWidth - 16);
    const below = window.innerHeight - rect.bottom - 8;
    const above = rect.top - 8;
    const desiredHeight = Math.min(320, options.length * 48 + 8);
    const placeAbove = below < Math.min(desiredHeight, 192) && above > below;
    const maxHeight = Math.max(48, Math.min(320, placeAbove ? above : below));
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      top: placeAbove ? Math.max(8, rect.top - Math.min(desiredHeight, maxHeight) - 4) : rect.bottom + 4,
      width,
      maxHeight,
    });
    setActiveIndex(index >= 0 && !options[index]?.disabled ? index : nextEnabled(-1, 1));
    setOpen(true);
  }

  function choose(option) {
    if (option.disabled) return;
    setOpen(false);
    if (option.value !== String(value ?? "")) onChange?.({ target: { value: option.value } });
    triggerRef.current?.focus();
  }

  function handleKeyDown(event) {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      if (!open) openMenu(selectedIndex >= 0 ? nextEnabled(selectedIndex, direction) : nextEnabled(direction === 1 ? -1 : 0, direction));
      else setActiveIndex(nextEnabled(activeIndex, direction));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const index = event.key === "Home" ? nextEnabled(-1, 1) : nextEnabled(0, -1);
      if (!open) openMenu(index);
      else setActiveIndex(index);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open && options[activeIndex]) choose(options[activeIndex]);
      else openMenu();
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === "Tab" && open) {
      setOpen(false);
    } else if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey && event.key !== " ") {
      const match = options.findIndex((option) => !option.disabled && String(option.label).toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()));
      if (match >= 0) {
        event.preventDefault();
        if (!open) openMenu(match);
        else setActiveIndex(match);
      }
    }
  }

  return <>
    {name && <input type="hidden" name={name} value={String(value ?? "")} disabled={disabled} />}
    <button {...rest} id={id} ref={triggerRef} type="button" role="combobox" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} aria-activedescendant={open && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined} disabled={disabled} onClick={(event) => { if (event.detail === 0) return; open ? setOpen(false) : openMenu(); }} onKeyDown={handleKeyDown} className={`${className} flex items-center justify-between gap-3 text-left hover:border-primary/40 ${open ? "border-primary ring-4 ring-primary/10" : ""}`}>
      <span className="min-w-0 truncate">{selected?.label ?? "Select an option"}</span><ChevronDown className={`size-4 shrink-0 text-text-secondary transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
    </button>
    {open && position && createPortal(<>
      <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)} aria-hidden="true" />
      <div ref={listRef} id={listId} role="listbox" aria-label={ariaLabel} className="ui-enter fixed z-[101] overflow-y-auto overscroll-contain rounded-xl border border-border bg-white p-1 shadow-[0_16px_40px_rgba(31,42,35,0.18)]" style={position}>
        {options.map((option, index) => <div key={`${option.value}-${index}`} id={`${listId}-option-${index}`} role="option" aria-selected={index === selectedIndex} aria-disabled={option.disabled || undefined} onMouseEnter={() => { if (!option.disabled) setActiveIndex(index); }} onClick={() => choose(option)} className={`flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-bold ${option.disabled ? "cursor-not-allowed text-text-secondary/60" : index === activeIndex ? "cursor-pointer bg-primary/10 text-primary" : "cursor-pointer text-text-primary hover:bg-surface-muted"}`}><span className="min-w-0 break-words">{option.label}</span>{index === selectedIndex && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}</div>)}
      </div>
    </>, document.body)}
  </>;
}
