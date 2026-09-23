export default function ThaliOrderDetails({ item }) {
  const groups = item.selectedChoices || [];
  const addOns = item.selectedAddOns || [];
  const fixed = item.fixedItems || [];
  if (!groups.length && !addOns.length && !fixed.length) return null;
  return <div className="mt-2 space-y-1 text-xs leading-5 text-text-secondary">
    {fixed.length > 0 && <p><span className="font-bold">Included:</span> {fixed.map((entry) => entry.name).join(", ")}</p>}
    {groups.map((group) => group.options?.length ? <p key={group.groupId}><span className="font-bold">{group.groupName}:</span> {group.options.map((option) => `${option.name}${option.priceAdjustment ? ` (+₹${option.priceAdjustment})` : ""}`).join(", ")}</p> : null)}
    {addOns.length > 0 && <p><span className="font-bold">Extras per Thali:</span> {addOns.map((entry) => `${entry.name} ×${entry.quantity} (+₹${entry.price * entry.quantity})`).join(", ")}</p>}
    {item.basePrice > 0 && <p>Base ₹{item.basePrice} · Unit total ₹{item.price}</p>}
  </div>;
}
