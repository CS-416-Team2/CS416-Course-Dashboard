# Quick Test Reference

## Run All Tests
```bash
pytest test_app.py -v
```

## Run with Coverage
```bash
pytest test_app.py --cov=Backend.app --cov-report=html -v
```

## Run Specific Test Class
```bash
pytest test_app.py::TestCoursesEndpoints -v
```

## Run Specific Test
```bash
pytest test_app.py::TestGradingEndpoints::test_save_grade_success -v
```

---

## Test Count by Component

| Component | Tests |
|-----------|-------|
| Helper Functions | 8 |
| Courses | 6 |
| Assignments | 7 |
| Students | 10 |
| Enrollments | 5 |
| Grades | 11 |
| Stats | 3 |
| Average | 3 |
| Student Sorting | 3 |
| Edge Cases | 6 |
| **Total** | **62** |

---

## Key Test Scenarios

### Success Cases
- Creating/reading/updating entities
- Bulk operations
- Data aggregations

### Validation
- Missing required fields
- Invalid scores (< 0 or > 100)
- Empty names
- Boundary values (0, 100)

### Errors
- Database connection failures
- Invalid input handling
- Empty result sets

### Data Handling
- Decimal to float conversion
- Sorting algorithms
- Special characters in names

---

## Common Test Issues & Solutions

| Issue | Solution |
|-------|----------|
| `ModuleNotFoundError: app` | Run from Test directory with correct path import |
| `pytest not found` | `pip install -r requirements-test.txt` |
| Tests fail with DB errors | Tests use mocks, DB not needed |
| Import errors | Check sys.path in test_app.py imports Backend correctly |

---

## Test Fixtures

```python
client       # Flask test client
mock_db      # Mocked database connection & cursor
```

## Common Assertions

```python
assert response.status_code == 200          # OK
assert response.status_code == 201          # Created
assert response.status_code == 400          # Bad Request
assert response.status_code == 500          # Server Error

data = json.loads(response.data)            # Parse response
assert 'message' in data                    # Check field exists
assert len(data) == 2                       # Check count
```

---

## Manual Testing Endpoints (for reference)

```bash
# Get all courses
curl http://localhost:5000/api/courses

# Create course
curl -X POST http://localhost:5000/api/courses \
  -H "Content-Type: application/json" \
  -d '{"course_name": "CS 101"}'

# Add student
curl -X POST http://localhost:5000/api/students \
  -H "Content-Type: application/json" \
  -d '{"first_name": "John", "last_name": "Doe"}'

# Save grade
curl -X POST http://localhost:5000/api/grades \
  -H "Content-Type: application/json" \
  -d '{"student_id": 1, "assignment_id": 1, "score": 92}'

# Get stats
curl http://localhost:5000/api/stats

# Get average
curl http://localhost:5000/api/average
```
