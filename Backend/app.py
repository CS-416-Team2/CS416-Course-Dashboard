import mysql.connector
from mysql.connector import pooling
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from dotenv import dotenv_values
from decimal import Decimal
import os
import sys

app = Flask(__name__)
CORS(app)

# --- DATABASE CONNECTION POOL ---
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


if __name__ == '__main__':
    init_pool()
    seed_default_user()
    app.run(host='0.0.0.0', port=5000, debug=True)