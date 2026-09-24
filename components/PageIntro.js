export default function PageIntro({ eyebrow, title, description, children }) {
  return (
    <section className="border-b border-border bg-surface py-8 md:py-12">
      <div className="container-shell flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1 className="mt-2 text-4xl font-black tracking-[-0.045em] md:text-5xl">{title}</h1>{description && <p className="mt-2 max-w-xl text-base leading-6 text-text-secondary md:text-lg md:leading-7">{description}</p>}</div>
        {children}
      </div>
    </section>
  );
}
