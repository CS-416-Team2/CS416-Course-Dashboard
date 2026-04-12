# CS416 Course Dashboard

A full-stack course management dashboard built for instructors. Create courses, manage student rosters, track assignments, and view grade analytics — all from a single web interface.

> **CS416 Software Engineering — Group Project 2**
> Purdue University Northwest · Team 2

---

## Project Overview

The goal of this project is to build a course management dashboard that allows instructors to manage course data efficiently through a web-based interface. The system supports creating, reading, updating, and displaying student and assignment information while also providing sorted views and average score calculations.

---

## Business Scenario

The customer has asked our team to build a course management website for instructors, including frontend, backend, and database functionality.

Each instructor can perform full CRUD operations on the data they manage. Each course contains assignment submissions with the following data:

- Student first name, middle name, and last name
- Student ID
- Assignment name
- Assignment score

Each unique assignment is displayed on its course page, and each submission for that assignment is listed on the assignment page. Submission data can be sorted in ascending order by:

- Grade
- Student last name
- Student ID

---

## Tech Stack

| Layer         | Technology                          |
|---------------|-------------------------------------|
| Frontend      | Next.js (React, TypeScript, Tailwind CSS) |
| Backend       | Python Flask REST API               |
| Database      | MySQL                               |
| Auth          | NextAuth.js + bcrypt password hashing |
| Containerization | Docker (Ubuntu 24.04)            |
| Version Control | GitHub ([branching strategy](git-branch-strategy.md)) |

---

## Features

- **Full CRUD** — Create, read, update, and delete courses, assignments, students, and grades
- **CSV Grade Import** — Upload a CSV file to bulk-import student grades into an assignment
- **Per-User Data Isolation** — Each instructor only sees courses and students they own
- **Enrollment Management** — Enroll and unenroll students across multiple courses
- **Custom Sorting** — Student data sorted by score using a custom bubble sort implementation
- **Analytics Dashboard** — View class averages, passing rates, highest scores, and enrollment counts
- **Input Validation** — Frontend schemas validated with Zod; backend enforces score range and required fields
- **Authentication** — Secure instructor login with bcrypt-hashed passwords and session-based auth via NextAuth.js
- **Docker Compose** — Full three-service stack (MySQL, Flask, Next.js) for one-command deployment

---

## Project Structure

```
CS416-Course-Dashboard/
├── Frontend/              # Next.js frontend application
│   ├── Dockerfile         # Multi-stage production build
│   ├── components/        # React components (forms, panels, sidebar)
│   └── lib/schemas.ts     # Zod validation schemas & TypeScript types
├── Backend/               # Flask REST API
│   ├── Dockerfile         # Python 3.12 container
│   ├── app.py             # All API routes and business logic
│   ├── requirements.txt
│   └── db-config.env      # MySQL credentials (not committed)
├── DB/
│   ├── schema.sql         # Full database schema + seed data
│   ├── ERD.md             # Entity-relationship diagram
│   └── migrate-*.sql      # Migration scripts
├── docker-compose.yml     # Three-service stack (db, flask-api, nextjs-frontend)
├── API/                   # API documentation
└── Test/                  # Test files
```

---

## Database Schema

The MySQL database (`school_db`) contains seven tables:

| Table                | Purpose                                      |
|----------------------|----------------------------------------------|
| `users`              | Instructor accounts and auth metadata        |
| `auth_refresh_tokens`| Session token rotation for secure auth       |
| `students`           | Student names (first, middle, last)          |
| `courses`            | Courses linked to an instructor              |
| `assignments`        | Assignments linked to a course, with max points |
| `enrollments`        | Junction table linking students ↔ courses    |
| `assignment_grade`   | Individual scores per student per assignment |

A full entity-relationship diagram is available in [`DB/ERD.md`](DB/ERD.md).

---

## API Endpoints

| Method | Endpoint                                    | Description                        |
|--------|---------------------------------------------|------------------------------------|
| GET    | `/api/courses`                              | List instructor's courses with counts |
| POST   | `/api/courses`                              | Create a course                    |
| PUT    | `/api/courses/:id`                          | Rename a course                    |
| DELETE | `/api/courses/:id`                          | Delete a course and its data       |
| GET    | `/api/courses/:id/assignments`              | List assignments for a course      |
| GET    | `/api/assignments`                          | List all assignments across courses |
| POST   | `/api/assignments`                          | Create an assignment               |
| PUT    | `/api/assignments/:id`                      | Update assignment title/max points |
| DELETE | `/api/assignments/:id`                      | Delete an assignment               |
| POST   | `/api/courses/:id/assignments`              | Create assignment + bulk import grades |
| GET    | `/api/students`                             | List/sort students, optionally with scores |
| POST   | `/api/students`                             | Add a student                      |
| PUT    | `/api/students/:id`                         | Update student info/enrollments    |
| DELETE | `/api/students/:id`                         | Delete a student                   |
| GET    | `/api/students/:id/enrollments`             | Get a student's enrolled courses   |
| GET    | `/api/courses/:id/unenrolled`               | Get students not in a course       |
| POST   | `/api/courses/:id/enroll`                   | Enroll students into a course      |
| GET    | `/api/grades?course_id=&assignment_id=`     | Get grades for a course/assignment |
| POST   | `/api/grades`                               | Save a single grade                |
| POST   | `/api/grades/bulk`                          | Save multiple grades at once       |
| DELETE | `/api/grades/:score_id`                     | Delete a grade entry               |
| GET    | `/api/stats?course_id=`                     | Dashboard statistics               |
| GET    | `/api/average?assignment_id=`               | Average score for an assignment    |

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- MySQL 8.0+
- Docker & Docker Compose (for containerized setup)

### Option A: Docker Compose (Recommended)

1. Clone the repository:

```bash
git clone https://github.com/CS-416-Team2/CS416-Course-Dashboard.git
cd CS416-Course-Dashboard
```

2. Create a `.env` file in the project root with your database credentials:

```env
DB_USER=root
DB_PASS=your_password
DB_NAME=school_db
DB_PORT=3306
BACKEND_API_BASE_URL=http://flask-api:5000
```

3. Start all services:

```bash
docker compose up --build
```

This launches three containers:
- **mysql_db** — MySQL 8.4 on port 3306
- **flask_api** — Flask backend on port 5000
- **nextjs_ui** — Next.js frontend on port 3000

> **Default login:** `admin@school.edu` / `ChangeMe123!`

### Option B: Run Locally

1. Clone the repository:

```bash
git clone https://github.com/CS-416-Team2/CS416-Course-Dashboard.git
cd CS416-Course-Dashboard
```

2. Set up the database:

```bash
mysql -u root -p < DB/schema.sql
```

3. Start the backend:

```bash
cd Backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example db-config.env
```

Edit `db-config.env` with your MySQL credentials:

```env
DB_HOST=localhost
DB_USER=your_username
DB_PASS=your_password
DB_NAME=school_db
```

Then run the server:

```bash
python app.py
```

The API will be available at `http://localhost:5000`.

4. Start the frontend:

```bash
cd Frontend
npm install
npm run dev
```

The dashboard will be available at `http://localhost:3000`.

> **Default login:** `admin@school.edu` / `ChangeMe123!`

---

## Authors

Developed by **CS416 Team 2** — Purdue University Northwest
