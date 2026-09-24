import PreparationActions from "@/components/PreparationActions";
import { kolkataDate } from "@/lib/dates";
import { formatCutoffTime, isPastCutoff, defaultKitchenSettings } from "@/lib/kitchen-operations";
import { generatePreparationSummary } from "@/lib/preparation";
import dbConnect from "@/lib/dbConnect";
import KitchenSettings from "@/models/KitchenSettings";

export const dynamic = "force-dynamic";

function SummaryGroup({ title, entries, empty }) {
  return <section className="rounded-2xl border border-border bg-white p-5 print:break-inside-avoid print:border-0 print:p-0">
    <h2 className="text-lg font-black">{title}</h2>
    {entries.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2 print:grid-cols-2">{entries.map((entry) => <div key={`${entry.name}-${entry.unit}`} className="flex items-center justify-between gap-3 rounded-xl bg-surface-muted p-4 print:border print:border-gray-300 print:bg-white"><span className="font-bold">{entry.name}</span><span className="whitespace-nowrap text-xl font-black">{entry.quantity} <span className="text-xs font-bold">{entry.unit}</span></span></div>)}</div> : <p className="mt-3 text-sm text-text-secondary">{empty}</p>}
  </section>;
}

export default async function PreparationPage({ searchParams }) {
  const query = await searchParams;
  const today = kolkataDate();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(query?.date || "") && !Number.isNaN(Date.parse(query.date)) ? query.date : today;
  const mealPeriod = query?.period === "Dinner" ? "Dinner" : "Lunch";
  const [summary, settings] = await Promise.all([
    generatePreparationSummary({ date, mealPeriod }),
    (async () => { await dbConnect(); return await KitchenSettings.findOne({ key: "primary" }).lean() || defaultKitchenSettings; })(),
  ]);
  const cutoff = mealPeriod === "Lunch" ? settings.lunchCutoff : settings.dinnerCutoff;
  const closed = date < today || date === today && isPastCutoff(mealPeriod, settings);
  const formattedDate = new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "long" });

  return <div className="space-y-6" data-preparation-sheet>
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow print:hidden">Kitchen control</p><h1 className="mt-1 text-3xl font-black">Preparation sheet</h1><p className="mt-2 text-sm text-text-secondary">{mealPeriod} · {formattedDate} · Cutoff {formatCutoffTime(cutoff)}</p></div><PreparationActions /></header>
    <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-white p-4 print:hidden"><label className="text-sm font-bold">Date<input type="date" name="date" defaultValue={date} className="input-field mt-1" required /></label><label className="text-sm font-bold">Meal period<select name="period" defaultValue={mealPeriod} className="input-field mt-1"><option>Lunch</option><option>Dinner</option></select></label><button type="submit" className="min-h-12 rounded-xl border border-primary px-5 text-sm font-black text-primary hover:bg-primary/10">View preparation</button></form>
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 print:border print:border-gray-300 print:bg-white"><p className="text-xs font-black uppercase tracking-wide text-primary">{closed ? `${mealPeriod} orders closed · Final confirmed totals` : "Live confirmed totals · Updates automatically"}</p><p className="mt-2 text-4xl font-black">{summary.confirmedOrders} <span className="text-lg">confirmed orders</span></p><p className="mt-2 text-sm font-bold">{summary.totalThalis} Thalis · {summary.awaitingPaymentVerification} awaiting payment verification · {summary.cancelled} cancelled</p></div>
    <div className="grid gap-5 lg:grid-cols-2"><SummaryGroup title="Thalis" entries={summary.thalis} empty="No confirmed Thalis yet." /><SummaryGroup title="Single dishes" entries={summary.menuItems} empty="No confirmed single dishes yet." /><SummaryGroup title="Customer selections & included sides" entries={summary.selections} empty="No choices or sides to prepare yet." /><SummaryGroup title="Add-ons" entries={summary.addOns} empty="No add-ons to prepare yet." /></div>
    <section className="rounded-2xl border border-border bg-white p-5 print:break-inside-avoid print:border-0 print:p-0"><h2 className="text-lg font-black">Special instructions</h2>{summary.notes.length ? <ul className="mt-3 space-y-2">{summary.notes.map((note) => <li key={note.orderNumber} className="rounded-xl bg-surface-muted p-3 text-sm print:border print:border-gray-300 print:bg-white"><span className="font-black">{note.orderNumber}:</span> {note.text}</li>)}</ul> : <p className="mt-3 text-sm text-text-secondary">No special instructions.</p>}</section>
  </div>;
}
