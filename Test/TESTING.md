# Grade Tracker Backend - Testing Guide

## Overview

Comprehensive unit tests for the Grade Tracker Flask application covering:
- Helper functions (`clean()`, `bubble_sort_students_by_score()`)
- All API endpoints (Courses, Assignments, Students, Enrollments, Grades, Stats)
- Input validation and error handling
- Edge cases and boundary conditions
- Database error scenarios

**Total: 62 test cases**

## Test Coverage

### 1. Helper Functions (8 tests)
- `clean()` function - Decimal to float conversion
- `bubble_sort_students_by_score()` - Sorting algorithm tests

### 2. Courses Endpoints (6 tests)
- `GET /api/courses` - Retrieve all courses
- `POST /api/courses` - Create new course
- Error handling and validation

### 3. Assignments Endpoints (7 tests)
- `GET /api/courses/<course_id>/assignments` - Retrieve assignments
- `POST /api/assignments` - Create simple assignment
- `POST /api/courses/<course_id>/assignments` - Create assignment with bulk grades
- Invalid input validation

### 4. Students Endpoints (10 tests)
- `POST /api/students` - Add student with optional enrollment
- `PUT /api/students/<student_id>` - Update student info
- `GET /api/students/<student_id>/enrollments` - Get student enrollments
- Score validation and database error handling

### 5. Enrollment Endpoints (5 tests)
- `GET /api/courses/<course_id>/unenrolled` - Get unenrolled students
- `POST /api/courses/<course_id>/enroll` - Bulk enroll students

### 6. Grades Endpoints (11 tests)
- `GET /api/grades` - Get grades by course/assignment
- `POST /api/grades` - Save single grade
- `POST /api/grades/bulk` - Save multiple grades
- Score validation (0-100 range)

### 7. Stats Endpoint (3 tests)
- `GET /api/stats` - Retrieve dashboard statistics
- Handling empty data scenarios

### 8. Average Endpoint (3 tests)
- `GET /api/average` - Get average scores
- Optional assignment filtering

### 9. Student Sorting Endpoints (3 tests)
- Sorting by average score
- Sorting by assignment score

### 10. Edge Cases (6 tests)
- Boundary scores (0 and 100)
- Decimal scores
- Special characters in names
- Multiple enrollments

## Setup & Installation

### Prerequisites
- Python 3.8+
- pip

### 1. Install Testing Dependencies

```bash
pip install -r requirements-test.txt
```

Or install just the test tools:

```bash
pip install pytest==7.4.3 pytest-cov==4.1.0 pytest-mock==3.12.0
```

## Running Tests

### Run All Tests
```bash
pytest test_app.py -v
```

### Run with Coverage Report
```bash
pytest test_app.py --cov=app --cov-report=html -v
```
*Coverage report will be generated in `htmlcov/index.html`*

### Run Specific Test Class
```bash
pytest test_app.py::TestCoursesEndpoints -v
```

### Run Specific Test
```bash
pytest test_app.py::TestGradingEndpoints::test_save_grade_success -v
```

### Run with Output (including print statements)
```bash
pytest test_app.py -v -s
```

### Run with Short Traceback
```bash
pytest test_app.py --tb=short
```

## Test Structure

Each test file contains:

```python
@pytest.fixture
def client():
    """Create a test client for the Flask app"""
    # Setup test client
    
@pytest.fixture
def mock_db(monkeypatch):
    """Mock the database connection"""
    # Setup database mocks
```

### Test Organization

Tests are organized by endpoint:
- **TestHelperFunctions** - Utility function tests
- **TestCoursesEndpoints** - Course CRUD operations
- **TestAssignmentsEndpoints** - Assignment management
- **TestStudentsEndpoints** - Student management
- **TestEnrollmentEndpoints** - Course enrollment
- **TestGradingEndpoints** - Grade management
- **TestStatsEndpoints** - Statistics calculations
- **TestAverageEndpoints** - Average calculations
- **TestStudentsSortingEndpoints** - Student sorting
- **TestEdgeCases** - Boundary and edge case testing

## Key Testing Patterns

