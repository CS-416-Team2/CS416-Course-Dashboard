import mysql.connector
from mysql.connector import pooling
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import dotenv_values
from decimal import Decimal
import os
import sys

app = Flask(__name__)
CORS(app)

# --- DATABASE CONNECTION POOL ---
# A pool keeps connections open and reuses them instead of
# opening a new one on every request (which is slow and can crash the server).
db_pool = None

def init_pool():
    global db_pool
    try:
        env = dotenv_values(os.path.join(os.path.dirname(os.path.abspath(__file__)), "db-config.env"))
        if not env:
            raise FileNotFoundError("db-config.env is empty or missing")
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        print("  -> Copy .env.example to db-config.env and fill in your MySQL credentials.", file=sys.stderr)
        sys.exit(1)

    db_pool = pooling.MySQLConnectionPool(
        pool_name="cs416_pool",
        pool_size=5,
        pool_reset_session=True,
        host=env["DB_HOST"],
        user=env["DB_USER"],
        password=env["DB_PASS"],
        database=env["DB_NAME"],
    )
    print(f" * Connected to MySQL ({env['DB_HOST']}/{env['DB_NAME']})")

def get_db_connection():
    return db_pool.get_connection()


# --- HELPER: Convert Decimal to float for JSON ---
def clean(obj):
    """MySQL returns Decimal types which can't be serialized to JSON.
    This converts them to plain floats."""
    if isinstance(obj, list):
        return [clean(item) for item in obj]
    elif isinstance(obj, dict):
        return {k: (float(v) if isinstance(v, Decimal) else v) for k, v in obj.items()}
    return obj


# --- CUSTOM SORTING ALGORITHM (Assignment #3) ---
def bubble_sort_students_by_score(data):
    n = len(data)
    for i in range(n):
        for j in range(0, n - i - 1):
            if float(data[j]['score']) > float(data[j + 1]['score']):
                data[j], data[j + 1] = data[j + 1], data[j]
    return data


# --- API ROUTES ---

# ==================== COURSES ====================

@app.route('/api/courses', methods=['GET'])
def get_courses():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        query = """
            SELECT c.course_id, c.course_name,
                   COUNT(DISTINCT e.student_id) AS student_count,
                   COUNT(DISTINCT a.assignment_id) AS assignment_count
            FROM courses c
            LEFT JOIN enrollments e ON c.course_id = e.course_id
            LEFT JOIN assignments a ON c.course_id = a.course_id
            GROUP BY c.course_id, c.course_name
        """
        cursor.execute(query)
        courses = cursor.fetchall()
        return jsonify(clean(courses)), 200

    except mysql.connector.Error as err:
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()
        conn.close()


