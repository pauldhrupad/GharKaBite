"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export default function AdminAvatar() {
  const [avatarUrl, setAvatarUrl] = useState("");
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/avatar", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (data?.avatarUrl) setAvatarUrl(data.avatarUrl); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  async function uploadPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    if (file.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("Choose a JPEG, PNG, or WebP photo under 2 MB.");
      return;
    }
    setUploading(true);
    setMessage("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/admin/avatar", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Upload failed.");
      setAvatarUrl(data.avatarUrl);
      setMessage("Profile photo saved.");
    } catch (error) {
      setMessage(error.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return <div className="relative shrink-0">
    <button type="button" onClick={() => setOpen((current) => !current)} aria-label="Owner profile" aria-expanded={open} aria-controls="admin-profile-photo-panel" className="grid size-10 place-items-center overflow-hidden rounded-full bg-primary text-xs font-black text-white ring-offset-2 hover:ring-2 hover:ring-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      {avatarUrl ? <Image src={avatarUrl} alt="" width={40} height={40} className="size-10 object-cover" onError={() => setAvatarUrl("")} /> : "GB"}
    </button>
    {open && <>
      <button type="button" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} aria-label="Close owner profile menu" />
      <div id="admin-profile-photo-panel" className="absolute right-0 top-12 z-50 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-border bg-white p-4 text-left shadow-xl">
        <p className="font-extrabold text-text-primary">Owner profile photo</p>
        <p className="mt-1 text-xs text-text-secondary">JPEG, PNG or WebP, up to 2 MB.</p>
        <label className={`mt-4 flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-white ${uploading ? "pointer-events-none opacity-60" : "hover:bg-primary/90"}`}>
          {uploading ? "Uploading…" : avatarUrl ? "Change photo" : "Add photo"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={uploadPhoto} disabled={uploading} aria-label="Choose owner profile photo" />
        </label>
        {message && <p className="mt-2 text-xs text-text-secondary" role="status">{message}</p>}
      </div>
    </>}
  </div>;
}
