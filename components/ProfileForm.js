"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { Camera, LayoutDashboard, LogOut, MapPin, Plus, Save, Trash2, UserRound } from "lucide-react";
import Button from "./Button";
import LocationPicker from "./LocationPicker";
import { revealValidationTarget } from "@/lib/validation-navigation";

const emptyAddress = { label: "Home", house: "", street: "", area: "", landmark: "", city: "Kolkata", pinCode: "" };

export default function ProfileForm({ initialUser }) {
  const [profile, setProfile] = useState({ name: initialUser?.name || "", email: initialUser?.email || "", phone: initialUser?.phone || "", avatarUrl: "", addresses: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    let active = true;
    fetch("/api/profile").then(async (response) => {
      if (!response.ok) throw new Error("Unable to load your profile right now.");
      const data = await response.json();
      if (active) setProfile({ ...data.user, addresses: data.user.addresses || [] });
    }).catch(() => { if (active) setError("Unable to load your profile right now."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function updateProfile(event) {
    setProfile((current) => ({ ...current, [event.target.name]: event.target.value }));
    setFieldErrors((current) => ({ ...current, [event.target.name]: "" }));
  }

  function updateAddress(index, event) {
    const { name, value } = event.target;
    setProfile((current) => ({ ...current, addresses: current.addresses.map((address, addressIndex) => addressIndex === index ? { ...address, [name]: value, ...(["street", "area", "city", "pinCode"].includes(name) ? { location: undefined } : {}) } : address) }));
    setFieldErrors((current) => ({ ...current, [`address-${index}-${name}`]: "" }));
  }

  function chooseAddressLocation(index, choice) {
    setProfile((current) => ({ ...current, addresses: current.addresses.map((address, addressIndex) => addressIndex === index ? { ...address, ...choice.address, location: choice.location } : address) }));
    setError("");
  }

  function addAddress() {
    setProfile((current) => ({ ...current, addresses: current.addresses.length >= 5 ? current.addresses : [...current.addresses, { ...emptyAddress }] }));
  }

  function removeAddress(index) {
    setProfile((current) => ({ ...current, addresses: current.addresses.filter((_, addressIndex) => addressIndex !== index) }));
  }

  async function uploadPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage(""); setError("");
    if (file.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPEG, PNG or WebP photo under 2 MB."); return;
    }
    setUploadingPhoto(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/profile/avatar", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Profile photo upload failed.");
      setProfile((current) => ({ ...current, avatarUrl: data.avatarUrl }));
      setMessage("Profile photo saved.");
    } catch (cause) {
      setError(cause.message || "Profile photo upload failed.");
    } finally { setUploadingPhoto(false); }
  }

  async function saveProfile(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    const nextErrors = {};
    if (profile.name.trim().length < 2) nextErrors.name = "Enter your full name.";
    if (!/^[6-9]\d{9}$/.test(String(profile.phone).replace(/\D/g, ""))) nextErrors.phone = "Enter a valid 10-digit Indian mobile number.";
    profile.addresses.forEach((address, index) => {
      for (const field of ["house", "street", "area"]) if (!address[field]?.trim()) nextErrors[`address-${index}-${field}`] = "This field is required.";
      if (!/^\d{6}$/.test(address.pinCode)) nextErrors[`address-${index}-pinCode`] = "Enter a valid 6-digit PIN code.";
    });
    setFieldErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) { revealValidationTarget(`profile-${firstError}-error`, `profile-${firstError}`); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
      const data = await response.json();
      if (!response.ok) { setError(data.message || "Unable to save your profile."); revealValidationTarget("profile-form-error"); return; }
      setProfile((current) => ({ ...current, ...data.user }));
      setMessage("Profile and saved addresses updated.");
    } catch {
      setError("Profile update is temporarily unavailable.");
      revealValidationTarget("profile-form-error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <section className="container-shell py-10"><div className="h-72 animate-pulse rounded-2xl bg-surface-muted" /></section>;

  return (
    <form onSubmit={saveProfile} noValidate className="container-shell grid gap-5 py-8 md:py-10 lg:grid-cols-[20rem_1fr] lg:items-start">
      <aside className="card-surface p-5 lg:sticky lg:top-24"><div className="flex items-center gap-4"><span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary/10 text-primary">{profile.avatarUrl ? <Image src={profile.avatarUrl} alt={`${profile.name || "Your"} profile photo`} width={64} height={64} className="size-full object-cover" unoptimized onError={() => setProfile((current) => ({ ...current, avatarUrl: "" }))} /> : <UserRound className="size-7" aria-hidden="true" />}</span><label className={`inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-bold text-primary focus-within:outline-2 focus-within:outline-primary ${uploadingPhoto ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-primary hover:bg-primary/5"}`}><Camera className="size-4" aria-hidden="true" />{uploadingPhoto ? "Uploading…" : profile.avatarUrl ? "Change photo" : "Add photo"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} disabled={uploadingPhoto} className="sr-only" aria-label="Choose profile photo" /></label></div><p className="mt-2 text-xs text-text-secondary">JPG, PNG or WebP · under 2 MB</p><h2 className="mt-4 text-xl font-black">{profile.name || "Your profile"}</h2><p className="mt-1 text-sm text-text-secondary">{profile.email}</p>{initialUser?.role === "admin" && <Link href="/admin/dashboard" className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-white hover:bg-primary-hover"><LayoutDashboard className="size-4" aria-hidden="true" /> Open admin dashboard</Link>}<div className="mt-5 border-t border-border pt-5"><button type="button" onClick={() => signOut({ callbackUrl: "/" })} className="inline-flex min-h-10 items-center gap-2 text-sm font-black text-danger"><LogOut className="size-4" aria-hidden="true" /> Sign out</button></div></aside>

      <div className="space-y-4">
        <section className="card-surface p-5 md:p-7"><h2 className="flex items-center gap-2 text-xl font-black"><UserRound className="size-5 text-primary" aria-hidden="true" /> Account details</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Name<input id="profile-name" className="input-field mt-2" name="name" type="text" value={profile.name} onChange={updateProfile} autoComplete="name" placeholder="e.g. Ananya Sen" aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "profile-name-error" : undefined} required />{fieldErrors.name && <span id="profile-name-error" className="mt-1 block text-xs text-danger">{fieldErrors.name}</span>}</label><label className="text-sm font-bold">Phone<input id="profile-phone" className="input-field mt-2" name="phone" type="tel" value={profile.phone || ""} onChange={updateProfile} autoComplete="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} placeholder="e.g. 9876543210" aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? "profile-phone-error" : undefined} required />{fieldErrors.phone && <span id="profile-phone-error" className="mt-1 block text-xs text-danger">{fieldErrors.phone}</span>}</label><label className="text-sm font-bold sm:col-span-2">Email<input className="input-field mt-2" type="email" value={profile.email || ""} autoComplete="email" readOnly aria-describedby="email-note" /></label></div><p id="email-note" className="mt-2 text-xs text-text-secondary">Email changes are disabled to protect your login identity.</p></section>

        <section className="card-surface p-5 md:p-7"><div className="flex items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-black"><MapPin className="size-5 text-primary" aria-hidden="true" /> Saved addresses</h2><p className="mt-1 text-sm text-text-secondary">Save up to five local delivery locations.</p></div><button type="button" onClick={addAddress} disabled={profile.addresses.length >= 5} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-black text-primary disabled:opacity-40"><Plus className="size-4" aria-hidden="true" /> Add</button></div>
          {profile.addresses.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-border bg-surface-muted p-6 text-center text-sm text-text-secondary">No saved addresses yet.</div> : <div className="mt-5 space-y-4">{profile.addresses.map((address, index) => <fieldset key={address._id || index} className="rounded-xl border border-border bg-surface-alt/35 p-4"><legend className="px-2 text-sm font-black">Address {index + 1}</legend><div className="mb-4"><LocationPicker compactTrigger location={address.location} onSelect={(choice) => chooseAddressLocation(index, choice)} /></div><div className="grid gap-3 sm:grid-cols-2"><AddressInput label="Label" name="label" value={address.label || "Home"} onChange={(event) => updateAddress(index, event)} placeholder="e.g. Home or Work" /><AddressInput label="House / flat" name="house" value={address.house || ""} onChange={(event) => updateAddress(index, event)} autoComplete="address-line1" placeholder="e.g. Flat 3B" id={`profile-address-${index}-house`} error={fieldErrors[`address-${index}-house`]} /><AddressInput label="Street" name="street" value={address.street || ""} onChange={(event) => updateAddress(index, event)} autoComplete="address-line2" placeholder="e.g. 21 Lake Road" id={`profile-address-${index}-street`} error={fieldErrors[`address-${index}-street`]} /><AddressInput label="Area" name="area" value={address.area || ""} onChange={(event) => updateAddress(index, event)} autoComplete="address-level3" placeholder="e.g. Ballygunge" id={`profile-address-${index}-area`} error={fieldErrors[`address-${index}-area`]} /><AddressInput label="Landmark" name="landmark" value={address.landmark || ""} onChange={(event) => updateAddress(index, event)} placeholder="e.g. Near the post office" optional /><AddressInput label="City" name="city" value={address.city || "Kolkata"} onChange={(event) => updateAddress(index, event)} autoComplete="address-level2" placeholder="e.g. Kolkata" /><AddressInput label="PIN code" name="pinCode" value={address.pinCode || ""} onChange={(event) => updateAddress(index, event)} autoComplete="postal-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="e.g. 700029" id={`profile-address-${index}-pinCode`} error={fieldErrors[`address-${index}-pinCode`]} /></div><button type="button" onClick={() => removeAddress(index)} className="mt-3 inline-flex min-h-9 items-center gap-2 text-xs font-black text-danger"><Trash2 className="size-3.5" aria-hidden="true" /> Remove address</button></fieldset>)}</div>}
        </section>

        {(message || error) && <p id="profile-form-error" tabIndex={error ? -1 : undefined} className={`rounded-xl p-4 text-sm font-bold ${error ? "bg-danger/8 text-danger" : "bg-success/10 text-success"}`} role={error ? "alert" : "status"}>{error || message}</p>}
        <Button type="submit" disabled={saving} className="w-full sm:w-auto disabled:opacity-55"><Save className="size-4" aria-hidden="true" /> {saving ? "Saving…" : "Save profile"}</Button>
      </div>
    </form>
  );
}

function AddressInput({ label, optional, error, id, ...props }) {
  return <label className="text-xs font-bold">{label} {optional && <span className="font-normal text-text-secondary">(optional)</span>}<input id={id} type="text" className="input-field mt-1.5" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} {...props} />{error && <span id={`${id}-error`} className="mt-1 block text-xs text-danger">{error}</span>}</label>;
}
