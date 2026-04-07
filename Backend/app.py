import mysql.connector
from flask import Flask, request, jsonify

app = Flask(__name__)

# --- DATABASE CONNECTION HELPER (Local Version) ---
def get_db_connection():
    # Update these with your local MySQL credentials!
    return mysql.connector.connect(
        host="localhost", # Points to your local machine
        user="root",      # Default local MySQL user
        password="SchoolBurd6.", # Your local password
        database="project2"
    )

# --- CUSTOM SORTING ALGORITHM (Assignment #3) ---
def bubble_sort_students_by_score(data):
    n = len(data)
    for i in range(n):
        for j in range(0, n - i - 1):
            if data[j]['score'] > data[j + 1]['score']:
                data[j], data[j + 1] = data[j + 1], data[j]
    return data


# --- API ROUTES ---

@app.route('/api/students', methods=['POST'])
def add_student_data():
    data = request.get_json()
    student_id = data.get("student_id")
    score = data.get("score")

    if not (1 <= student_id <= 10):
        return jsonify({"error": "Student ID must be between 1 and 10"}), 400
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
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True) # dictionary=True makes rows look like JSON
    
    # SQL JOIN to get student info and their scores
    query = """
        SELECT s.student_id, s.first_name, s.last_name, ag.score 
        FROM students s
        JOIN assignment_grade ag ON s.student_id = ag.student_id
    """
    cursor.execute(query)
    students_data = cursor.fetchall()
    
    cursor.close()
    conn.close()

    # Pass the DB results through your sorting algorithm
    sorted_data = bubble_sort_students_by_score(students_data)
    
    return jsonify(sorted_data), 200


@app.route('/api/average', methods=['GET'])
def get_average():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # Let MySQL do the math for you!
    query = "SELECT AVG(score) as average_score FROM assignment_grade"
    cursor.execute(query)
    result = cursor.fetchone()
    
    cursor.close()
    conn.close()
    
    # Handle the case where the DB is empty (AVG returns None)
    avg = result['average_score'] if result['average_score'] is not None else 0
    
    # Convert Decimal to float for JSON serialization
    return jsonify({"average_score": round(float(avg), 2)}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)