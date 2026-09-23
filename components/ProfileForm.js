"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { LayoutDashboard, LogOut, MapPin, Plus, Save, Trash2, UserRound } from "lucide-react";
import Button from "./Button";
import LocationPicker from "./LocationPicker";

const emptyAddress = { label: "Home", house: "", street: "", area: "", landmark: "", city: "Kolkata", pinCode: "" };

export default function ProfileForm({ initialUser }) {
  const [profile, setProfile] = useState({ name: initialUser?.name || "", email: initialUser?.email || "", phone: initialUser?.phone || "", addresses: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/profile").then(async (response) => {
      if (response.ok && active) setProfile(await response.json().then((data) => ({ ...data.user, addresses: data.user.addresses || [] })));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function updateProfile(event) {
    setProfile((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function updateAddress(index, event) {
    const { name, value } = event.target;
    setProfile((current) => ({ ...current, addresses: current.addresses.map((address, addressIndex) => addressIndex === index ? { ...address, [name]: value, ...(["street", "area", "city", "pinCode"].includes(name) ? { location: undefined } : {}) } : address) }));
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

  async function saveProfile(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!/^[6-9]\d{9}$/.test(String(profile.phone).replace(/\D/g, ""))) { setError("Enter a valid 10-digit Indian mobile number."); return; }
    if (profile.addresses.some((address) => !address.house || !address.street || !address.area || !/^\d{6}$/.test(address.pinCode))) { setError("Complete all required address fields and enter a valid PIN code."); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
      const data = await response.json();
      if (!response.ok) { setError(data.message || "Unable to save your profile."); return; }
      setProfile((current) => ({ ...current, ...data.user }));
      setMessage("Profile and saved addresses updated.");
    } catch {
      setError("Profile update is temporarily unavailable.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <section className="container-shell py-10"><div className="h-72 animate-pulse rounded-2xl bg-surface-muted" /></section>;

  return (
    <form onSubmit={saveProfile} className="container-shell grid gap-6 py-10 lg:grid-cols-[20rem_1fr] lg:items-start">
      <aside className="card-surface p-5 lg:sticky lg:top-24"><span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><UserRound className="size-7" aria-hidden="true" /></span><h2 className="mt-4 text-xl font-black">{profile.name || "Your profile"}</h2><p className="mt-1 text-sm text-text-secondary">{profile.email}</p>{initialUser?.role === "admin" && <Link href="/admin/dashboard" className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-white hover:bg-primary-hover"><LayoutDashboard className="size-4" aria-hidden="true" /> Open admin dashboard</Link>}<div className="mt-5 border-t border-border pt-5"><button type="button" onClick={() => signOut({ callbackUrl: "/" })} className="inline-flex min-h-10 items-center gap-2 text-sm font-black text-danger"><LogOut className="size-4" aria-hidden="true" /> Sign out</button></div></aside>

      <div className="space-y-6">
        <section className="card-surface p-5 md:p-7"><h2 className="flex items-center gap-2 text-xl font-black"><UserRound className="size-5 text-primary" aria-hidden="true" /> Account details</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Name<input className="input-field mt-2" name="name" type="text" value={profile.name} onChange={updateProfile} autoComplete="name" placeholder="e.g. Ananya Sen" required /></label><label className="text-sm font-bold">Phone<input className="input-field mt-2" name="phone" type="tel" value={profile.phone || ""} onChange={updateProfile} autoComplete="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} placeholder="e.g. 9876543210" required /></label><label className="text-sm font-bold sm:col-span-2">Email<input className="input-field mt-2" type="email" value={profile.email || ""} autoComplete="email" readOnly aria-describedby="email-note" /></label></div><p id="email-note" className="mt-2 text-xs text-text-secondary">Email changes are disabled to protect your login identity.</p></section>

        <section className="card-surface p-5 md:p-7"><div className="flex items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-black"><MapPin className="size-5 text-primary" aria-hidden="true" /> Saved addresses</h2><p className="mt-1 text-sm text-text-secondary">Save up to five local delivery locations.</p></div><button type="button" onClick={addAddress} disabled={profile.addresses.length >= 5} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-black text-primary disabled:opacity-40"><Plus className="size-4" aria-hidden="true" /> Add</button></div>
          {profile.addresses.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-border bg-surface-muted p-6 text-center text-sm text-text-secondary">No saved addresses yet.</div> : <div className="mt-5 space-y-4">{profile.addresses.map((address, index) => <fieldset key={address._id || index} className="rounded-xl border border-border p-4"><legend className="px-2 text-sm font-black">Address {index + 1}</legend><div className="mb-4"><LocationPicker location={address.location} onSelect={(choice) => chooseAddressLocation(index, choice)} /><p className="mt-2 text-xs text-text-secondary">Check the filled details, add your house or flat, then save your profile.</p></div><div className="grid gap-3 sm:grid-cols-2"><AddressInput label="Label" name="label" value={address.label || "Home"} onChange={(event) => updateAddress(index, event)} placeholder="e.g. Home or Work" /><AddressInput label="House / flat" name="house" value={address.house || ""} onChange={(event) => updateAddress(index, event)} autoComplete="address-line1" placeholder="e.g. Flat 3B" /><AddressInput label="Street" name="street" value={address.street || ""} onChange={(event) => updateAddress(index, event)} autoComplete="address-line2" placeholder="e.g. 21 Lake Road" /><AddressInput label="Area" name="area" value={address.area || ""} onChange={(event) => updateAddress(index, event)} autoComplete="address-level3" placeholder="e.g. Ballygunge" /><AddressInput label="Landmark" name="landmark" value={address.landmark || ""} onChange={(event) => updateAddress(index, event)} placeholder="e.g. Near the post office" optional /><AddressInput label="City" name="city" value={address.city || "Kolkata"} onChange={(event) => updateAddress(index, event)} autoComplete="address-level2" placeholder="e.g. Kolkata" /><AddressInput label="PIN code" name="pinCode" value={address.pinCode || ""} onChange={(event) => updateAddress(index, event)} autoComplete="postal-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="e.g. 700029" /></div><button type="button" onClick={() => removeAddress(index)} className="mt-3 inline-flex min-h-9 items-center gap-2 text-xs font-black text-danger"><Trash2 className="size-3.5" aria-hidden="true" /> Remove address</button></fieldset>)}</div>}
        </section>

        {(message || error) && <p className={`rounded-xl p-4 text-sm font-bold ${error ? "bg-danger/8 text-danger" : "bg-success/10 text-success"}`} role="status">{error || message}</p>}
        <Button type="submit" disabled={saving} className="w-full sm:w-auto disabled:opacity-55"><Save className="size-4" aria-hidden="true" /> {saving ? "Saving…" : "Save profile"}</Button>
      </div>
    </form>
  );
}

function AddressInput({ label, optional, ...props }) {
  return <label className="text-xs font-bold">{label} {optional && <span className="font-normal text-text-secondary">(optional)</span>}<input type="text" className="input-field mt-1.5" {...props} /></label>;
}
