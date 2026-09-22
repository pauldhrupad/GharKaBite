export default function PageIntro({ eyebrow, title, description, children }) {
  return (
    <section className="border-b border-border bg-[linear-gradient(180deg,#fffdf8_0%,#fbf8f1_100%)] py-12 md:py-16">
      <div className="container-shell flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1 className="mt-2 text-4xl font-black tracking-[-0.045em] md:text-5xl">{title}</h1>{description && <p className="mt-4 max-w-xl text-base leading-7 text-text-secondary md:text-lg">{description}</p>}</div>
        {children}
      </div>
    </section>
  );
}
