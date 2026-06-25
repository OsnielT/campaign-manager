import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <SignIn
      routing="hash"
      signUpUrl="/signup"
      fallbackRedirectUrl="/dashboard"
    />
  );
}
