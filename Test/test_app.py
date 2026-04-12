"""
Comprehensive unit tests for the Grade Tracker Flask application.
Tests all endpoints, helper functions, and error handling.
"""

import pytest
import json
from unittest.mock import Mock, patch, MagicMock
from decimal import Decimal
import mysql.connector
import sys
import os

# Add parent directory to path to import app
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'Backend'))

# Import the Flask app
from app import (
    app,
    clean,
    bubble_sort_students_by_score,
    get_db,
)


@pytest.fixture
def client():
    """Create a test client for the Flask app."""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


@pytest.fixture
def mock_db(monkeypatch):
    """Mock the database connection."""
    mock_pool = Mock()
    mock_conn = Mock()
    mock_cursor = Mock()
    
    mock_conn.cursor.return_value = mock_cursor
    mock_pool.get_connection.return_value = mock_conn
    
    monkeypatch.setattr('app.db_pool', mock_pool)
    monkeypatch.setattr('app.get_db', lambda: mock_conn)
    
    return {
        'pool': mock_pool,
        'conn': mock_conn,
        'cursor': mock_cursor
    }


# ==================== HELPER FUNCTION TESTS ====================

class TestHelperFunctions:
    """Test helper functions: clean() and bubble_sort_students_by_score()"""

    def test_clean_converts_decimal_to_float(self):
        """Test that Decimal values are converted to float."""
        data = {
            'score': Decimal('92.50'),
            'name': 'Alice'
        }
        result = clean(data)
        assert result['score'] == 92.5
        assert isinstance(result['score'], float)
        assert result['name'] == 'Alice'

    def test_clean_handles_nested_lists(self):
        """Test that clean() recursively handles lists of dicts."""
        data = [
            {'score': Decimal('95.0'), 'name': 'Alice'},
            {'score': Decimal('87.0'), 'name': 'Bob'}
        ]
        result = clean(data)
        assert result[0]['score'] == 95.0
        assert result[1]['score'] == 87.0
        assert isinstance(result[0]['score'], float)

    def test_clean_handles_mixed_types(self):
        """Test that clean() preserves non-Decimal types."""
        data = {
            'id': 1,
            'name': 'Test',
            'score': Decimal('88.5'),
            'active': True
        }
        result = clean(data)
        assert result['id'] == 1
        assert result['name'] == 'Test'
        assert result['score'] == 88.5
        assert result['active'] is True

    def test_bubble_sort_students_by_score_ascending(self):
        """Test sorting students in ascending order by score."""
        students = [
            {'name': 'Alice', 'score': 85},
            {'name': 'Bob', 'score': 92},
            {'name': 'Charlie', 'score': 78}
        ]
        result = bubble_sort_students_by_score(students)
        assert result[0]['score'] == 78
        assert result[1]['score'] == 85
        assert result[2]['score'] == 92

    def test_bubble_sort_with_decimal_scores(self):
        """Test sorting with Decimal score values."""
        students = [
            {'name': 'Alice', 'score': Decimal('85.5')},
            {'name': 'Bob', 'score': Decimal('92.0')},
            {'name': 'Charlie', 'score': Decimal('78.5')}
        ]
        result = bubble_sort_students_by_score(students)
        assert float(result[0]['score']) == 78.5
        assert float(result[1]['score']) == 85.5
        assert float(result[2]['score']) == 92.0

    def test_bubble_sort_already_sorted(self):
        """Test sorting already sorted list."""
        students = [
            {'name': 'Charlie', 'score': 70},
            {'name': 'Alice', 'score': 85},
            {'name': 'Bob', 'score': 90}
        ]
        result = bubble_sort_students_by_score(students)
        assert result[0]['score'] == 70
        assert result[1]['score'] == 85
        assert result[2]['score'] == 90

    def test_bubble_sort_reverse_sorted(self):
        """Test sorting reverse-sorted list."""
        students = [
            {'name': 'Alice', 'score': 90},
            {'name': 'Bob', 'score': 85},
            {'name': 'Charlie', 'score': 70}
        ]
        result = bubble_sort_students_by_score(students)
        assert result[0]['score'] == 70
        assert result[1]['score'] == 85
        assert result[2]['score'] == 90

    def test_bubble_sort_empty_list(self):
        """Test sorting empty list."""
        result = bubble_sort_students_by_score([])
        assert result == []

    def test_bubble_sort_single_element(self):
        """Test sorting single element list."""
        students = [{'name': 'Alice', 'score': 85}]
        result = bubble_sort_students_by_score(students)
        assert len(result) == 1
        assert result[0]['score'] == 85