@app.route('/api/courses', methods=['POST'])
def create_course():
    data = request.get_json()
    course_name = data.get("course_name", "").strip()

    if not course_name:
        return jsonify({"error": "course_name is required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # instructor_id = 1 is the seeded user from schema.sql
        cursor.execute(
            "INSERT INTO courses (instructor_id, course_name) VALUES (%s, %s)",
            (1, course_name)
        )
        conn.commit()
        return jsonify({"message": "Course created", "course_id": cursor.lastrowid}), 201

    except mysql.connector.Error as err:
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()
        conn.close()


# ==================== ASSIGNMENTS ====================

@app.route('/api/courses/<int:course_id>/assignments', methods=['GET'])
def get_assignments(course_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        query = """
            SELECT a.assignment_id, a.title, a.max_points,
                   COUNT(ag.score_id) AS grade_count
            FROM assignments a
            LEFT JOIN assignment_grade ag ON a.assignment_id = ag.assignment_id
            WHERE a.course_id = %s
            GROUP BY a.assignment_id, a.title, a.max_points
        """
        cursor.execute(query, (course_id,))
        assignments = cursor.fetchall()
        return jsonify(clean(assignments)), 200

    except mysql.connector.Error as err:
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()
        conn.close()


@app.route('/api/courses/<int:course_id>/assignments', methods=['POST'])
def create_assignment(course_id):
    """
    Create an assignment and bulk-import grades.
    Expects JSON:
    {
        "title": "Midterm Exam",
        "grades": [
            { "student_id": 1, "first_name": "Alice", "middle_name": "", "last_name": "Smith", "score": 92 },
            ...
        ]
    }
    """
    data = request.get_json()
    title = data.get("title", "").strip()
    grades = data.get("grades", [])

    if not title:
        return jsonify({"error": "title is required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # 1. Create the assignment
        cursor.execute(
            "INSERT INTO assignments (course_id, title, max_points) VALUES (%s, %s, %s)",
            (course_id, title, 100)
        )
        assignment_id = cursor.lastrowid

        # 2. For each grade row, insert/update student and record the grade
        for g in grades:
            sid   = g.get("student_id")
            fname = g.get("first_name", "")
            mname = g.get("middle_name", "")
            lname = g.get("last_name", "")
            score = g.get("score", 0)

            if not (0 <= float(score) <= 100):
                continue  # Skip invalid scores

            # Insert student (or update name if they already exist)
            cursor.execute("""
                INSERT INTO students (student_id, first_name, middle_name, last_name)
                VALUES (%s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    first_name = VALUES(first_name),
                    middle_name = VALUES(middle_name),
                    last_name = VALUES(last_name)
            """, (sid, fname, mname, lname))

            # Enroll student in course (ignore if already enrolled)
            cursor.execute(
                "INSERT IGNORE INTO enrollments (student_id, course_id) VALUES (%s, %s)",
                (sid, course_id)
            )

            # Insert the grade
            cursor.execute(
                "INSERT INTO assignment_grade (student_id, assignment_id, score) VALUES (%s, %s, %s)",
                (sid, assignment_id, score)
            )

        conn.commit()
        return jsonify({
            "message": "Assignment created with grades",
            "assignment_id": assignment_id,
            "grades_imported": len(grades)
        }), 201

    except mysql.connector.Error as err:
        conn.rollback()
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()
        conn.close()


# ==================== STUDENTS ====================

@app.route('/api/students', methods=['POST'])
def add_student_data():
    data = request.get_json()
    student_id = data.get("student_id")
    score = data.get("score")

    if not (0 <= score <= 100):
        return jsonify({"error": "Score must be between 0 and 100"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # 1. Insert into students table. 
        # Using INSERT IGNORE so it doesn't crash if the student already exists.
        student_query = """
            INSERT IGNORE INTO students (student_id, first_name, middle_name, last_name)
            VALUES (%s, %s, %s, %s)
        """
        cursor.execute(student_query, (student_id, data.get("first_name"), data.get("middle_name", ""), data.get("last_name")))

        # 2. Insert the grade (assuming assignment_id 1 for this project)
        grade_query = """
            INSERT INTO assignment_grade (student_id, assignment_id, score)
            VALUES (%s, %s, %s)
        """
        cursor.execute(grade_query, (student_id, 1, score))

        conn.commit() # Save changes to DB
        return jsonify({"message": "Student and score saved to MySQL!"}), 201

    except mysql.connector.Error as err:
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()
        conn.close()


@app.route('/api/students', methods=['GET'])
def get_sorted_students():
    assignment_id = request.args.get('assignment_id', type=int)

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True) # dictionary=True makes rows look like JSON
    
    try:
        # SQL JOIN to get student info and their scores
        if assignment_id:
            query = """
                SELECT s.student_id, s.first_name, s.middle_name, s.last_name, ag.score 
                FROM students s
                JOIN assignment_grade ag ON s.student_id = ag.student_id
                WHERE ag.assignment_id = %s
            """
            cursor.execute(query, (assignment_id,))
        else:
            query = """
                SELECT s.student_id, s.first_name, s.middle_name, s.last_name, ag.score 
                FROM students s
                JOIN assignment_grade ag ON s.student_id = ag.student_id
            """
            cursor.execute(query)

        students_data = cursor.fetchall()
        students_data = clean(students_data)

        # Pass the DB results through your sorting algorithm
        sorted_data = bubble_sort_students_by_score(students_data)

        # Calculate the average
        if students_data:
            avg = sum(float(s['score']) for s in students_data) / len(students_data)
        else:
            avg = 0
        
        return jsonify({
            "students": sorted_data,
            "average": round(avg, 2),
            "count": len(sorted_data)
        }), 200

    except mysql.connector.Error as err:
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()
        conn.close()


# ==================== AVERAGE ====================

@app.route('/api/average', methods=['GET'])
def get_average():
    assignment_id = request.args.get('assignment_id', type=int)

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Let MySQL do the math for you!
        if assignment_id:
            query = "SELECT AVG(score) as average_score FROM assignment_grade WHERE assignment_id = %s"
            cursor.execute(query, (assignment_id,))
        else:
            query = "SELECT AVG(score) as average_score FROM assignment_grade"
            cursor.execute(query)

        result = cursor.fetchone()
        
        # Handle the case where the DB is empty (AVG returns None)
        avg = result['average_score'] if result['average_score'] is not None else 0
        
        # Convert Decimal to float for JSON serialization
        return jsonify({"average_score": round(float(avg), 2)}), 200

    except mysql.connector.Error as err:
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()
        conn.close()


if __name__ == '__main__':
    init_pool()
    app.run(host='0.0.0.0', port=5000, debug=True)