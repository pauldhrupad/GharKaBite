import LoadingState from "@/components/LoadingState";

export default function ThaliLoading() {
  return <div className="container-shell py-6"><p className="type-page-title text-3xl">Preparing your meal builder</p><LoadingState label="Loading meal and choices" rows={2} /></div>;
}
