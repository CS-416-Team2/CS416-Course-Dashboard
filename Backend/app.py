import mysql.connector
from mysql.connector import pooling
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from dotenv import dotenv_values
from decimal import Decimal
import os
import sys

app = Flask(__name__)
CORS(app, origins=["https://bejimbus.com"])

# --- DATABASE CONNECTION POOL ---


import time
db_pool=None

def init_pool():
    global db_pool

    env = {
        "DB_HOST": os.getenv("DB_HOST"),
        "DB_USER": os.getenv("DB_USER"),
        "DB_PASS": os.getenv("DB_PASS"),
        "DB_NAME": os.getenv("DB_NAME"),
    }

    for i in range(10):
        try:
            db_pool = pooling.MySQLConnectionPool(
                pool_name="cs416_pool",
                pool_size=5,
                pool_reset_session=True,
                host=env["DB_HOST"],
                user=env["DB_USER"],
                password=env["DB_PASS"],
                database=env["DB_NAME"],
            )
            print(f"✔ Connected to MySQL ({env['DB_HOST']}/{env['DB_NAME']})")
            return
        except Exception as e:
            print(f"DB not ready, retry {i+1}/10: {e}")
            time.sleep(2)

    raise RuntimeError("Could not connect to DB")


def get_db():
    """Get the per-request database connection. Creates one from the pool
    on first call and reuses it for the rest of the request."""
    if 'db' not in g:
        g.db = db_pool.get_connection()
    return g.db


@app.teardown_appcontext
def close_db(exception):
    """Automatically return the connection to the pool when the request ends."""
    conn = g.pop('db', None)
    if conn is not None:
        conn.close()


def seed_default_user():
    conn = db_pool.get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO users (user_id, email, password_hash, first_name, last_name, is_active, session_version)
            VALUES (
                1,
                'admin@school.edu',
                '$2b$12$yfSwpRl7PUeXJLpCS6bbdeq2dbBl1Q/aEmD7b00nCHPUchSapNcD.',
                'Default',
                'Instructor',
                1,
                1
            )
            ON DUPLICATE KEY UPDATE
                email = VALUES(email),
                first_name = VALUES(first_name),
                last_name = VALUES(last_name),
                is_active = VALUES(is_active),
                session_version = VALUES(session_version),
                -- Upgrade legacy plaintext password records to bcrypt hash.
                password_hash = CASE
                    WHEN password_hash = 'placeholder' THEN VALUES(password_hash)
                    ELSE password_hash
                END
        """)
        conn.commit()
    except mysql.connector.Error as err:
        print(f"seed_default_user failed: {err}", file=sys.stderr)
    finally:
        cursor.close()
        conn.close()


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


# --- USER IDENTITY (set by Next.js proxy via X-User-Id header) ---

@app.before_request
def set_user_context():
    raw = request.headers.get('X-User-Id')
    g.user_id = None
    if raw:
        try:
            uid = int(raw)
            if uid > 0:
                g.user_id = uid
        except (ValueError, TypeError):
            pass


def require_user():
    if not g.user_id:
        return None
    return g.user_id


def verify_course_owner(cursor, course_id, user_id):
    cursor.execute(
        "SELECT 1 FROM courses WHERE course_id = %s AND instructor_id = %s",
        (course_id, user_id)
    )
    return cursor.fetchone() is not None


# --- API ROUTES ---

# ==================== COURSES ====================

@app.route('/api/courses', methods=['GET'])
def get_courses():
    user_id = require_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    try:
        query = """
            SELECT c.course_id, c.course_name,
                   COUNT(DISTINCT e.student_id) AS student_count,
                   COUNT(DISTINCT a.assignment_id) AS assignment_count
            FROM courses c
            LEFT JOIN enrollments e ON c.course_id = e.course_id
            LEFT JOIN assignments a ON c.course_id = a.course_id
            WHERE c.instructor_id = %s
            GROUP BY c.course_id, c.course_name
        """
        cursor.execute(query, (user_id,))
        courses = cursor.fetchall()
        return jsonify(clean(courses)), 200

    except mysql.connector.Error as err:
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()


@app.route('/api/courses', methods=['POST'])
def create_course():
    user_id = require_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    course_name = data.get("course_name", "").strip()

    if not course_name:
        return jsonify({"error": "course_name is required"}), 400

    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute(
            "INSERT INTO courses (instructor_id, course_name) VALUES (%s, %s)",
            (user_id, course_name)
        )
        conn.commit()
        return jsonify({"message": "Course created", "course_id": cursor.lastrowid}), 201

    except mysql.connector.Error as err:
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()


@app.route('/api/courses/<int:course_id>', methods=['PUT'])
def update_course(course_id):
    user_id = require_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    course_name = data.get("course_name", "").strip()
    if not course_name:
        return jsonify({"error": "course_name is required"}), 400

    conn = get_db()
    cursor = conn.cursor()

    try:
        if not verify_course_owner(cursor, course_id, user_id):
            return jsonify({"error": "Forbidden"}), 403

        cursor.execute(
            "UPDATE courses SET course_name = %s WHERE course_id = %s AND instructor_id = %s",
            (course_name, course_id, user_id)
        )
        conn.commit()
        return jsonify({"message": "Course updated"}), 200

    except mysql.connector.Error as err:
        conn.rollback()
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()


# ==================== ASSIGNMENTS ====================

@app.route('/api/assignments', methods=['GET'])
def get_all_assignments():
    """Return every assignment belonging to the current user's courses."""
    user_id = require_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT a.assignment_id, a.title, a.max_points,
                   c.course_id, c.course_name,
                   COUNT(ag.score_id) AS grade_count
            FROM assignments a
            JOIN courses c ON a.course_id = c.course_id
            LEFT JOIN assignment_grade ag ON a.assignment_id = ag.assignment_id
            WHERE c.instructor_id = %s
            GROUP BY a.assignment_id, a.title, a.max_points, c.course_id, c.course_name
            ORDER BY c.course_name, a.title
        """, (user_id,))
        return jsonify(clean(cursor.fetchall())), 200

    except mysql.connector.Error as err:
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()


@app.route('/api/courses/<int:course_id>/assignments', methods=['GET'])
def get_assignments(course_id):
    user_id = require_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    try:
        if not verify_course_owner(cursor, course_id, user_id):
            return jsonify({"error": "Forbidden"}), 403

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


@app.route('/api/assignments', methods=['POST'])
def create_assignment_simple():
    """Create an assignment from the dashboard form (course_id in JSON body)."""
    user_id = require_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    course_id = data.get("course_id")
    title = data.get("title", "").strip()
    max_points = data.get("max_points", 100)

    if not course_id:
        return jsonify({"error": "course_id is required"}), 400
    if not title:
        return jsonify({"error": "title is required"}), 400

    conn = get_db()
    cursor = conn.cursor()

    try:
        if not verify_course_owner(cursor, course_id, user_id):
            return jsonify({"error": "Forbidden"}), 403

        cursor.execute(
            "INSERT INTO assignments (course_id, title, max_points) VALUES (%s, %s, %s)",
            (course_id, title, max_points)
        )
        conn.commit()
        return jsonify({
            "message": "Assignment created",
            "assignment_id": cursor.lastrowid
        }), 201

    except mysql.connector.Error as err:
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()


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
    user_id = require_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    title = data.get("title", "").strip()
    grades = data.get("grades", [])
    max_points = data.get("max_points", 100)

    if not title:
        return jsonify({"error": "title is required"}), 400

    conn = get_db()
    cursor = conn.cursor()

    try:
        if not verify_course_owner(cursor, course_id, user_id):
            return jsonify({"error": "Forbidden"}), 403

        cursor.execute(
            "INSERT INTO assignments (course_id, title, max_points) VALUES (%s, %s, %s)",
            (course_id, title, max_points)
        )
        assignment_id = cursor.lastrowid

        for g in grades:
            sid   = g.get("student_id")
            fname = g.get("first_name", "")
            mname = g.get("middle_name", "")
            lname = g.get("last_name", "")
            score = g.get("score", 0)

            if float(score) < 0:
                continue

            cursor.execute("""
                INSERT INTO students (student_id, first_name, middle_name, last_name, created_by)
                VALUES (%s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    first_name = VALUES(first_name),
                    middle_name = VALUES(middle_name),
                    last_name = VALUES(last_name)
            """, (sid, fname, mname, lname, user_id))

            cursor.execute(
                "INSERT IGNORE INTO enrollments (student_id, course_id) VALUES (%s, %s)",
                (sid, course_id)
            )

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


@app.route('/api/assignments/<int:assignment_id>', methods=['PUT'])
def update_assignment(assignment_id):
    user_id = require_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    title = data.get("title", "").strip()
    max_points = data.get("max_points")

    if not title:
        return jsonify({"error": "title is required"}), 400

    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT a.max_points, a.course_id FROM assignments a
            JOIN courses c ON a.course_id = c.course_id
            WHERE a.assignment_id = %s AND c.instructor_id = %s
        """, (assignment_id, user_id))
        row = cursor.fetchone()
        if not row:
            return jsonify({"error": "Assignment not found"}), 404

        new_max = int(max_points) if max_points is not None else int(row['max_points'])
        if new_max <= 0:
            return jsonify({"error": "max_points must be positive"}), 400

        old_max = int(row['max_points'])
        cursor.execute(
            "UPDATE assignments SET title = %s, max_points = %s WHERE assignment_id = %s",
            (title, new_max, assignment_id)
        )

        if new_max != old_max:
            cursor.execute(
                "DELETE FROM assignment_grade WHERE assignment_id = %s",
                (assignment_id,)
            )

        conn.commit()
        grades_cleared = new_max != old_max
        msg = "Assignment updated"
        if grades_cleared:
            msg += " — grades cleared because max points changed"
        return jsonify({"message": msg, "grades_cleared": grades_cleared}), 200

    except mysql.connector.Error as err:
        conn.rollback()
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()


