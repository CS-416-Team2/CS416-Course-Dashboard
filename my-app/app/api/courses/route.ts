import { NextResponse } from 'next/server';

// Mock database functions - replace with your actual DB connection
async function getAllCourses() {
  // Placeholder - implement with your database
  return [];
}

async function createCourse(courseName: string) {
  // Placeholder - implement with your database
  return {
    course_id: Math.random(),
    course_name: courseName,
  };
}

export async function GET() {
  try {
    const courses = await getAllCourses();

    // Add caching headers
    const response = NextResponse.json(courses);
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    return response;
  } catch (error) {
    console.error('Courses API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch courses' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { course_name } = body;

    // Validate input
    if (!course_name) {
      return NextResponse.json(
        { error: 'Course name is required' },
        { status: 400 }
      );
    }

    const course = await createCourse(course_name);
    return NextResponse.json(course, { status: 201 });
  } catch (error) {
    console.error('Course creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create course' },
      { status: 500 }
    );
  }
}
