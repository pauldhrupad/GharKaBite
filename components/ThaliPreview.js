"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Check, UtensilsCrossed } from "lucide-react";
import { thaliPreviewImage } from "@/lib/thali-builder";

export default function ThaliPreview({ meal, choices, addOns, quantity }) {
  const { src, illustration } = thaliPreviewImage(meal);
  const [failedSrc, setFailedSrc] = useState("");
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const update = () => setExpanded(desktop.matches);
    const timer = window.setTimeout(update, 0);
    desktop.addEventListener("change", update);
    return () => { window.clearTimeout(timer); desktop.removeEventListener("change", update); };
  }, []);
  const selectedNames = meal.choiceGroups.flatMap((group) => (Array.isArray(choices[group.id]) ? choices[group.id] : []).map((id) => group.options.find((option) => option.id === id)?.name).filter(Boolean));
  const extraNames = meal.addOns.filter((extra) => Number(addOns[extra.id]) > 0).map((extra) => `${extra.name} ×${addOns[extra.id]}`);
  const hasImage = src && failedSrc !== src;
  return <aside className="thali-preview" aria-label="Your meal preview">
    <div className={`thali-preview-image ${illustration ? "is-illustration" : ""}`}>
      {hasImage ? <Image src={src} alt={`${illustration ? "Illustration" : "Illustrative photograph"} of ${meal.name}`} fill loading="eager" fetchPriority="high" sizes="(min-width: 1024px) 450px, (min-width: 640px) 180px, 116px" onError={() => setFailedSrc(src)} className={illustration ? "object-contain" : "object-cover"} /> : <div className="thali-image-fallback"><UtensilsCrossed aria-hidden="true" /><span>Your meal, your way</span></div>}
      <span className="thali-image-caption">{hasImage ? "Illustrative image" : "Image unavailable"}</span>
    </div>
    <div className="thali-preview-content">
      <p className="thali-kicker">Made yours</p>
      <h2 className="type-card-title">Your {meal.kind === "dish" ? "dish" : "Thali"}</h2>
      <p className="thali-preview-hint">Your selections below describe your meal.</p>
      <p className="thali-compact-summary">{[...selectedNames, ...extraNames].join(" · ") || (meal.choiceGroups.some((group) => group.minSelections > 0 || group.required) ? "Choose your meal below" : "Included items are ready")}</p>
      <details className="thali-included" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}><summary>Review your meal <span>{meal.fixedItems.length} included items</span></summary>
      <ul className="thali-selection-summary">
        {meal.choiceGroups.map((group) => {
          const selected = (Array.isArray(choices[group.id]) ? choices[group.id] : []).map((id) => group.options.find((option) => option.id === id)).filter(Boolean);
          return <li key={group.id}><span>{group.name}</span><strong>{selected.map((option) => `${option.name}${option.active === false ? " (unavailable)" : ""}`).join(", ") || (group.minSelections > 0 || group.required ? "Choose an option" : "None selected")}</strong></li>;
        })}
        {meal.addOns.filter((extra) => Number(addOns[extra.id]) > 0).map((extra) => <li key={extra.id}><span>Extra</span><strong>{extra.name} ×{addOns[extra.id]}</strong></li>)}
      </ul>
      <p className="thali-kicker">Included</p><ul>{meal.fixedItems.map((item, index) => <li key={`${item.name}-${index}`}><Check aria-hidden="true" /><span>{item.name}{item.description && <small>{item.description}</small>}</span></li>)}</ul><p>{meal.description}</p></details>
      <p className="thali-preview-quantity">{quantity} × {meal.name}</p>
    </div>
  </aside>;
}
