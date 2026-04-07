import StudentForm from '@/components/StudentForm';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faCircleInfo} from '@fortawesome/free-solid-svg-icons';

export default function AddStudentPage() {
    return (
        <div className="p-12">
            <div className="max-w-2xl">
                <div className="mb-10">
                    <h1 className="text-4xl font-bold text-black mb-3">Add Student</h1>
                    <p className="text-lg text-black">
                        Create a new student record in the system. You can enroll them in courses and
                        assign grades for assignments.
                    </p>
                </div>

                <StudentForm/>

                <div className="mt-10 p-6 bg-slate-100 border border-slate-200 rounded-lg">
                    <div className='flex mb-2'>
                        <FontAwesomeIcon icon={faCircleInfo} className='w-5 text-black ml-3'/>
                        <h3 className="font-semibold text-black pl-2">
                            Tips</h3>
                    </div>
                    <ul className="text-sm text-black space-y-2">
                        <li>• Middle name is optional and can be added later</li>
                        <li>• Student names can be up to 50 characters each</li>
                        <li>• After adding a student, you can enroll them in courses</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
