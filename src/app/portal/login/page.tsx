import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function PortalLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
