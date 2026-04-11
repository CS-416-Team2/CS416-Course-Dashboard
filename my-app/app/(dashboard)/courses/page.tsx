import CourseForm from '@/components/CourseForm';
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export default function AddCoursePage() {
  return (
    <div className="p-12">
      <div className="max-w-2xl">
        <div className="mb-10 text-black">
          <h1 className="text-4xl font-bold text-black mb-3">Add Course</h1>
          <p className="text-lg text-black">
            Create a new course that you can manage. You'll be able to add assignments and enroll students in this course.
          </p>
        </div>

        <CourseForm />

        <div className="mt-10 p-6 bg-slate-100 border border-slate-200 rounded-lg">
        <div className='flex mb-2'>
                        <FontAwesomeIcon icon={faCircleInfo} className='w-5 text-black ml-3'/>
                        <h3 className="font-semibold text-black pl-2">
                            Tips</h3>
                    </div>
                    <ul className="text-sm text-black space-y-2">
            <li>• Course names can be up to 100 characters</li>
            <li>• Use clear, descriptive names for easy identification</li>
            <li>• After creating a course, you can add assignments and enroll students</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
