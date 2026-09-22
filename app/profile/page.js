import { auth } from "@/auth";
import ProfileForm from "@/components/ProfileForm";
import PageIntro from "@/components/PageIntro";

export const metadata = { title: "Profile | GharKaBite" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  return <><PageIntro eyebrow="Your account" title="Profile" description="Keep your contact details and delivery addresses ready for faster ordering." /><ProfileForm initialUser={session?.user || null} /></>;
}