# ==================== STUDENTS ====================

@app.route('/api/students', methods=['POST'])
def add_student_data():
    user_id = require_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    first_name = data.get("first_name", "").strip()
    middle_name = data.get("middle_name", "") or ""
    last_name = data.get("last_name", "").strip()

    if not first_name or not last_name:
        return jsonify({"error": "first_name and last_name are required"}), 400

    student_id = data.get("student_id")
    score = data.get("score")
    course_ids = data.get("course_ids", [])

    conn = get_db()
    cursor = conn.cursor()

    try:
        for cid in course_ids:
            if not verify_course_owner(cursor, cid, user_id):
                return jsonify({"error": "Forbidden"}), 403

        if student_id:
            cursor.execute("""
                INSERT INTO students (student_id, first_name, middle_name, last_name, created_by)
                VALUES (%s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    first_name = VALUES(first_name),
                    middle_name = VALUES(middle_name),
                    last_name = VALUES(last_name)
            """, (student_id, first_name, middle_name, last_name, user_id))
        else:
            cursor.execute(
                "INSERT INTO students (first_name, middle_name, last_name, created_by) VALUES (%s, %s, %s, %s)",
                (first_name, middle_name, last_name, user_id)
            )
            student_id = cursor.lastrowid

        for cid in course_ids:
            cursor.execute(
                "INSERT IGNORE INTO enrollments (student_id, course_id) VALUES (%s, %s)",
                (student_id, cid)
            )

        if score is not None:
            assignment_id = data.get("assignment_id", 1)
            cursor.execute("SELECT max_points FROM assignments WHERE assignment_id = %s", (assignment_id,))
            assignment_row = cursor.fetchone()
            max_pts = assignment_row[0] if assignment_row else 100
            if not (0 <= score <= max_pts):
                return jsonify({"error": f"Score must be between 0 and {max_pts}"}), 400
            cursor.execute(
                "INSERT INTO assignment_grade (student_id, assignment_id, score) VALUES (%s, %s, %s)",
                (student_id, assignment_id, score)
            )

        conn.commit()
        return jsonify({"message": "Student saved!", "student_id": student_id}), 201

    except mysql.connector.Error as err:
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()


@app.route('/api/students/<int:student_id>', methods=['PUT'])
def update_student(student_id):
    """Update student info and/or their course enrollments."""
    user_id = require_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    conn = get_db()
    cursor = conn.cursor()

    try:
        first_name = data.get("first_name")
        last_name = data.get("last_name")
        if first_name and last_name:
            middle_name = data.get("middle_name", "") or ""
            cursor.execute("""
                UPDATE students SET first_name = %s, middle_name = %s, last_name = %s
                WHERE student_id = %s
            """, (first_name.strip(), middle_name, last_name.strip(), student_id))

        if "course_ids" in data:
            course_ids = data["course_ids"]
            for cid in course_ids:
                if not verify_course_owner(cursor, cid, user_id):
                    return jsonify({"error": "Forbidden"}), 403
            cursor.execute("""
                DELETE FROM enrollments
                WHERE student_id = %s
                  AND course_id IN (SELECT course_id FROM courses WHERE instructor_id = %s)
            """, (student_id, user_id))
            for cid in course_ids:
                cursor.execute(
                    "INSERT IGNORE INTO enrollments (student_id, course_id) VALUES (%s, %s)",
                    (student_id, cid)
                )

        conn.commit()
        return jsonify({"message": "Student updated"}), 200

    except mysql.connector.Error as err:
        conn.rollback()
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()


