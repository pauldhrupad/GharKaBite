export const orderStatuses = [
  { value: "received", label: "Order Received" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cooking", label: "Cooking" },
  { value: "packed", label: "Packed" },
  { value: "out_for_delivery", label: "Out for Delivery" },
  { value: "delivered", label: "Delivered" },
];

export const adminStatusOptions = [
  ...orderStatuses,
  { value: "cancelled", label: "Cancelled" },
];
