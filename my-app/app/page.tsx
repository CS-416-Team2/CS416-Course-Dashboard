import Link from "next/link";
import Navbar from "@/components/navbar";

export default function Home() {
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100">
      <Navbar />

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-start pt-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Video Background */}
        <video
          autoPlay
          loop
          muted
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/111.mp4" type="video/mp4" />
        </video>

        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-black/50"></div>

        {/* Content */}
        <div className="max-w-6xl w-full text-center mx-auto relative z-10">
          <div className="inline-block p-6 bg-blue-100 rounded-2xl mb-12">
            <span className="text-5xl">🎓</span>
          </div>
          <h1 className="text-5xl sm:text-7xl font-bold text-white mb-8 leading-tight">
            Professional Course <span className="text-white">Management</span>
          </h1>
          <p className="text-xl text-gray-100 max-w-3xl mx-auto mb-12 leading-relaxed">
            Streamline your teaching workflow with an intuitive student record management system.
            Track grades, analyze performance, and make data-driven decisions effortlessly.
          </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-6 justify-center">
          <Link
            href="/dashboard"
            className="px-10 py-4 bg-black text-white rounded-lg font-semibold hover:bg-slate-200 hover:text-black transition shadow-lg hover:shadow-xl text-lg"
          >
            Go to Dashboard →
          </Link>
          <Link
            href="#features"
            className="px-10 py-4 bg-white text-black border-2 border-black rounded-lg font-semibold hover:bg-slate-200 hover:text-black transition text-lg"
          >
            Learn More
          </Link>
        </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-white py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16 text-center">
            <div className="p-8">
              <div className="text-5xl font-bold text-black mb-4">20</div>
              <p className="text-lg text-slate-600">Students Per Course</p>
            </div>
            <div className="p-8">
              <div className="text-5xl font-bold text-black mb-4">100%</div>
              <p className="text-lg text-slate-600">Data Validation</p>
            </div>
            <div className="p-8">
              <div className="text-5xl font-bold text-blue-600 mb-4">⚡</div>
              <p className="text-lg text-slate-600">Real-time Analytics</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
        <h2 className="text-4xl font-bold text-slate-900 text-center mb-20">
          Powerful Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {/* Feature 1 */}
          <div className="p-8 bg-white rounded-xl shadow-sm hover:shadow-md transition border border-slate-200">
            <div className="text-4xl mb-6">📊</div>
            <h3 className="text-xl font-semibold text-slate-900 mb-4">
              Student Data Management
            </h3>
            <p className="text-slate-600 leading-relaxed">
              Easily input and manage student information including names, IDs, and course scores.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="p-8 bg-white rounded-xl shadow-sm hover:shadow-md transition border border-slate-200">
            <div className="text-4xl mb-6">📈</div>
            <h3 className="text-xl font-semibold text-slate-900 mb-4">
              Performance Analytics
            </h3>
            <p className="text-slate-600 leading-relaxed">
              View average scores, performance trends, and identify students who need support.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="p-8 bg-white rounded-xl shadow-sm hover:shadow-md transition border border-slate-200">
            <div className="text-4xl mb-6">🔍</div>
            <h3 className="text-xl font-semibold text-slate-900 mb-4">
              Sorted Reporting
            </h3>
            <p className="text-slate-600 leading-relaxed">
              Automatically generate sorted reports to view student performance in ascending order.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="p-8 bg-white rounded-xl shadow-sm hover:shadow-md transition border border-slate-200">
            <div className="text-4xl mb-6">💾</div>
            <h3 className="text-xl font-semibold text-slate-900 mb-4">
              Secure Database
            </h3>
            <p className="text-slate-600 leading-relaxed">
              Reliable data storage with built-in validation to ensure data integrity.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="p-8 bg-white rounded-xl shadow-sm hover:shadow-md transition border border-slate-200">
            <div className="text-4xl mb-6">⚙️</div>
            <h3 className="text-xl font-semibold text-slate-900 mb-4">
              Easy Integration
            </h3>
            <p className="text-slate-600 leading-relaxed">
              Seamlessly integrate with existing educational tools and workflows.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="p-8 bg-white rounded-xl shadow-sm hover:shadow-md transition border border-slate-200">
            <div className="text-4xl mb-6">🔒</div>
            <h3 className="text-xl font-semibold text-slate-900 mb-4">
              Privacy Focused
            </h3>
            <p className="text-slate-600 leading-relaxed">
              Protect student data with enterprise-grade security and compliance standards.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="about" className="bg-white text-black py-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Transform Your Teaching?</h2>
          <p className="text-xl mb-12 opacity-90 leading-relaxed">
            Start managing your course and student data efficiently today.
          </p>
          <Link
            href="/dashboard"
            className="inline-block px-10 py-4 bg-white text-black rounded-lg font-semibold hover:bg-slate-200 transition text-lg border-2 border-black"
          >
            Access Dashboard Now
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p>&copy; 2026 CourseHub. Professional Course Management System.</p>
        </div>
      </footer>
    </div>
  );
}
