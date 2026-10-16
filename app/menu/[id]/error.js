"use client";

import Button from "@/components/Button";

export default function ThaliError({ reset }) {
  return <section className="container-shell py-10" role="alert"><h1 className="type-page-title text-3xl">This meal couldn’t be loaded</h1><p className="my-4">The menu is temporarily unavailable. Please try again.</p><div className="flex flex-wrap gap-3"><Button type="button" onClick={reset}>Try again</Button><Button href="/menu" variant="secondary">Back to menu</Button></div></section>;
}
