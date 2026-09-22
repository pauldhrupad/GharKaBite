export default function SectionHeading({ eyebrow, title, description, align = "left" }) {
  const centered = align === "center";
  return (
    <div className={centered ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 className="mt-2 text-3xl font-black tracking-[-0.035em] text-text-primary md:text-4xl">{title}</h2>
      {description && <p className="mt-3 text-base leading-7 text-text-secondary">{description}</p>}
    </div>
  );
}