@app.route('/api/students/<int:student_id>/enrollments', methods=['GET'])
def get_student_enrollments(student_id):
    user_id = require_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT c.course_id, c.course_name
            FROM enrollments e
            JOIN courses c ON e.course_id = c.course_id
            WHERE e.student_id = %s AND c.instructor_id = %s
        """, (student_id, user_id))
        return jsonify(cursor.fetchall()), 200

    except mysql.connector.Error as err:
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()


@app.route('/api/courses/<int:course_id>/unenrolled', methods=['GET'])
def get_unenrolled_students(course_id):
    """Get students enrolled in the user's other courses but NOT in this one."""
    user_id = require_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    try:
        if not verify_course_owner(cursor, course_id, user_id):
            return jsonify({"error": "Forbidden"}), 403

        cursor.execute("""
            SELECT DISTINCT s.student_id, s.first_name, s.middle_name, s.last_name
            FROM students s
            LEFT JOIN enrollments e ON s.student_id = e.student_id
            LEFT JOIN courses c ON e.course_id = c.course_id
            WHERE (s.created_by = %s OR c.instructor_id = %s)
              AND s.student_id NOT IN (
                  SELECT e2.student_id FROM enrollments e2 WHERE e2.course_id = %s
              )
            ORDER BY s.last_name, s.first_name
        """, (user_id, user_id, course_id))
        return jsonify(cursor.fetchall()), 200

    except mysql.connector.Error as err:
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()


@app.route('/api/courses/<int:course_id>/enroll', methods=['POST'])
def enroll_students_in_course(course_id):
    """Enroll one or more students into a course."""
    user_id = require_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    student_ids = data.get("student_ids", [])

    if not student_ids:
        return jsonify({"error": "student_ids is required"}), 400

    conn = get_db()
    cursor = conn.cursor()

    try:
        if not verify_course_owner(cursor, course_id, user_id):
            return jsonify({"error": "Forbidden"}), 403

        for sid in student_ids:
            cursor.execute(
                "INSERT IGNORE INTO enrollments (student_id, course_id) VALUES (%s, %s)",
                (sid, course_id)
            )
        conn.commit()
        return jsonify({"message": f"{len(student_ids)} student(s) enrolled"}), 201

    except mysql.connector.Error as err:
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()


@app.route('/api/students', methods=['GET'])
def get_sorted_students():
    user_id = require_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    assignment_id = request.args.get('assignment_id', type=int)
    include_scores = request.args.get('include_scores', '').lower() == 'true'
    course_id = request.args.get('course_id', type=int)

    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    
    try:
        if include_scores:
            if course_id:
                if not verify_course_owner(cursor, course_id, user_id):
                    return jsonify({"error": "Forbidden"}), 403
                query = """
                    SELECT s.student_id, s.first_name, s.middle_name, s.last_name,
                           COALESCE(SUM(ag.score), 0) AS total_points,
                           COALESCE(SUM(a.max_points), 0) AS total_possible
                    FROM students s
                    JOIN enrollments e ON s.student_id = e.student_id AND e.course_id = %s
                    LEFT JOIN assignment_grade ag ON s.student_id = ag.student_id
                    LEFT JOIN assignments a ON ag.assignment_id = a.assignment_id AND a.course_id = %s
                    GROUP BY s.student_id, s.first_name, s.middle_name, s.last_name
                """
                cursor.execute(query, (course_id, course_id))
            else:
                query = """
                    SELECT s.student_id, s.first_name, s.middle_name, s.last_name,
                           COALESCE(SUM(ag.score), 0) AS total_points,
                           COALESCE(SUM(a.max_points), 0) AS total_possible
                    FROM students s
                    JOIN enrollments e ON s.student_id = e.student_id
                    JOIN courses c ON e.course_id = c.course_id AND c.instructor_id = %s
                    LEFT JOIN assignments a ON a.course_id = c.course_id
                    LEFT JOIN assignment_grade ag ON s.student_id = ag.student_id AND ag.assignment_id = a.assignment_id
                    GROUP BY s.student_id, s.first_name, s.middle_name, s.last_name
                """
                cursor.execute(query, (user_id,))
            students_data = clean(cursor.fetchall())

            for s in students_data:
                possible = float(s['total_possible'])
                s['average_score'] = round(float(s['total_points']) / possible * 100, 2) if possible > 0 else 0
                s['score'] = s['average_score']
            sorted_data = bubble_sort_students_by_score(students_data)

            if students_data:
                avg = sum(float(s['average_score']) for s in students_data) / len(students_data)
            else:
                avg = 0

            return jsonify({
                "students": sorted_data,
                "average": round(avg, 2),
                "count": len(sorted_data)
            }), 200

        elif assignment_id:
            query = """
                SELECT s.student_id, s.first_name, s.middle_name, s.last_name,
                       ag.score, a.max_points, a.assignment_id, a.title AS assignment_title
                FROM students s
                JOIN assignment_grade ag ON s.student_id = ag.student_id
                JOIN assignments a ON ag.assignment_id = a.assignment_id
                WHERE ag.assignment_id = %s
                  AND a.course_id IN (SELECT course_id FROM courses WHERE instructor_id = %s)
            """
            cursor.execute(query, (assignment_id, user_id))
            students_data = clean(cursor.fetchall())
            sorted_data = bubble_sort_students_by_score(students_data)

            total_score = sum(float(s['score']) for s in students_data)
            total_possible = sum(float(s['max_points']) for s in students_data)
            avg = round(total_score / total_possible * 100, 2) if total_possible > 0 else 0

            return jsonify({
                "students": sorted_data,
                "average": avg,
                "count": len(sorted_data)
            }), 200

        else:
            query = """
                SELECT DISTINCT s.student_id, s.first_name, s.middle_name, s.last_name
                FROM students s
                LEFT JOIN enrollments e ON s.student_id = e.student_id
                LEFT JOIN courses c ON e.course_id = c.course_id
                WHERE s.created_by = %s
                   OR c.instructor_id = %s
                ORDER BY s.last_name, s.first_name
            """
            cursor.execute(query, (user_id, user_id))
            students_data = cursor.fetchall()

            return jsonify(students_data), 200

    except mysql.connector.Error as err:
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()


# ==================== STATS ====================

