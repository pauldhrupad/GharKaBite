"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import ThaliOrderDetails from "./ThaliOrderDetails";
import { thaliPreviewImage } from "@/lib/thali-builder";
import { mealDetailHref } from "@/lib/meal-period";
import { formatINR } from "@/lib/cart-pricing";

export default function CartItemSummary({ item, review, onQuantity, onRemove }) {
  const image = thaliPreviewImage(review?.meal || { id: item.mealId, image: item.image });
  const [failedImage, setFailedImage] = useState("");
  const editable = Boolean(onQuantity);
  const Heading = editable ? "h2" : "h3";
  return <article className={`cart-item ${editable ? "card-surface" : "cart-item--review"}`}>
    <div className="cart-item-heading"><div className="cart-item-image">{image.src && failedImage !== image.src ? <Image src={image.src} alt="" fill sizes="(min-width: 1024px) 88px, 72px" className={image.illustration ? "object-contain" : "object-cover"} onError={() => setFailedImage(image.src)} /> : <span>GharKaBite<br />{item.kind === "dish" ? "Homemade dish" : "Homemade Thali"}</span>}</div><div className="cart-item-title"><Heading>{item.name}</Heading><p>{editable ? `${formatINR(item.price)} each` : `${item.quantity} × ${formatINR(item.price)}`}</p><strong>{formatINR(item.price * item.quantity)}</strong></div>{onRemove && <button type="button" className="cart-remove" aria-label={`Remove ${item.name}`} onClick={() => onRemove(item)}><Trash2 size={18} aria-hidden="true" /></button>}</div>
    <details className="cart-selections" open><summary>Meal selections & extras</summary><ThaliOrderDetails item={{ ...item, selectedChoices: item.choiceSummary || [], selectedAddOns: item.addOnSummary || [] }} /></details>
    {review?.issues.map((issue) => <p key={issue} className="checkout-notice checkout-notice--error">{issue}</p>)}
    {review?.priceChanged && <p className="checkout-notice">Price changed from {formatINR(item.price)} to {formatINR(review.price.unitTotal)} each. Edit this meal to review and accept the updated price.</p>}
    {editable && <div className="cart-item-actions"><div className="cart-quantity" role="group" aria-label={`${item.name} quantity`}><button type="button" onClick={() => onQuantity(item.key, item.quantity - 1)} disabled={item.quantity <= 1} aria-label={`Decrease ${item.name} quantity`}><Minus size={16} aria-hidden="true" /></button><output aria-live="polite">{item.quantity}</output><button type="button" onClick={() => onQuantity(item.key, item.quantity + 1)} disabled={item.quantity >= 10} aria-label={`Increase ${item.name} quantity`}><Plus size={16} aria-hidden="true" /></button></div>{(!review || review.meal) && <Link href={`${mealDetailHref(item.mealId, item.serviceDate, item.deliveryMealPeriod)}&edit=${encodeURIComponent(item.key)}`} className="checkout-text-action">Edit meal</Link>}</div>}
  </article>;
}
