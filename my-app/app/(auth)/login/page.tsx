"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { toast } from "react-toastify";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

const EMAIL_SAFE_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const sanitizeInput = (val: string) => val.replace(/[<>]/g, "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const cleanEmail = email.trim();
    const cleanPassword = password;

    // Basic validation
    if (!email || !password) {
      toast.error("Email and password are required");
      setIsLoading(false);
      return;
    }

    if (!EMAIL_SAFE_REGEX.test(cleanEmail)) {
      toast.error("Please enter a valid email address");
      setIsLoading(false);
      return;
    }

    if (cleanEmail.length > 254 || cleanPassword.length > 128) {
      toast.error("Input exceeds maximum allowed length");
      setIsLoading(false);
      return;
    }

    if (cleanPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      setIsLoading(false);
      return;
    }

    const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
    const result = await signIn("credentials", {
      email: cleanEmail,
      password: cleanPassword,
      redirect: false,
      callbackUrl,
    });

    setIsLoading(false);

    if (!result || result.error) {
      // Always show the same message to avoid account enumeration leaks.
      toast.error("Invalid email or password");
      return;
    }

    router.push(result.url ?? callbackUrl);
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-linear-to-br text-black from-slate-50 to-slate-100 flex items-center justify-center px-4">
      {/* --- RETURN BUTTON --- */}
      <div className="absolute top-8 left-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors font-medium group"
        >
          <Image
            src="/BookPNG.png"
            alt="CourseHub"
            width={40}
            height={40}
            className="w-10 h-10 rounded-lg object-contain"
            priority
          />
        </Link>
      </div>
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center mb-6 mx-auto">
            <Image
              src="/BookPNG.png"
              alt="CourseHub"
              width={64}
              height={64}
              className="w-16 h-16 rounded-xl object-contain"
              priority
            />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">CourseHub</h1>
          <p className="text-slate-600">Sign in to your account</p>
        </div>

        {/* Login Form Card */}
        <div className="bg-white rounded-xl shadow-lg p-8 border border-slate-200">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Input */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-slate-900 mb-2"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(sanitizeInput(e.target.value))}
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
                disabled={isLoading}
              />
            </div>

            {/* Password Input */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-slate-900 mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
                disabled={isLoading}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 cursor-pointer bg-black text-white font-semibold rounded-lg hover:bg-slate-200 hover:text-black transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-slate-600 mt-8">
          © 2026 CourseHub. All rights reserved.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100" />}>
      <LoginForm />
    </Suspense>
  );
}
