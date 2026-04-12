import { Suspense } from 'react';
import RegisterForm from './register-form';

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[100dvh]">
          Loading...
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
