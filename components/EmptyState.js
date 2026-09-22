import { ShoppingBag } from "lucide-react";
import Button from "./Button";

export default function EmptyState({ title, description, actionLabel = "Browse today's menu", href = "/menu" }) {
  return (
    <div className="card-surface mx-auto max-w-xl px-6 py-14 text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><ShoppingBag className="size-7" aria-hidden="true" /></div>
      <h2 className="mt-5 text-2xl font-black tracking-tight">{title}</h2>
      <p className="mx-auto mt-2 max-w-md leading-7 text-text-secondary">{description}</p>
      <Button href={href} className="mt-6">{actionLabel}</Button>
    </div>
  );
}