@app.route('/api/stats', methods=['GET'])
def get_stats():
    user_id = require_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    course_id = request.args.get('course_id', type=int)
    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    try:
        if course_id:
            if not verify_course_owner(cursor, course_id, user_id):
                return jsonify({"error": "Forbidden"}), 403

            cursor.execute("""
                SELECT COUNT(DISTINCT s.student_id) AS total
                FROM students s
                JOIN enrollments e ON s.student_id = e.student_id AND e.course_id = %s
            """, (course_id,))
            total_students = cursor.fetchone()['total']
            enrolled_students = total_students

            cursor.execute("""
                SELECT COALESCE(SUM(ag.score), 0) AS total_score,
                       COALESCE(SUM(a.max_points), 0) AS total_possible,
                       MAX(ag.score / a.max_points * 100) AS highest_pct
                FROM assignment_grade ag
                JOIN assignments a ON ag.assignment_id = a.assignment_id
                JOIN enrollments e ON ag.student_id = e.student_id AND e.course_id = %s
                WHERE a.course_id = %s
            """, (course_id, course_id))
            score_row = cursor.fetchone()

            cursor.execute("""
                SELECT COUNT(*) AS passing
                FROM assignment_grade ag
                JOIN assignments a ON ag.assignment_id = a.assignment_id
                JOIN enrollments e ON ag.student_id = e.student_id AND e.course_id = %s
                WHERE a.course_id = %s AND (ag.score / a.max_points * 100) >= 60
            """, (course_id, course_id))
            passing_count = cursor.fetchone()['passing']

            cursor.execute("""
                SELECT COUNT(*) AS total
                FROM assignment_grade ag
                JOIN assignments a ON ag.assignment_id = a.assignment_id
                WHERE a.course_id = %s
            """, (course_id,))
            total_grades = cursor.fetchone()['total']
        else:
            cursor.execute("""
                SELECT COUNT(DISTINCT s.student_id) AS total
                FROM students s
                JOIN enrollments e ON s.student_id = e.student_id
                JOIN courses c ON e.course_id = c.course_id
                WHERE c.instructor_id = %s
            """, (user_id,))
            total_students = cursor.fetchone()['total']

            cursor.execute("""
                SELECT COUNT(DISTINCT e.student_id) AS enrolled
                FROM enrollments e
                JOIN courses c ON e.course_id = c.course_id
                WHERE c.instructor_id = %s
            """, (user_id,))
            enrolled_students = cursor.fetchone()['enrolled']

            cursor.execute("""
                SELECT COALESCE(SUM(ag.score), 0) AS total_score,
                       COALESCE(SUM(a.max_points), 0) AS total_possible,
                       MAX(ag.score / a.max_points * 100) AS highest_pct
                FROM assignment_grade ag
                JOIN assignments a ON ag.assignment_id = a.assignment_id
                JOIN courses c ON a.course_id = c.course_id
                WHERE c.instructor_id = %s
            """, (user_id,))
            score_row = cursor.fetchone()

            cursor.execute("""
                SELECT COUNT(*) AS passing
                FROM assignment_grade ag
                JOIN assignments a ON ag.assignment_id = a.assignment_id
                JOIN courses c ON a.course_id = c.course_id
                WHERE c.instructor_id = %s AND (ag.score / a.max_points * 100) >= 60
            """, (user_id,))
            passing_count = cursor.fetchone()['passing']

            cursor.execute("""
                SELECT COUNT(*) AS total
                FROM assignment_grade ag
                JOIN assignments a ON ag.assignment_id = a.assignment_id
                JOIN courses c ON a.course_id = c.course_id
                WHERE c.instructor_id = %s
            """, (user_id,))
            total_grades = cursor.fetchone()['total']

        total_possible = float(score_row['total_possible'])
        avg_score = round(float(score_row['total_score']) / total_possible * 100, 2) if total_possible > 0 else 0
        highest_score = round(float(score_row['highest_pct']), 2) if score_row['highest_pct'] is not None else 0
        passing_rate = round((passing_count / total_grades) * 100, 2) if total_grades > 0 else 0

        return jsonify({
            "totalStudents": total_students,
            "enrolledStudents": enrolled_students,
            "averageScore": avg_score,
            "highestScore": highest_score,
            "passingRate": passing_rate,
        }), 200

    except mysql.connector.Error as err:
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()


# ==================== GRADING ====================

@app.route('/api/grades', methods=['GET'])
def get_grades():
    """Get students with their scores for a given course and optional assignment."""
    user_id = require_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    course_id = request.args.get('course_id', type=int)
    assignment_id = request.args.get('assignment_id', type=int)

    if not course_id:
        return jsonify({"error": "course_id is required"}), 400

    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    try:
        if not verify_course_owner(cursor, course_id, user_id):
            return jsonify({"error": "Forbidden"}), 403

        if assignment_id:
            query = """
                SELECT s.student_id, s.first_name, s.middle_name, s.last_name,
                       ag.score, ag.score_id, a.max_points
                FROM students s
                JOIN enrollments e ON s.student_id = e.student_id AND e.course_id = %s
                LEFT JOIN assignment_grade ag ON s.student_id = ag.student_id AND ag.assignment_id = %s
                LEFT JOIN assignments a ON ag.assignment_id = a.assignment_id
                ORDER BY s.last_name, s.first_name
            """
            cursor.execute(query, (course_id, assignment_id))
        else:
            query = """
                SELECT s.student_id, s.first_name, s.middle_name, s.last_name,
                       CASE WHEN SUM(a.max_points) > 0
                            THEN ROUND(SUM(ag.score) / SUM(a.max_points) * 100, 2)
                            ELSE 0
                       END AS average_score,
                       COUNT(ag.score_id) AS graded_count
                FROM students s
                JOIN enrollments e ON s.student_id = e.student_id AND e.course_id = %s
                LEFT JOIN assignments a ON a.course_id = %s
                LEFT JOIN assignment_grade ag ON s.student_id = ag.student_id AND ag.assignment_id = a.assignment_id
                GROUP BY s.student_id, s.first_name, s.middle_name, s.last_name
                ORDER BY s.last_name, s.first_name
            """
            cursor.execute(query, (course_id, course_id))

        students = clean(cursor.fetchall())
        return jsonify(students), 200

    except mysql.connector.Error as err:
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()


