"use client";

import Image from "next/image";
import Link from "next/link";
import { additionalMenuCategories, illustratedCategories } from "@/lib/menu-categories";

export default function FoodCategoryNav({ meals, selectedCategory, onSelect }) {
  return (
    <nav aria-label="Food categories" className="food-category-nav mt-6 min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-black text-primary">What are you craving?</p>
        <span className="text-xs font-bold text-text-secondary lg:hidden">Swipe to explore →</span>
      </div>
      <div className="food-category-row" onFocus={(event) => event.target.closest(".food-category-tile")?.scrollIntoView({ block: "nearest", inline: "nearest" })}>
        {illustratedCategories.map(({ value, label, image, href }) => {
          const content = <><span className="food-category-art"><Image src={`/images/categories/${image}`} alt="" width={600} height={600} sizes="(min-width: 1024px) 128px, (min-width: 640px) 112px, 96px" className="size-full object-contain" /></span><span className="food-category-label">{label}</span></>;
          return href ? (
            <Link key={value} href={href} className="food-category-tile">{content}</Link>
          ) : (
            <button key={value} type="button" onClick={() => onSelect(value)} aria-pressed={selectedCategory === value} className="food-category-tile">{content}</button>
          );
        })}
      </div>
      <div role="group" aria-label="All and additional menu categories" className="mt-3 flex flex-wrap gap-2">
        {["All", ...additionalMenuCategories(meals)].map((category) => (
          <button key={category} type="button" onClick={() => onSelect(category)} aria-pressed={selectedCategory === category} className="food-category-filter">{category === "All" ? "All meals" : category}</button>
        ))}
      </div>
      {selectedCategory === "Add-ons" && <p role="status" className="mt-3 text-sm text-text-secondary">Choose a Thali below, then select <strong>Customize</strong> to add your extras.</p>}
    </nav>
  );
}
