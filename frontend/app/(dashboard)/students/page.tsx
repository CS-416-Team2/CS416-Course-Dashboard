import StudentForm from '@/components/StudentForm';
import ManageStudents from '@/components/ManageStudents';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';

export default function StudentsPage() {
  return (
    <div className="p-12">
      <div className="max-w-4xl">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-black mb-3">Students</h1>
          <p className="text-lg text-black">
            Add new students and manage their course enrollments.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          <StudentForm />

          <div className="p-6 bg-slate-100 border border-slate-200 rounded-xl h-fit">
            <div className="flex mb-2">
              <FontAwesomeIcon icon={faCircleInfo} className="w-5 text-black ml-3" />
              <h3 className="font-semibold text-black pl-2">Tips</h3>
            </div>
            <ul className="text-sm text-black space-y-2">
              <li>• Select one or more courses when adding a student to enroll them immediately</li>
              <li>• Middle name is optional</li>
              <li>• Use the panel below to update enrollments for existing students</li>
            </ul>
          </div>
        </div>

        <ManageStudents />
      </div>
    </div>
  );
}
