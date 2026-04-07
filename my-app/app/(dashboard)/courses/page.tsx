import CourseForm from '@/components/CourseForm';

export default function AddCoursePage() {
  return (
    <div className="p-12">
      <div className="max-w-2xl">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">Add Course</h1>
          <p className="text-lg text-slate-600">
            Create a new course that you can manage. You'll be able to add assignments and enroll students in this course.
          </p>
        </div>

        <CourseForm />

        <div className="mt-10 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Tips</h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>• Course names can be up to 100 characters</li>
            <li>• Use clear, descriptive names for easy identification</li>
            <li>• After creating a course, you can add assignments and enroll students</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