### 1. Mocking Database Connections
```python
def test_get_courses_success(self, client, mock_db):
    mock_db['cursor'].fetchall.return_value = [...]
    response = client.get('/api/courses')
```

### 2. Testing Input Validation
```python
def test_create_course_empty_name(self, client, mock_db):
    response = client.post('/api/courses',
        data=json.dumps({'course_name': ''}),
        content_type='application/json')
    assert response.status_code == 400
```

### 3. Testing Error Handling
```python
def test_get_courses_database_error(self, client, mock_db):
    mock_db['cursor'].execute.side_effect = mysql.connector.Error("DB Error")
    response = client.get('/api/courses')
    assert response.status_code == 500
```

### 4. Testing Score Validation
```python
def test_save_grade_invalid_score_too_high(self, client, mock_db):
    response = client.post('/api/grades',
        data=json.dumps({
            'student_id': 1,
            'assignment_id': 1,
            'score': 150  # Invalid: > 100
        }),
        content_type='application/json')
    assert response.status_code == 400
```

## What's Tested

### Functionality Tests
- All CRUD operations
- Query filtering
- Bulk operations
- Data aggregation (averages, counts)
- Sorting algorithms

### Validation Tests
- Required field validation
- Score range validation (0-100)
- Data type validation
- Empty input handling

### Error Handling Tests
- Database connection errors
- Missing required parameters
- Invalid data types
- Boundary value errors

### Data Transformation Tests
- Decimal to float conversion
- JSON serialization
- Data cleaning

### Edge Cases
- Empty results
- Null values
- Special characters
- Decimal precision
- Multiple enrollments

## Integration Testing Notes

**Note:** These are unit tests with mocked database connections. For integration tests with a real database:

1. Set up a test database (MySQL)
2. Configure a separate test `db-config.env`
3. Consider using pytest fixtures with setup/teardown
4. Remove database mocking and use real connections

Example integration test setup:
```python
@pytest.fixture(scope="session")
def test_db():
    """Setup test database"""
    # Initialize test DB
    # Run migrations
    yield db
    # Cleanup
```

## Extending the Tests

### Adding New Tests

1. Identify the endpoint/function to test
2. Create a test method following the naming convention: `test_<functionality>_<scenario>`
3. Use fixtures for common setup
4. Mock external dependencies

Example:
```python
class TestNewFeature:
    def test_new_endpoint_success(self, client, mock_db):
        mock_db['cursor'].fetchall.return_value = [...]
        response = client.get('/api/new-endpoint')
        assert response.status_code == 200
```

### Testing Checklist

- [ ] Happy path (success case)
- [ ] Missing required parameters
- [ ] Invalid input values
- [ ] Database errors
- [ ] Empty result sets
- [ ] Boundary values
- [ ] Data transformation accuracy

## Continuous Integration

To integrate with CI/CD:

```yaml
# Example GitHub Actions
- name: Run tests
  run: |
    pip install -r Test/requirements-test.txt
    pytest Test/test_app.py --cov=Backend.app --cov-report=xml
```

## Troubleshooting

### Import Error: "No module named 'app'"
- Ensure tests are run from the Test directory
- The test file imports app from the Backend directory

### ModuleNotFoundError: pytest
- Install testing requirements: `pip install -r requirements-test.txt`

### Database Connection Errors During Tests
- Tests use mocked connections, so real DB connection not needed
- If needed, ensure `Backend/db-config.env` exists for initialization only

### Mock assertions failing
- Check that mock setup matches the function's actual database calls
- Use `mock_db['cursor'].call_args_list` to debug mock usage

## Performance

- All tests run in < 5 seconds (no database operations)
- Mocking ensures fast execution
- Coverage report generation adds ~2 seconds

## Resources

- [pytest documentation](https://docs.pytest.org/)
- [unittest.mock documentation](https://docs.python.org/3/library/unittest.mock.html)
- [Flask testing guide](https://flask.palletsprojects.com/testing/)

## Contact

For issues or improvements to tests, please maintain this test suite by:
1. Adding tests for new endpoints
2. Updating mocks when code changes
3. Running full test suite before deployment
