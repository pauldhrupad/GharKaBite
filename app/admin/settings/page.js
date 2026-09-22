import KitchenSettingsForm from "@/components/KitchenSettingsForm";

export default function AdminSettingsPage() {
  return <><div><p className="eyebrow">Kitchen controls</p><h1 className="mt-1 text-3xl font-black">Capacity & cutoffs</h1><p className="mt-1 text-sm text-text-secondary">Set realistic daily limits and ordering deadlines.</p></div><KitchenSettingsForm /></>;
}
