import PageIntro from "./PageIntro";

export default function PolicyPage({ title, summary, sections }) {
  return <><PageIntro eyebrow="GharKaBite policies" title={title} description={summary} /><article className="container-shell max-w-3xl py-10 md:py-14"><div className="card-surface p-6 md:p-9"><p className="text-xs font-extrabold uppercase tracking-wider text-text-secondary">Last updated: 22 September 2026</p><div className="mt-7 space-y-8">{sections.map((section) => <section key={section.title}><h2 className="text-xl font-black tracking-tight">{section.title}</h2><p className="mt-2 leading-7 text-text-secondary">{section.body}</p></section>)}</div><div className="mt-9 rounded-xl border border-warning/20 bg-warning/7 p-4 text-sm leading-6 text-text-secondary"><strong className="text-text-primary">Prototype notice:</strong> This policy text needs qualified legal review before commercial launch. Demo payments collect no money.</div></div></article></>;
}