@app.route('/api/grades', methods=['POST'])
def save_grade():
    """Save or update a single student's grade for an assignment."""
    user_id = require_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    student_id = data.get("student_id")
    assignment_id = data.get("assignment_id")
    score = data.get("score")

    if not student_id or not assignment_id or score is None:
        return jsonify({"error": "student_id, assignment_id, and score are required"}), 400

    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT a.max_points FROM assignments a
            JOIN courses c ON a.course_id = c.course_id
            WHERE a.assignment_id = %s AND c.instructor_id = %s
        """, (assignment_id, user_id))
        assignment_row = cursor.fetchone()
        if not assignment_row:
            return jsonify({"error": "Assignment not found"}), 404
        max_pts = float(assignment_row['max_points'])

        if not (0 <= float(score) <= max_pts):
            return jsonify({"error": f"Score must be between 0 and {int(max_pts)}"}), 400

        cursor.execute("""
            INSERT INTO assignment_grade (student_id, assignment_id, score)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE score = VALUES(score)
        """, (student_id, assignment_id, score))
        conn.commit()
        return jsonify({"message": "Grade saved"}), 200

    except mysql.connector.Error as err:
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()


@app.route('/api/grades/bulk', methods=['POST'])
def save_grades_bulk():
    """Save multiple grades at once."""
    user_id = require_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    grades = data.get("grades", [])
    assignment_id = data.get("assignment_id")
    course_id = data.get("course_id")

    if not assignment_id or not grades:
        return jsonify({"error": "assignment_id and grades are required"}), 400

    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT a.max_points FROM assignments a
            JOIN courses c ON a.course_id = c.course_id
            WHERE a.assignment_id = %s AND c.instructor_id = %s
        """, (assignment_id, user_id))
        assignment_row = cursor.fetchone()
        if not assignment_row:
            return jsonify({"error": "Assignment not found"}), 404
        max_pts = float(assignment_row[0])

        if course_id and not verify_course_owner(cursor, course_id, user_id):
            return jsonify({"error": "Forbidden"}), 403

        for g in grades:
            sid = g.get("student_id")
            score = g.get("score")
            if sid is None or score is None:
                continue
            if not (0 <= float(score) <= max_pts):
                continue

            fname = g.get("first_name", "")
            mname = g.get("middle_name", "")
            lname = g.get("last_name", "")
            if fname and lname:
                cursor.execute("""
                    INSERT INTO students (student_id, first_name, middle_name, last_name, created_by)
                    VALUES (%s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                        first_name = VALUES(first_name),
                        middle_name = VALUES(middle_name),
                        last_name = VALUES(last_name)
                """, (sid, fname, mname, lname, user_id))

            if course_id:
                cursor.execute(
                    "INSERT IGNORE INTO enrollments (student_id, course_id) VALUES (%s, %s)",
                    (sid, course_id)
                )

            cursor.execute("""
                INSERT INTO assignment_grade (student_id, assignment_id, score)
                VALUES (%s, %s, %s)
                ON DUPLICATE KEY UPDATE score = VALUES(score)
            """, (sid, assignment_id, score))

        conn.commit()
        return jsonify({"message": f"{len(grades)} grades saved"}), 200

    except mysql.connector.Error as err:
        conn.rollback()
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()


# ==================== DELETE ====================

@app.route('/api/courses/<int:course_id>', methods=['DELETE'])
def delete_course(course_id):
    user_id = require_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db()
    cursor = conn.cursor()

    try:
        if not verify_course_owner(cursor, course_id, user_id):
            return jsonify({"error": "Forbidden"}), 403

        cursor.execute("""
            DELETE ag FROM assignment_grade ag
            JOIN assignments a ON ag.assignment_id = a.assignment_id
            WHERE a.course_id = %s
        """, (course_id,))
        cursor.execute("DELETE FROM assignments WHERE course_id = %s", (course_id,))
        cursor.execute("DELETE FROM enrollments WHERE course_id = %s", (course_id,))
        cursor.execute("DELETE FROM courses WHERE course_id = %s AND instructor_id = %s", (course_id, user_id))
        conn.commit()
        return jsonify({"message": "Course deleted"}), 200

    except mysql.connector.Error as err:
        conn.rollback()
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()


@app.route('/api/assignments/<int:assignment_id>', methods=['DELETE'])
def delete_assignment(assignment_id):
    user_id = require_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT 1 FROM assignments a
            JOIN courses c ON a.course_id = c.course_id
            WHERE a.assignment_id = %s AND c.instructor_id = %s
        """, (assignment_id, user_id))
        if not cursor.fetchone():
            return jsonify({"error": "Forbidden"}), 403

        cursor.execute("DELETE FROM assignment_grade WHERE assignment_id = %s", (assignment_id,))
        cursor.execute("DELETE FROM assignments WHERE assignment_id = %s", (assignment_id,))
        conn.commit()
        return jsonify({"message": "Assignment deleted"}), 200

    except mysql.connector.Error as err:
        conn.rollback()
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()


@app.route('/api/students/<int:student_id>', methods=['DELETE'])
def delete_student(student_id):
    user_id = require_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute(
            "SELECT 1 FROM students WHERE student_id = %s AND created_by = %s",
            (student_id, user_id)
        )
        if not cursor.fetchone():
            return jsonify({"error": "Forbidden"}), 403

        cursor.execute("DELETE FROM assignment_grade WHERE student_id = %s", (student_id,))
        cursor.execute("DELETE FROM enrollments WHERE student_id = %s", (student_id,))
        cursor.execute("DELETE FROM students WHERE student_id = %s", (student_id,))
        conn.commit()
        return jsonify({"message": "Student deleted"}), 200

    except mysql.connector.Error as err:
        conn.rollback()
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()


@app.route('/api/grades/<int:score_id>', methods=['DELETE'])
def delete_grade(score_id):
    user_id = require_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT 1 FROM assignment_grade ag
            JOIN assignments a ON ag.assignment_id = a.assignment_id
            JOIN courses c ON a.course_id = c.course_id
            WHERE ag.score_id = %s AND c.instructor_id = %s
        """, (score_id, user_id))
        if not cursor.fetchone():
            return jsonify({"error": "Forbidden"}), 403

        cursor.execute("DELETE FROM assignment_grade WHERE score_id = %s", (score_id,))
        conn.commit()
        return jsonify({"message": "Grade deleted"}), 200

    except mysql.connector.Error as err:
        conn.rollback()
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()


# ==================== AVERAGE ====================

@app.route('/api/average', methods=['GET'])
def get_average():
    user_id = require_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    assignment_id = request.args.get('assignment_id', type=int)

    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    
    try:
        if assignment_id:
            query = """
                SELECT COALESCE(SUM(ag.score), 0) AS total_score,
                       COALESCE(SUM(a.max_points), 0) AS total_possible
                FROM assignment_grade ag
                JOIN assignments a ON ag.assignment_id = a.assignment_id
                JOIN courses c ON a.course_id = c.course_id
                WHERE ag.assignment_id = %s AND c.instructor_id = %s
            """
            cursor.execute(query, (assignment_id, user_id))
        else:
            query = """
                SELECT COALESCE(SUM(ag.score), 0) AS total_score,
                       COALESCE(SUM(a.max_points), 0) AS total_possible
                FROM assignment_grade ag
                JOIN assignments a ON ag.assignment_id = a.assignment_id
                JOIN courses c ON a.course_id = c.course_id
                WHERE c.instructor_id = %s
            """
            cursor.execute(query, (user_id,))

        result = cursor.fetchone()
        total_possible = float(result['total_possible'])
        avg = round(float(result['total_score']) / total_possible * 100, 2) if total_possible > 0 else 0

        return jsonify({"average_score": avg}), 200

    except mysql.connector.Error as err:
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()


