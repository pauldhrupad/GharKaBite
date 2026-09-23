import KitchenSettingsForm from "@/components/KitchenSettingsForm";
import PromoCodesManager from "@/components/PromoCodesManager";
import PaymentSettingsForm from "@/components/PaymentSettingsForm";

export default function AdminSettingsPage() {
  return <><div><p className="eyebrow">Kitchen controls</p><h1 className="mt-1 text-3xl font-black">Settings</h1><p className="mt-1 text-sm text-text-secondary">Set daily capacity, ordering deadlines, delivery minimum, promo codes and payment details.</p></div><KitchenSettingsForm /><PromoCodesManager /><PaymentSettingsForm /></>;
}
