"use client";

import { useSession } from "next-auth/react";
import Button from "./Button";
import LoadingState from "./LoadingState";

export function MealSignIn({ returnTo }) {
  return <div className="card-surface p-5"><p className="mb-3">Sign in to continue with your saved meals.</p><Button href={`/welcome?mode=signin&returnTo=${encodeURIComponent(returnTo)}`}>Sign in</Button></div>;
}

export default function CustomerMealsAccess({ view: View, returnTo, ...props }) {
  const { data, status } = useSession();
  if (status === "loading") return <LoadingState label="Loading your meals" rows={2} />;
  if (status !== "authenticated" || !data?.user?.id) return <MealSignIn returnTo={returnTo} />;
  return <View key={data.user.id} userId={data.user.id} returnTo={returnTo} {...props} />;
}