# ==================== CSV BULK IMPORT ====================

def _resolve_row_fields(r):
    """Extract and normalise the fields from a single CSV row dict."""
    sid   = int(r["student_id"])   if r.get("student_id")   is not None else None
    fname = (r.get("first_name") or "").strip()
    mname = (r.get("middle_name") or "").strip()
    lname = (r.get("last_name") or "").strip()
    cid   = int(r["course_id"])    if r.get("course_id")    is not None else None
    cname = (r.get("course_name") or "").strip()
    aid   = int(r["assignment_id"])if r.get("assignment_id")is not None else None
    atitle= (r.get("assignment_title") or "").strip()
    max_p = r.get("max_points")
    max_pts = int(max_p) if max_p is not None else 100
    raw_score = r.get("score")
    score = None
    if raw_score is not None:
        score = float(raw_score)
    return sid, fname, mname, lname, cid, cname, aid, atitle, max_pts, score


@app.route('/api/csv/preview', methods=['POST'])
def csv_preview():
    """Analyse CSV rows and return a categorised preview of all changes."""
    user_id = require_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    rows = data.get("rows", [])
    if not rows:
        return jsonify({"error": "No data rows provided"}), 400

    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    try:
        # ---- Phase 1: resolve courses ----
        explicit_cids = {int(r["course_id"]) for r in rows if r.get("course_id") is not None}
        existing_courses = {}
        if explicit_cids:
            fmt = ','.join(['%s'] * len(explicit_cids))
            cursor.execute(
                f"SELECT course_id, course_name FROM courses WHERE course_id IN ({fmt}) AND instructor_id = %s",
                tuple(explicit_cids) + (user_id,))
            for c in cursor.fetchall():
                existing_courses[c['course_id']] = c

        course_names = {r["course_name"].strip() for r in rows
                        if r.get("course_id") is None and r.get("course_name")}
        courses_by_name = {}
        if course_names:
            fmt = ','.join(['%s'] * len(course_names))
            cursor.execute(
                f"SELECT course_id, course_name FROM courses WHERE course_name IN ({fmt}) AND instructor_id = %s",
                tuple(course_names) + (user_id,))
            for c in cursor.fetchall():
                courses_by_name[c['course_name']] = c
                existing_courses[c['course_id']] = c

        new_course_names = sorted(course_names - set(courses_by_name.keys()))
        new_courses_list = [{"course_name": n} for n in new_course_names]

        def resolve_course(cid, cname):
            if cid is not None:
                if cid in existing_courses:
                    return cid, existing_courses[cid]['course_name'], False
                return None, None, False
            if cname:
                if cname in courses_by_name:
                    c = courses_by_name[cname]
                    return c['course_id'], cname, False
                return None, cname, True
            return None, None, False

        # ---- Phase 2: resolve assignments ----
        explicit_aids = {int(r["assignment_id"]) for r in rows if r.get("assignment_id") is not None}
        existing_assignments = {}
        if explicit_aids:
            fmt = ','.join(['%s'] * len(explicit_aids))
            cursor.execute(
                f"""SELECT a.assignment_id, a.title, a.max_points, a.course_id
                    FROM assignments a JOIN courses c ON a.course_id = c.course_id
                    WHERE a.assignment_id IN ({fmt}) AND c.instructor_id = %s""",
                tuple(explicit_aids) + (user_id,))
            for a in cursor.fetchall():
                existing_assignments[a['assignment_id']] = a

        assignments_by_title = {}
        for r in rows:
            if r.get("assignment_id") is not None or not r.get("assignment_title"):
                continue
            cid_r = int(r["course_id"]) if r.get("course_id") is not None else None
            cname_r = (r.get("course_name") or "").strip()
            res_cid, _, is_new = resolve_course(cid_r, cname_r)
            if res_cid is not None and not is_new:
                title = r["assignment_title"].strip()
                if (res_cid, title) not in assignments_by_title:
                    cursor.execute(
                        "SELECT assignment_id, title, max_points, course_id FROM assignments WHERE course_id = %s AND title = %s",
                        (res_cid, title))
                    row = cursor.fetchone()
                    if row:
                        assignments_by_title[(res_cid, title)] = row
                        existing_assignments[row['assignment_id']] = row
                    else:
                        assignments_by_title[(res_cid, title)] = None

        new_assignments_map = {}
        for r in rows:
            if r.get("assignment_id") is not None or not r.get("assignment_title"):
                continue
            cid_r = int(r["course_id"]) if r.get("course_id") is not None else None
            cname_r = (r.get("course_name") or "").strip()
            res_cid, res_cname, is_new_course = resolve_course(cid_r, cname_r)
            title = r["assignment_title"].strip()
            mp = int(r["max_points"]) if r.get("max_points") is not None else 100
            display_course = res_cname or str(res_cid or "")
            if is_new_course:
                key = (cname_r, title)
                if key not in new_assignments_map:
                    new_assignments_map[key] = {"title": title, "max_points": mp, "course_name": display_course}
            elif res_cid is not None:
                if (res_cid, title) in assignments_by_title and assignments_by_title[(res_cid, title)] is not None:
                    pass
                else:
                    key = (display_course, title)
                    if key not in new_assignments_map:
                        new_assignments_map[key] = {"title": title, "max_points": mp, "course_name": display_course}
        new_assignments_list = list(new_assignments_map.values())

        def resolve_assignment(aid, atitle, max_pts, res_cid, res_cname, is_new_course):
            if aid is not None:
                if aid in existing_assignments:
                    a = existing_assignments[aid]
                    return aid, a['title'], float(a['max_points']), False
                return None, None, 100, False
            if atitle:
                if not is_new_course and res_cid is not None:
                    cached = assignments_by_title.get((res_cid, atitle))
                    if cached:
                        return cached['assignment_id'], atitle, float(cached['max_points']), False
                return None, atitle, max_pts, True
            return None, None, 100, False

        # ---- Phase 3: existing students, enrollments, grades ----
        student_ids = {int(r["student_id"]) for r in rows if r.get("student_id") is not None}
        existing_students = {}
        if student_ids:
            fmt = ','.join(['%s'] * len(student_ids))
            cursor.execute(
                f"SELECT student_id, first_name, middle_name, last_name FROM students WHERE student_id IN ({fmt})",
                tuple(student_ids))
            for s in cursor.fetchall():
                existing_students[s['student_id']] = s

        all_known_cids = set(existing_courses.keys())
        existing_enrollments = set()
        if student_ids and all_known_cids:
            fmt_s = ','.join(['%s'] * len(student_ids))
            fmt_c = ','.join(['%s'] * len(all_known_cids))
            cursor.execute(
                f"SELECT student_id, course_id FROM enrollments WHERE student_id IN ({fmt_s}) AND course_id IN ({fmt_c})",
                tuple(student_ids) + tuple(all_known_cids))
            for e in cursor.fetchall():
                existing_enrollments.add((e['student_id'], e['course_id']))

        all_known_aids = set(existing_assignments.keys())
        existing_grades = {}
        if student_ids and all_known_aids:
            fmt_s = ','.join(['%s'] * len(student_ids))
            fmt_a = ','.join(['%s'] * len(all_known_aids))
            cursor.execute(
                f"SELECT student_id, assignment_id, score FROM assignment_grade WHERE student_id IN ({fmt_s}) AND assignment_id IN ({fmt_a})",
                tuple(student_ids) + tuple(all_known_aids))
            for gr in cursor.fetchall():
                existing_grades[(gr['student_id'], gr['assignment_id'])] = float(gr['score'])

        # ---- Phase 4: categorise per-row changes ----
        new_students = []
        updated_students = []
        new_enrollments = []
        new_grades = []
        updated_grades = []
        errors = []
        seen_sids = set()
        seen_enrollments = set()

        for i, r in enumerate(rows):
            row_num = i + 1
            try:
                sid, fname, mname, lname, cid, cname, aid, atitle, max_pts, score = _resolve_row_fields(r)
            except (ValueError, TypeError):
                errors.append({"row": row_num, "message": "Invalid numeric value"})
                continue

            has_name = bool(fname and lname)
            if sid is None and not has_name:
                continue

            res_cid, res_cname, is_new_course = resolve_course(cid, cname)
            res_aid, res_atitle, res_max, is_new_assign = resolve_assignment(
                aid, atitle, max_pts, res_cid, res_cname, is_new_course)

            if cid is not None and cid not in existing_courses:
                errors.append({"row": row_num, "message": f"Course {cid} not found or you don't own it"})
                continue
            if aid is not None and aid not in existing_assignments:
                errors.append({"row": row_num, "message": f"Assignment {aid} not found or not in your courses"})
                continue

            if sid is not None and sid not in seen_sids:
                seen_sids.add(sid)
                if sid in existing_students:
                    es = existing_students[sid]
                    if has_name:
                        old_m = es.get('middle_name') or ''
                        if es['first_name'] != fname or old_m != mname or es['last_name'] != lname:
                            updated_students.append({
                                "student_id": sid,
                                "old_first_name": es['first_name'], "old_middle_name": old_m, "old_last_name": es['last_name'],
                                "new_first_name": fname, "new_middle_name": mname, "new_last_name": lname,
                            })
                else:
                    if has_name:
                        new_students.append({"student_id": sid, "first_name": fname, "middle_name": mname, "last_name": lname})
                    else:
                        errors.append({"row": row_num, "message": f"Student {sid} does not exist and no name provided"})
                        continue
            elif sid is None and has_name:
                new_students.append({"student_id": None, "first_name": fname, "middle_name": mname, "last_name": lname, "auto_id": True})

            student_name = f"{fname} {lname}".strip() if has_name else ""
            if not student_name and sid and sid in existing_students:
                es = existing_students[sid]
                student_name = f"{es['first_name']} {es['last_name']}"

            display_course = res_cname or ""
            if (res_cid is not None or is_new_course) and display_course:
                enroll_key = (sid, res_cid if res_cid else cname)
                if enroll_key not in seen_enrollments:
                    seen_enrollments.add(enroll_key)
                    is_already_enrolled = (not is_new_course and sid is not None
                                          and res_cid is not None
                                          and (sid, res_cid) in existing_enrollments)
                    if not is_already_enrolled:
                        sn = student_name or (f"Student {sid}" if sid else f"{fname} {lname} (new)")
                        new_enrollments.append({
                            "student_id": sid, "student_name": sn,
                            "course_id": res_cid, "course_name": display_course,
                        })

            if (res_aid is not None or is_new_assign) and score is not None:
                if score < 0:
                    errors.append({"row": row_num, "message": "Score cannot be negative"})
                    continue
                a_display = res_atitle or str(aid)
                if is_new_assign:
                    sn = student_name or (f"Student {sid}" if sid else f"{fname} {lname} (new)")
                    new_grades.append({"student_id": sid, "student_name": sn,
                                       "assignment_id": None, "assignment_title": a_display,
                                       "score": score, "max_points": res_max})
                elif sid is not None and res_aid is not None:
                    key = (sid, res_aid)
                    if key in existing_grades:
                        old_score = existing_grades[key]
                        if old_score != score:
                            updated_grades.append({
                                "student_id": sid, "student_name": student_name or f"Student {sid}",
                                "assignment_id": res_aid, "assignment_title": a_display,
                                "old_score": old_score, "new_score": score, "max_points": res_max,
                            })
                    else:
                        new_grades.append({
                            "student_id": sid, "student_name": student_name or f"Student {sid}",
                            "assignment_id": res_aid, "assignment_title": a_display,
                            "score": score, "max_points": res_max,
                        })
                else:
                    sn = f"{fname} {lname} (new)" if not sid else student_name
                    new_grades.append({"student_id": sid, "student_name": sn,
                                       "assignment_id": res_aid, "assignment_title": a_display,
                                       "score": score, "max_points": res_max})

        return jsonify(clean({
            "new_courses": new_courses_list,
            "new_assignments": new_assignments_list,
            "new_students": new_students,
            "updated_students": updated_students,
            "new_enrollments": new_enrollments,
            "new_grades": new_grades,
            "updated_grades": updated_grades,
            "errors": errors,
            "summary": {
                "new_courses": len(new_courses_list),
                "new_assignments": len(new_assignments_list),
                "new_students": len(new_students),
                "updated_students": len(updated_students),
                "new_enrollments": len(new_enrollments),
                "new_grades": len(new_grades),
                "updated_grades": len(updated_grades),
                "errors": len(errors),
            }
        })), 200

    except mysql.connector.Error as err:
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()


