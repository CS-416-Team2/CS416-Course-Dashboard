"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "react-toastify";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

const EMAIL_SAFE_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const sanitizeInput = (val: string) => val.replace(/[<>]/g, "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const cleanEmail = email.trim();
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();

    if (!cleanFirst || !cleanLast) {
      toast.error("First and last name are required");
      setIsLoading(false);
      return;
    }

    if (!cleanEmail || !password) {
      toast.error("Email and password are required");
      setIsLoading(false);
      return;
    }

    if (!EMAIL_SAFE_REGEX.test(cleanEmail)) {
      toast.error("Please enter a valid email address");
      setIsLoading(false);
      return;
    }

    if (cleanEmail.length > 254 || password.length > 128) {
      toast.error("Input exceeds maximum allowed length");
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          firstName: cleanFirst,
          lastName: cleanLast,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Registration failed");
        setIsLoading(false);
        return;
      }

      toast.success("Account created! Signing you in...");

      const signInResult = await signIn("credentials", {
        email: cleanEmail,
        password,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (!signInResult || signInResult.error) {
        toast.info("Account created. Please sign in.");
        router.push("/login");
      } else {
        router.push(signInResult.url ?? "/dashboard");
        router.refresh();
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
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
          <p className="text-slate-600">Create your instructor account</p>
        </div>

        {/* Registration Form Card */}
        <div className="bg-white rounded-xl shadow-lg p-8 border border-slate-200">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-sm font-semibold text-slate-900 mb-2"
                >
                  First Name
                </label>
                <input
                  id="firstName"
                  type="text"
                  required
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(sanitizeInput(e.target.value))}
                  placeholder="Jane"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
                  disabled={isLoading}
                />
              </div>
              <div>
                <label
                  htmlFor="lastName"
                  className="block text-sm font-semibold text-slate-900 mb-2"
                >
                  Last Name
                </label>
                <input
                  id="lastName"
                  type="text"
                  required
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(sanitizeInput(e.target.value))}
                  placeholder="Doe"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Email */}
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

            {/* Password */}
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
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
                disabled={isLoading}
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-semibold text-slate-900 mb-2"
              >
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
                disabled={isLoading}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 cursor-pointer bg-black text-white font-semibold rounded-lg hover:bg-slate-200 hover:text-black transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          {/* Sign-in link */}
          <p className="text-center text-sm text-slate-600 mt-6">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-black hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-slate-600 mt-8">
          &copy; 2026 CourseHub. All rights reserved.
        </p>
      </div>
    </div>
  );
}
