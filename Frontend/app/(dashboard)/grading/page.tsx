import GradingPanel from '@/components/GradingPanel';
import CsvImportPanel from '@/components/CsvImportPanel';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';

export default function GradingPage() {
  return (
    <div className="p-12">
      <div className="max-w-5xl">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-black mb-3">Grading</h1>
          <p className="text-lg text-black">
            View enrolled students and assign scores for each assignment.
          </p>
        </div>

        <GradingPanel />

        <div className="mt-10">
          <CsvImportPanel />
        </div>

        <div className="mt-10 p-6 bg-slate-100 border border-slate-200 rounded-lg">
          <div className="flex mb-2">
            <FontAwesomeIcon icon={faCircleInfo} className="w-5 text-black ml-3" />
            <h3 className="font-semibold text-black pl-2">Tips</h3>
          </div>
          <ul className="text-sm text-black space-y-2">
            <li>• Select a course first, then pick an assignment to grade</li>
            <li>• Enter scores for each student, then click Save</li>
            <li>• Existing scores can be overwritten by entering a new value</li>
            <li>• Students must be enrolled in the course to appear here</li>
            <li>• Use the Bulk CSV Import to add students, enrollments, and grades at once</li>
            <li>• CSV columns are all optional: <code className="bg-white px-1 py-0.5 rounded text-xs">student_id, first_name, middle_name, last_name, score, course_id, assignment_id</code></li>
            <li>• Leave columns empty to skip them — e.g. upload just student names without scores</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
