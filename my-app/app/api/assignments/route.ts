import { NextResponse } from 'next/server';

// Mock database functions - replace with your actual DB connection
async function createAssignment(courseId: number, title: string, maxPoints: number) {
  // Placeholder - implement with your database
  return {
    assignment_id: Math.random(),
    course_id: courseId,
    title,
    max_points: maxPoints,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { course_id, title, max_points } = body;

    // Validate input
    if (!course_id || !title) {
      return NextResponse.json(
        { error: 'Course ID and title are required' },
        { status: 400 }
      );
    }

    const assignment = await createAssignment(
      course_id,
      title,
      max_points || 100
    );

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    console.error('Assignment creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create assignment' },
      { status: 500 }
    );
  }
}
