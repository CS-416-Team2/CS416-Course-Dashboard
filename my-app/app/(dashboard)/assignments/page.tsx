import AssignmentForm from '@/components/AssignmentForm';

export default function AddAssignmentPage() {
  return (
    <div className="p-12">
      <div className="max-w-2xl">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">Add Assignment</h1>
          <p className="text-lg text-slate-600">
            Create a new assignment for one of your courses. You'll be able to grade students on this assignment.
          </p>
        </div>

        <AssignmentForm />

        <div className="mt-10 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Tips</h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>• Assignment titles can be up to 100 characters</li>
            <li>• Max points defaults to 100 but can be customized</li>
            <li>• You must have a course created before adding assignments</li>
            <li>• After creating an assignment, you can grade students</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
