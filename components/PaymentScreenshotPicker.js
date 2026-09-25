"use client";
/* eslint-disable @next/next/no-img-element -- Preview is a local, revocable object URL. */

import { useEffect, useState } from "react";
import { CheckCircle2, ImagePlus, Trash2 } from "lucide-react";

export default function PaymentScreenshotPicker({ file, onChange, disabled, requiredError = "" }) {
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    const timer = window.setTimeout(() => setPreview(url), 0);
    return () => { window.clearTimeout(timer); URL.revokeObjectURL(url); };
  }, [file]);

  function acceptFile(candidate) {
    if (!candidate || disabled) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(candidate.type) || candidate.size > 5 * 1024 * 1024) { setError("Choose a JPG, PNG or WebP image up to 5 MB."); return; }
    setError("");
    onChange(candidate);
  }

  return <div>
    <p className="text-sm font-bold">Payment Screenshot</p>
    <label onDragEnter={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFile(event.dataTransfer.files?.[0]); }} className={`mt-2 flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-center transition-colors focus-within:outline-2 focus-within:outline-primary ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-primary/50 hover:bg-primary/5"} ${dragging ? "border-primary bg-primary/10" : "border-border bg-surface-muted/50"}`}>
      <ImagePlus className="size-6 text-primary" aria-hidden="true" />
      <span className="text-sm font-bold">{file ? "Replace screenshot" : "Choose a screenshot or drop it here"}</span>
      <span className="text-xs text-text-secondary">JPG, PNG or WebP · up to 5 MB</span>
      <input id="payment-screenshot" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => acceptFile(event.target.files?.[0])} disabled={disabled} className="sr-only" aria-label="Choose payment screenshot" aria-invalid={Boolean(requiredError || error)} aria-describedby={requiredError ? "payment-screenshot-error" : undefined} />
    </label>
    {requiredError && <p id="payment-screenshot-error" role="alert" className="mt-2 text-xs font-bold text-danger">{requiredError}</p>}
    {error && <p role="alert" className="mt-2 text-xs font-bold text-danger">{error}</p>}
    {file && <div className="ui-enter mt-3 flex items-center gap-3 rounded-xl border border-success/25 bg-success/5 p-3"><div className="size-16 shrink-0 overflow-hidden rounded-lg bg-white">{preview && <img src={preview} alt="Selected payment screenshot preview" className="size-full object-contain" />}</div><div className="min-w-0 flex-1"><p className="flex items-center gap-1 text-xs font-black text-success"><CheckCircle2 className="size-4" aria-hidden="true" /> Screenshot ready</p><p className="truncate text-xs text-text-secondary">{file.name}</p></div><button type="button" onClick={() => { onChange(null); setPreview(""); }} disabled={disabled} className="grid size-11 shrink-0 place-items-center rounded-lg text-text-secondary hover:bg-danger/10 hover:text-danger" aria-label="Remove screenshot"><Trash2 className="size-4" aria-hidden="true" /></button></div>}
  </div>;
}
