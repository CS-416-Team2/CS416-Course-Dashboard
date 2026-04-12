import AssignmentForm from '@/components/AssignmentForm';
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export default function AddAssignmentPage() {
  return (
    <div className="p-12">
      <div className="max-w-2xl">
        <div className="mb-10 text-black">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">Add Assignment</h1>
          <p className="text-lg text-black">
            Create a new assignment for one of your courses. You'll be able to grade students on this assignment.
          </p>
        </div>

        <AssignmentForm />

        <div className="mt-10 p-6 bg-slate-100 border border-slate-200 rounded-lg">
        <div className='flex mb-2'>
                        <FontAwesomeIcon icon={faCircleInfo} className='w-5 text-black ml-3'/>
                        <h3 className="font-semibold text-black pl-2">
                            Tips</h3>
                    </div>
          <ul className="text-sm text-black space-y-2">
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
