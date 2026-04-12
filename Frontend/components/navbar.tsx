import Image from 'next/image';
import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-white border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex justify-between items-center">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 transition">
          <Image
            src="/BookPNG.png"
            alt="CourseHub"
            width={40}
            height={40}
            className="w-10 h-10 rounded-lg object-contain"
            priority
          />
          <span className="text-2xl font-bold text-slate-900">CourseHub</span>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-8">
          <a href="#about" className="text-slate-600 hover:text-slate-900 transition font-medium">
            About
          </a>
          <Link
            href="/login"
            className="px-6 py-2.5 bg-black text-white rounded-lg font-semibold hover:bg-slate-300 hover:text-black transition"
          >
            Login
          </Link>
        </div>
      </div>
    </nav>
  );
}