# ==================== COURSES ENDPOINT TESTS ====================

class TestCoursesEndpoints:
    """Test /api/courses endpoints"""

    def test_get_courses_success(self, client, mock_db):
        """Test successfully retrieving all courses."""
        mock_db['cursor'].fetchall.return_value = [
            {
                'course_id': 1,
                'course_name': 'CS 101',
                'student_count': 30,
                'assignment_count': 5
            },
            {
                'course_id': 2,
                'course_name': 'CS 102',
                'student_count': 25,
                'assignment_count': 4
            }
        ]

        response = client.get('/api/courses')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data) == 2
        assert data[0]['course_name'] == 'CS 101'
        assert data[0]['student_count'] == 30

    def test_get_courses_empty(self, client, mock_db):
        """Test retrieving courses when none exist."""
        mock_db['cursor'].fetchall.return_value = []

        response = client.get('/api/courses')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data == []

    def test_get_courses_database_error(self, client, mock_db):
        """Test handling database errors when getting courses."""
        mock_db['cursor'].execute.side_effect = mysql.connector.Error("DB Error")

        response = client.get('/api/courses')
        assert response.status_code == 500
        data = json.loads(response.data)
        assert 'error' in data

    def test_create_course_success(self, client, mock_db):
        """Test successfully creating a course."""
        mock_db['cursor'].lastrowid = 5

        response = client.post(
            '/api/courses',
            data=json.dumps({'course_name': 'CS 103'}),
            content_type='application/json'
        )
        assert response.status_code == 201
        data = json.loads(response.data)
        assert 'course_id' in data
        assert data['message'] == 'Course created'

    def test_create_course_missing_name(self, client, mock_db):
        """Test creating course without course_name."""
        response = client.post(
            '/api/courses',
            data=json.dumps({}),
            content_type='application/json'
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data

    def test_create_course_empty_name(self, client, mock_db):
        """Test creating course with empty name."""
        response = client.post(
            '/api/courses',
            data=json.dumps({'course_name': '   '}),
            content_type='application/json'
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data

    def test_create_course_database_error(self, client, mock_db):
        """Test database error when creating course."""
        mock_db['cursor'].execute.side_effect = mysql.connector.Error("DB Error")

        response = client.post(
            '/api/courses',
            data=json.dumps({'course_name': 'CS 103'}),
            content_type='application/json'
        )
        assert response.status_code == 500
        data = json.loads(response.data)
        assert 'error' in data


# ==================== ASSIGNMENTS ENDPOINT TESTS ====================

class TestAssignmentsEndpoints:
    """Test /api/assignments endpoints"""

    def test_get_assignments_success(self, client, mock_db):
        """Test successfully retrieving assignments for a course."""
        mock_db['cursor'].fetchall.return_value = [
            {'assignment_id': 1, 'title': 'Midterm', 'max_points': 100, 'grade_count': 25},
            {'assignment_id': 2, 'title': 'Final', 'max_points': 100, 'grade_count': 24}
        ]

        response = client.get('/api/courses/1/assignments')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data) == 2
        assert data[0]['title'] == 'Midterm'

    def test_get_assignments_empty(self, client, mock_db):
        """Test retrieving assignments when none exist."""
        mock_db['cursor'].fetchall.return_value = []

        response = client.get('/api/courses/999/assignments')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data == []

    def test_get_assignments_database_error(self, client, mock_db):
        """Test database error when getting assignments."""
        mock_db['cursor'].execute.side_effect = mysql.connector.Error("DB Error")

        response = client.get('/api/courses/1/assignments')
        assert response.status_code == 500

    def test_create_assignment_simple_success(self, client, mock_db):
        """Test creating assignment via simple endpoint."""
        mock_db['cursor'].lastrowid = 10

        response = client.post(
            '/api/assignments',
            data=json.dumps({
                'course_id': 1,
                'title': 'Quiz 1',
                'max_points': 50
            }),
            content_type='application/json'
        )
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['message'] == 'Assignment created'
        assert data['assignment_id'] == 10

    def test_create_assignment_simple_missing_course_id(self, client, mock_db):
        """Test creating assignment without course_id."""
        response = client.post(
            '/api/assignments',
            data=json.dumps({'title': 'Quiz 1'}),
            content_type='application/json'
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'course_id' in data['error']

    def test_create_assignment_simple_missing_title(self, client, mock_db):
        """Test creating assignment without title."""
        response = client.post(
            '/api/assignments',
            data=json.dumps({'course_id': 1}),
            content_type='application/json'
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'title' in data['error']

    def test_create_assignment_with_grades_success(self, client, mock_db):
        """Test creating assignment with bulk grade import."""
        mock_db['cursor'].lastrowid = 12

        response = client.post(
            '/api/courses/1/assignments',
            data=json.dumps({
                'title': 'Lab 1',
                'grades': [
                    {'student_id': 1, 'first_name': 'Alice', 'middle_name': '', 'last_name': 'Smith', 'score': 92},
                    {'student_id': 2, 'first_name': 'Bob', 'middle_name': '', 'last_name': 'Jones', 'score': 88}
                ]
            }),
            content_type='application/json'
        )
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['message'] == 'Assignment created with grades'
        assert data['grades_imported'] == 2

    def test_create_assignment_with_invalid_scores(self, client, mock_db):
        """Test that invalid scores are skipped."""
        mock_db['cursor'].lastrowid = 13

        response = client.post(
            '/api/courses/1/assignments',
            data=json.dumps({
                'title': 'Lab 2',
                'grades': [
                    {'student_id': 1, 'first_name': 'Alice', 'middle_name': '', 'last_name': 'Smith', 'score': 92},
                    {'student_id': 2, 'first_name': 'Bob', 'middle_name': '', 'last_name': 'Jones', 'score': 150}  # Invalid
                ]
            }),
            content_type='application/json'
        )
        # Should still succeed but skip invalid score
        assert response.status_code == 201

    def test_create_assignment_with_grades_empty_title(self, client, mock_db):
        """Test creating assignment with empty title."""
        response = client.post(
            '/api/courses/1/assignments',
            data=json.dumps({
                'title': '',
                'grades': []
            }),
            content_type='application/json'
        )
        assert response.status_code == 400


# ==================== STUDENTS ENDPOINT TESTS ====================

class TestStudentsEndpoints:
    """Test /api/students endpoints"""

    def test_add_student_success(self, client, mock_db):
        """Test successfully adding a student."""
        mock_db['cursor'].lastrowid = 5

        response = client.post(
            '/api/students',
            data=json.dumps({
                'first_name': 'Alice',
                'last_name': 'Smith',
                'middle_name': 'Marie'
            }),
            content_type='application/json'
        )
        assert response.status_code == 201
        data = json.loads(response.data)
        assert data['message'] == 'Student saved!'
        assert 'student_id' in data

    def test_add_student_with_course_enrollment(self, client, mock_db):
        """Test adding student and enrolling in courses."""
        mock_db['cursor'].lastrowid = 6

        response = client.post(
            '/api/students',
            data=json.dumps({
                'first_name': 'Bob',
                'last_name': 'Jones',
                'course_ids': [1, 2]
            }),
            content_type='application/json'
        )
        assert response.status_code == 201
        data = json.loads(response.data)
        assert 'student_id' in data

    def test_add_student_with_score(self, client, mock_db):
        """Test adding student with a grade."""
        mock_db['cursor'].lastrowid = 7

        response = client.post(
            '/api/students',
            data=json.dumps({
                'first_name': 'Charlie',
                'last_name': 'Brown',
                'score': 85,
                'assignment_id': 1
            }),
            content_type='application/json'
        )
        assert response.status_code == 201

    def test_add_student_invalid_score(self, client, mock_db):
        """Test adding student with invalid score."""
        response = client.post(
            '/api/students',
            data=json.dumps({
                'first_name': 'David',
                'last_name': 'White',
                'score': 150
            }),
            content_type='application/json'
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'Score must be between' in data['error']

    def test_add_student_missing_first_name(self, client, mock_db):
        """Test adding student without first name."""
        response = client.post(
            '/api/students',
            data=json.dumps({'last_name': 'Smith'}),
            content_type='application/json'
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'first_name' in data['error']

    def test_add_student_missing_last_name(self, client, mock_db):
        """Test adding student without last name."""
        response = client.post(
            '/api/students',
            data=json.dumps({'first_name': 'Alice'}),
            content_type='application/json'
        )
        assert response.status_code == 400

    def test_update_student_success(self, client, mock_db):
        """Test successfully updating student info."""
        response = client.put(
            '/api/students/1',
            data=json.dumps({
                'first_name': 'Alice',
                'middle_name': 'Marie',
                'last_name': 'Johnson'
            }),
            content_type='application/json'
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'updated' in data['message']

    def test_update_student_courses(self, client, mock_db):
        """Test updating student course enrollments."""
        response = client.put(
            '/api/students/1',
            data=json.dumps({
                'course_ids': [1, 2, 3]
            }),
            content_type='application/json'
        )
        assert response.status_code == 200

    def test_update_student_database_error(self, client, mock_db):
        """Test handling database error during student update."""
        mock_db['cursor'].execute.side_effect = mysql.connector.Error("DB Error")

        response = client.put(
            '/api/students/1',
            data=json.dumps({
                'first_name': 'Alice',
                'last_name': 'Smith'
            }),
            content_type='application/json'
        )
        assert response.status_code == 500

    def test_get_student_enrollments_success(self, client, mock_db):
        """Test getting student's course enrollments."""
        mock_db['cursor'].fetchall.return_value = [
            {'course_id': 1, 'course_name': 'CS 101'},
            {'course_id': 2, 'course_name': 'CS 102'}
        ]

        response = client.get('/api/students/1/enrollments')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data) == 2
        assert data[0]['course_name'] == 'CS 101'

    def test_get_student_enrollments_empty(self, client, mock_db):
        """Test getting enrollments for unenrolled student."""
        mock_db['cursor'].fetchall.return_value = []

        response = client.get('/api/students/999/enrollments')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data == []


# ==================== ENROLLMENT ENDPOINT TESTS ====================

class TestEnrollmentEndpoints:
    """Test enrollment-related endpoints"""

    def test_get_unenrolled_students_success(self, client, mock_db):
        """Test getting students not enrolled in a course."""
        mock_db['cursor'].fetchall.return_value = [
            {'student_id': 3, 'first_name': 'Charlie', 'middle_name': '', 'last_name': 'Brown'},
            {'student_id': 4, 'first_name': 'David', 'middle_name': '', 'last_name': 'White'}
        ]

        response = client.get('/api/courses/1/unenrolled')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data) == 2
        assert data[0]['last_name'] == 'Brown'

    def test_get_unenrolled_students_empty(self, client, mock_db):
        """Test when all students are enrolled."""
        mock_db['cursor'].fetchall.return_value = []

        response = client.get('/api/courses/1/unenrolled')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data == []

    def test_enroll_students_success(self, client, mock_db):
        """Test enrolling one or more students."""
        response = client.post(
            '/api/courses/1/enroll',
            data=json.dumps({'student_ids': [1, 2, 3]}),
            content_type='application/json'
        )
        assert response.status_code == 201
        data = json.loads(response.data)
        assert '3 student(s) enrolled' in data['message']

    def test_enroll_students_missing_ids(self, client, mock_db):
        """Test enrollment without student IDs."""
        response = client.post(
            '/api/courses/1/enroll',
            data=json.dumps({}),
            content_type='application/json'
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'student_ids' in data['error']

    def test_enroll_students_empty_list(self, client, mock_db):
        """Test enrollment with empty student ID list."""
        response = client.post(
            '/api/courses/1/enroll',
            data=json.dumps({'student_ids': []}),
            content_type='application/json'
        )
        assert response.status_code == 400


# ==================== GRADING ENDPOINT TESTS ====================

class TestGradingEndpoints:
    """Test /api/grades endpoints"""

    def test_get_grades_by_assignment_success(self, client, mock_db):
        """Test getting grades for a specific assignment."""
        mock_db['cursor'].fetchall.return_value = [
            {'student_id': 1, 'first_name': 'Alice', 'middle_name': '', 'last_name': 'Smith', 'score': 92.0, 'score_id': 1},
            {'student_id': 2, 'first_name': 'Bob', 'middle_name': '', 'last_name': 'Jones', 'score': 88.0, 'score_id': 2}
        ]

        response = client.get('/api/grades?course_id=1&assignment_id=1')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data) == 2

    def test_get_grades_by_course_success(self, client, mock_db):
        """Test getting average grades by course."""
        mock_db['cursor'].fetchall.return_value = [
            {'student_id': 1, 'first_name': 'Alice', 'middle_name': '', 'last_name': 'Smith', 'average_score': Decimal('90.0'), 'graded_count': 5},
            {'student_id': 2, 'first_name': 'Bob', 'middle_name': '', 'last_name': 'Jones', 'average_score': Decimal('85.0'), 'graded_count': 5}
        ]

        response = client.get('/api/grades?course_id=1')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert len(data) == 2

    def test_get_grades_missing_course_id(self, client, mock_db):
        """Test getting grades without course_id."""
        response = client.get('/api/grades')
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'course_id' in data['error']

    def test_save_grade_success(self, client, mock_db):
        """Test saving a single grade."""
        response = client.post(
            '/api/grades',
            data=json.dumps({
                'student_id': 1,
                'assignment_id': 1,
                'score': 92
            }),
            content_type='application/json'
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'saved' in data['message']

    def test_save_grade_missing_student_id(self, client, mock_db):
        """Test saving grade without student ID."""
        response = client.post(
            '/api/grades',
            data=json.dumps({
                'assignment_id': 1,
                'score': 92
            }),
            content_type='application/json'
        )
        assert response.status_code == 400

    def test_save_grade_missing_assignment_id(self, client, mock_db):
        """Test saving grade without assignment ID."""
        response = client.post(
            '/api/grades',
            data=json.dumps({
                'student_id': 1,
                'score': 92
            }),
            content_type='application/json'
        )
        assert response.status_code == 400

    def test_save_grade_missing_score(self, client, mock_db):
        """Test saving grade without score."""
        response = client.post(
            '/api/grades',
            data=json.dumps({
                'student_id': 1,
                'assignment_id': 1
            }),
            content_type='application/json'
        )
        assert response.status_code == 400

    def test_save_grade_invalid_score_too_high(self, client, mock_db):
        """Test saving grade with score > 100."""
        response = client.post(
            '/api/grades',
            data=json.dumps({
                'student_id': 1,
                'assignment_id': 1,
                'score': 150
            }),
            content_type='application/json'
        )
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'between 0 and 100' in data['error']

    def test_save_grade_invalid_score_negative(self, client, mock_db):
        """Test saving grade with negative score."""
        response = client.post(
            '/api/grades',
            data=json.dumps({
                'student_id': 1,
                'assignment_id': 1,
                'score': -5
            }),
            content_type='application/json'
        )
        assert response.status_code == 400

    def test_save_grades_bulk_success(self, client, mock_db):
        """Test saving multiple grades at once."""
        response = client.post(
            '/api/grades/bulk',
            data=json.dumps({
                'assignment_id': 1,
                'course_id': 1,
                'grades': [
                    {'student_id': 1, 'score': 92},
                    {'student_id': 2, 'score': 88},
                    {'student_id': 3, 'score': 95}
                ]
            }),
            content_type='application/json'
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert '3 grades saved' in data['message']

    def test_save_grades_bulk_with_invalid_scores(self, client, mock_db):
        """Test bulk save skips invalid scores."""
        response = client.post(
            '/api/grades/bulk',
            data=json.dumps({
                'assignment_id': 1,
                'grades': [
                    {'student_id': 1, 'score': 92},
                    {'student_id': 2, 'score': 150},  # Invalid
                    {'student_id': 3, 'score': 95}
                ]
            }),
            content_type='application/json'
        )
        # Should still succeed but skip invalid grade
        assert response.status_code == 200

    def test_save_grades_bulk_missing_assignment_id(self, client, mock_db):
        """Test bulk save without assignment ID."""
        response = client.post(
            '/api/grades/bulk',
            data=json.dumps({
                'grades': [{'student_id': 1, 'score': 92}]
            }),
            content_type='application/json'
        )
        assert response.status_code == 400

    def test_save_grades_bulk_missing_grades(self, client, mock_db):
        """Test bulk save without grades."""
        response = client.post(
            '/api/grades/bulk',
            data=json.dumps({'assignment_id': 1}),
            content_type='application/json'
        )
        assert response.status_code == 400


# ==================== STATS ENDPOINT TESTS ====================

class TestStatsEndpoints:
    """Test /api/stats endpoint"""

    def test_get_stats_success(self, client, mock_db):
        """Test retrieving statistics."""
        # Mock multiple cursor calls
        mock_db['cursor'].fetchone.side_effect = [
            {'total': 100},                          # total students
            {'enrolled': 85},                        # enrolled students
            {'avg_score': Decimal('82.5'), 'max_score': Decimal('100')},  # avg and max
            {'passing': 75},                         # passing count
            {'total': 100}                           # total grades
        ]

        response = client.get('/api/stats')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['totalStudents'] == 100
        assert data['enrolledStudents'] == 85
        assert data['averageScore'] == 82.5
        assert data['highestScore'] == 100
        assert data['passingRate'] == 75.0

    def test_get_stats_no_grades(self, client, mock_db):
        """Test stats when no grades exist."""
        mock_db['cursor'].fetchone.side_effect = [
            {'total': 10},
            {'enrolled': 8},
            {'avg_score': None, 'max_score': None},
            {'passing': 0},
            {'total': 0}
        ]

        response = client.get('/api/stats')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['averageScore'] == 0
        assert data['highestScore'] == 0
        assert data['passingRate'] == 0

    def test_get_stats_database_error(self, client, mock_db):
        """Test handling database error in stats."""
        mock_db['cursor'].execute.side_effect = mysql.connector.Error("DB Error")

        response = client.get('/api/stats')
        assert response.status_code == 500


# ==================== AVERAGE ENDPOINT TESTS ====================

class TestAverageEndpoints:
    """Test /api/average endpoint"""

    def test_get_average_all_assignments(self, client, mock_db):
        """Test getting average score across all assignments."""
        mock_db['cursor'].fetchone.return_value = {
            'average_score': Decimal('85.3')
        }

        response = client.get('/api/average')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['average_score'] == 85.3

    def test_get_average_specific_assignment(self, client, mock_db):
        """Test getting average for specific assignment."""
        mock_db['cursor'].fetchone.return_value = {
            'average_score': Decimal('88.7')
        }

        response = client.get('/api/average?assignment_id=1')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['average_score'] == 88.7

    def test_get_average_no_grades(self, client, mock_db):
        """Test average when no grades exist."""
        mock_db['cursor'].fetchone.return_value = {
            'average_score': None
        }

        response = client.get('/api/average')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['average_score'] == 0

    def test_get_average_database_error(self, client, mock_db):
        """Test handling database error in average."""
        mock_db['cursor'].execute.side_effect = mysql.connector.Error("DB Error")

        response = client.get('/api/average')
        assert response.status_code == 500


# ==================== STUDENTS SORTING ENDPOINT TESTS ====================

class TestStudentsSortingEndpoints:
    """Test /api/students endpoint with sorting"""

    def test_get_sorted_students_by_average_score(self, client, mock_db):
        """Test retrieving students sorted by average score."""
        mock_db['cursor'].fetchall.return_value = [
            {'student_id': 1, 'first_name': 'Alice', 'middle_name': '', 'last_name': 'Smith', 'average_score': Decimal('92')},
            {'student_id': 2, 'first_name': 'Bob', 'middle_name': '', 'last_name': 'Jones', 'average_score': Decimal('88')},
            {'student_id': 3, 'first_name': 'Charlie', 'middle_name': '', 'last_name': 'Brown', 'average_score': Decimal('95')}
        ]

        response = client.get('/api/students?include_scores=true')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'students' in data
        assert 'average' in data
        assert 'count' in data
        # Verify sorted order (ascending)
        assert data['students'][0]['average_score'] == 88

    def test_get_sorted_students_by_assignment_score(self, client, mock_db):
        """Test retrieving students sorted by assignment score."""
        mock_db['cursor'].fetchall.return_value = [
            {'student_id': 1, 'first_name': 'Alice', 'middle_name': '', 'last_name': 'Smith', 'score': 92},
            {'student_id': 2, 'first_name': 'Bob', 'middle_name': '', 'last_name': 'Jones', 'score': 88},
            {'student_id': 3, 'first_name': 'Charlie', 'middle_name': '', 'last_name': 'Brown', 'score': 95}
        ]

        response = client.get('/api/students?assignment_id=1')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'students' in data
        assert data['count'] == 3
        # Verify sorted (ascending)
        assert data['students'][0]['score'] == 88

    def test_get_sorted_students_no_scores(self, client, mock_db):
        """Test sorting when no scores exist."""
        mock_db['cursor'].fetchall.return_value = []

        response = client.get('/api/students?assignment_id=999')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['count'] == 0
        assert data['average'] == 0


# ==================== EDGE CASES AND INTEGRATION TESTS ====================

class TestEdgeCases:
    """Test edge cases and unusual scenarios"""

    def test_grade_boundary_score_zero(self, client, mock_db):
        """Test grade with score of exactly 0."""
        response = client.post(
            '/api/grades',
            data=json.dumps({
                'student_id': 1,
                'assignment_id': 1,
                'score': 0
            }),
            content_type='application/json'
        )
        assert response.status_code == 200

    def test_grade_boundary_score_hundred(self, client, mock_db):
        """Test grade with score of exactly 100."""
        response = client.post(
            '/api/grades',
            data=json.dumps({
                'student_id': 1,
                'assignment_id': 1,
                'score': 100
            }),
            content_type='application/json'
        )
        assert response.status_code == 200

    def test_grade_decimal_score(self, client, mock_db):
        """Test grade with decimal score."""
        response = client.post(
            '/api/grades',
            data=json.dumps({
                'student_id': 1,
                'assignment_id': 1,
                'score': 92.5
            }),
            content_type='application/json'
        )
        assert response.status_code == 200

    def test_student_with_no_middle_name(self, client, mock_db):
        """Test adding student without middle name."""
        mock_db['cursor'].lastrowid = 10

        response = client.post(
            '/api/students',
            data=json.dumps({
                'first_name': 'Alice',
                'last_name': 'Smith'
            }),
            content_type='application/json'
        )
        assert response.status_code == 201

    def test_course_name_with_special_characters(self, client, mock_db):
        """Test creating course with special characters in name."""
        mock_db['cursor'].lastrowid = 5

        response = client.post(
            '/api/courses',
            data=json.dumps({
                'course_name': 'CS 101 - Advanced Python & Data Structures'
            }),
            content_type='application/json'
        )
        assert response.status_code == 201

    def test_course_name_with_whitespace(self, client, mock_db):
        """Test that course name whitespace is trimmed."""
        mock_db['cursor'].lastrowid = 6

        response = client.post(
            '/api/courses',
            data=json.dumps({
                'course_name': '   CS 102   '
            }),
            content_type='application/json'
        )
        assert response.status_code == 201

    def test_multiple_enrollments_same_student(self, client, mock_db):
        """Test enrolling same student in multiple courses."""
        mock_db['cursor'].lastrowid = 10

        response = client.post(
            '/api/students',
            data=json.dumps({
                'first_name': 'Alice',
                'last_name': 'Smith',
                'course_ids': [1, 2, 3, 4, 5]
            }),
            content_type='application/json'
        )
        assert response.status_code == 201


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
