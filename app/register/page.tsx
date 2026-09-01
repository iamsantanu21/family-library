import RegisterForm from "@/components/RegisterForm";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  // Single source of truth: the invite field only appears (and is enforced)
  // when FAMILY_INVITE_CODE is actually set. Remove that env var → open sign-up
  // (new members still wait for admin approval).
  const inviteRequired = !!(process.env.FAMILY_INVITE_CODE || "").trim();
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true";

  return (
    <RegisterForm googleEnabled={googleEnabled} inviteRequired={inviteRequired} />
  );
}