@app.route('/api/csv/commit', methods=['POST'])
def csv_commit():
    """Execute the CSV import — create courses/assignments, upsert students, enrollments, grades."""
    user_id = require_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    rows = data.get("rows", [])
    if not rows:
        return jsonify({"error": "No data rows provided"}), 400

    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    try:
        counts = {
            "courses_added": 0, "assignments_added": 0,
            "students_added": 0, "students_updated": 0,
            "enrollments_added": 0,
            "grades_added": 0, "grades_updated": 0,
            "rows_skipped": 0,
        }

        # ---- Phase 1: resolve / create courses ----
        explicit_cids = {int(r["course_id"]) for r in rows if r.get("course_id") is not None}
        owned_courses = set()
        if explicit_cids:
            fmt = ','.join(['%s'] * len(explicit_cids))
            cursor.execute(
                f"SELECT course_id FROM courses WHERE course_id IN ({fmt}) AND instructor_id = %s",
                tuple(explicit_cids) + (user_id,))
            owned_courses = {row['course_id'] for row in cursor.fetchall()}

        unique_cnames = {r["course_name"].strip() for r in rows
                         if r.get("course_id") is None and r.get("course_name")}
        courses_by_name = {}
        if unique_cnames:
            fmt = ','.join(['%s'] * len(unique_cnames))
            cursor.execute(
                f"SELECT course_id, course_name FROM courses WHERE course_name IN ({fmt}) AND instructor_id = %s",
                tuple(unique_cnames) + (user_id,))
            for c in cursor.fetchall():
                courses_by_name[c['course_name']] = c['course_id']
                owned_courses.add(c['course_id'])
        for name in unique_cnames:
            if name not in courses_by_name:
                cursor.execute("INSERT INTO courses (instructor_id, course_name) VALUES (%s, %s)", (user_id, name))
                new_cid = cursor.lastrowid
                courses_by_name[name] = new_cid
                owned_courses.add(new_cid)
                counts["courses_added"] += 1

        # ---- Phase 2: resolve / create assignments ----
        explicit_aids = {int(r["assignment_id"]) for r in rows if r.get("assignment_id") is not None}
        owned_assignments = set()
        if explicit_aids:
            fmt = ','.join(['%s'] * len(explicit_aids))
            cursor.execute(
                f"""SELECT a.assignment_id FROM assignments a
                    JOIN courses c ON a.course_id = c.course_id
                    WHERE a.assignment_id IN ({fmt}) AND c.instructor_id = %s""",
                tuple(explicit_aids) + (user_id,))
            owned_assignments = {row['assignment_id'] for row in cursor.fetchall()}

        assignments_by_key = {}
        for r in rows:
            if r.get("assignment_id") is not None or not r.get("assignment_title"):
                continue
            cid_r = int(r["course_id"]) if r.get("course_id") is not None else None
            cname_r = (r.get("course_name") or "").strip()
            res_cid = cid_r if cid_r in owned_courses else courses_by_name.get(cname_r)
            if res_cid is None:
                continue
            title = r["assignment_title"].strip()
            mp = int(r["max_points"]) if r.get("max_points") is not None else 100
            key = (res_cid, title)
            if key in assignments_by_key:
                continue
            cursor.execute(
                "SELECT assignment_id FROM assignments WHERE course_id = %s AND title = %s",
                (res_cid, title))
            existing = cursor.fetchone()
            if existing:
                assignments_by_key[key] = existing['assignment_id']
                owned_assignments.add(existing['assignment_id'])
            else:
                cursor.execute(
                    "INSERT INTO assignments (course_id, title, max_points) VALUES (%s, %s, %s)",
                    (res_cid, title, mp))
                new_aid = cursor.lastrowid
                assignments_by_key[key] = new_aid
                owned_assignments.add(new_aid)
                counts["assignments_added"] += 1

        # ---- Phase 3: students, enrollments, grades ----
        all_sids = {int(r["student_id"]) for r in rows if r.get("student_id") is not None}
        known_sids = set()
        if all_sids:
            fmt = ','.join(['%s'] * len(all_sids))
            cursor.execute(f"SELECT student_id FROM students WHERE student_id IN ({fmt})", tuple(all_sids))
            known_sids = {row['student_id'] for row in cursor.fetchall()}

        for r in rows:
            try:
                sid, fname, mname, lname, cid, cname, aid, atitle, max_pts, score = _resolve_row_fields(r)
            except (ValueError, TypeError):
                counts["rows_skipped"] += 1
                continue

            if score is not None and score < 0:
                counts["rows_skipped"] += 1
                continue

            has_name = bool(fname and lname)
            if sid is None and not has_name:
                continue

            if has_name:
                if sid is not None:
                    cursor.execute("""
                        INSERT INTO students (student_id, first_name, middle_name, last_name, created_by)
                        VALUES (%s, %s, %s, %s, %s)
                        ON DUPLICATE KEY UPDATE
                            first_name = VALUES(first_name),
                            middle_name = VALUES(middle_name),
                            last_name = VALUES(last_name)
                    """, (sid, fname, mname, lname, user_id))
                    known_sids.add(sid)
                    if cursor.rowcount == 1:
                        counts["students_added"] += 1
                    elif cursor.rowcount == 2:
                        counts["students_updated"] += 1
                else:
                    cursor.execute(
                        "INSERT INTO students (first_name, middle_name, last_name, created_by) VALUES (%s, %s, %s, %s)",
                        (fname, mname, lname, user_id))
                    sid = cursor.lastrowid
                    known_sids.add(sid)
                    counts["students_added"] += 1
            elif sid is not None:
                if sid not in known_sids:
                    counts["rows_skipped"] += 1
                    continue
            else:
                continue

            res_cid = cid if cid in owned_courses else courses_by_name.get(cname)
            if res_cid is not None:
                cursor.execute(
                    "INSERT IGNORE INTO enrollments (student_id, course_id) VALUES (%s, %s)",
                    (sid, res_cid))
                if cursor.rowcount == 1:
                    counts["enrollments_added"] += 1

            res_aid = aid if aid in owned_assignments else None
            if res_aid is None and atitle and res_cid is not None:
                res_aid = assignments_by_key.get((res_cid, atitle))

            if res_aid is not None and score is not None:
                cursor.execute("""
                    INSERT INTO assignment_grade (student_id, assignment_id, score)
                    VALUES (%s, %s, %s)
                    ON DUPLICATE KEY UPDATE score = VALUES(score)
                """, (sid, res_aid, score))
                if cursor.rowcount == 1:
                    counts["grades_added"] += 1
                elif cursor.rowcount == 2:
                    counts["grades_updated"] += 1

        conn.commit()
        return jsonify({"message": "Import completed", **counts}), 200

    except mysql.connector.Error as err:
        conn.rollback()
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()



@app.before_request
def ensure_db():
    global db_pool
    if db_pool is None:
        init_pool()
    if 'db' not in g:
        g.db = db_pool.get_connection()
