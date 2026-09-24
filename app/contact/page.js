import { Clock3, Mail, MapPin } from "lucide-react";
import PageIntro from "@/components/PageIntro";

export const metadata = { title: "Contact | GharKaBite" };
export default function ContactPage() {
  const email = process.env.CONTACT_EMAIL;
  return <><PageIntro eyebrow="We are close by" title="Contact the kitchen" description="Questions about meals, plans or delivery? Reach out before placing an order." /><section className="container-shell grid gap-4 py-8 md:grid-cols-2 md:py-10 lg:grid-cols-3"><article className="card-surface p-5"><Mail className="size-6 text-primary" /><h2 className="mt-4 font-black">Email</h2>{email ? <a href={`mailto:${email}`} className="mt-2 block break-all text-sm text-primary underline">{email}</a> : <p className="mt-2 text-sm text-text-secondary">A contact address will be published before launch.</p>}</article><article className="card-surface p-5"><MapPin className="size-6 text-primary" /><h2 className="mt-4 font-black">Delivery area</h2><p className="mt-2 text-sm text-text-secondary">Verified addresses within 5 km of the kitchen. The residential address is private.</p></article><article className="card-surface p-5"><Clock3 className="size-6 text-primary" /><h2 className="mt-4 font-black">Meal windows</h2><p className="mt-2 text-sm text-text-secondary">Lunch and dinner, subject to the daily menu and order cutoff.</p></article></section><p className="container-shell pb-8 text-sm text-text-secondary">This is a prototype. Legal and contact information must be reviewed before commercial launch.</p></>;
}
