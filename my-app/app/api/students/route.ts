import { NextResponse } from 'next/server';

// Mock database functions - replace with your actual DB connection
async function getStudentsWithScores() {
  // This is a placeholder - implement with your database
  return [];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeScores = searchParams.get('include_scores') === 'true';

  try {
    let students: Record<string, unknown>[];

    if (includeScores) {
      students = await getStudentsWithScores();
    } else {
      students = [];
    }

    // Add caching headers for better performance
    const response = NextResponse.json(students);
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    return response;
  } catch (error) {
    console.error('Students API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch students' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { first_name, middle_name, last_name } = body;

    // Validate input
    if (!first_name || !last_name) {
      return NextResponse.json(
        { error: 'First name and last name are required' },
        { status: 400 }
      );
    }

    // Insert into database - implement with your DB
    const student = {
      student_id: Math.random(),
      first_name,
      middle_name,
      last_name,
    };

    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    console.error('Student creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create student' },
      { status: 500 }
    );
  }
}
