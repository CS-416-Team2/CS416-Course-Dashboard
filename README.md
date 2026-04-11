This repository serves as the workspace for Group Project 2 of the CS416 Software Engineering course at Purdue University Northwest.

This project is a full-stack course management website designed for instructors. It includes a frontend, backend, and database system that work together to manage course information, student records, assignments, and scores.

> This README will continue to be updated as the project progresses.

---

## Project Overview

The goal of this project is to build a course management dashboard that allows instructors to manage course data efficiently through a web-based interface. The system supports storing, reading, updating, and displaying student and assignment information while also providing sorted views and average score calculations.

The application uses a modern full-stack architecture:
- **Frontend:** Next.js
- **Backend:** Python Flask
- **Database:** MySQL
- **Container OS:** Ubuntu 24.04 (stable)
- **Version Control:** GitHub

---

## Business Scenario

Imagine each team as a software company. The customer asks the company to build a course management website for instructors, including frontend, backend, and database functionality.

Each instructor should be able to create, read, update, and delete (CRUD) the data they input for each of their courses. The most important operations for this project are **create** and **read**, but the system is designed to support a broader course management workflow.

Each course includes assignment submissions containing the following data:

- Student first name
- Student middle name
- Student last name
- Student ID
- Assignment name
- Assignment score

Each unique assignment is displayed on a course page, and each submission for that assignment is displayed on the assignment page. Submission data should be sortable in ascending order, including by:
- grade
- student last name
- student ID

---

## Business Requirements

The system should support the following:

### Input Data
- Student first name
- Student middle name
- Student last name
- Student ID
- Assignment name
- Assignment score from **0 to 100**

### Output Data
- Display stored student and assignment data on the website
- Sort data in ascending order
- Calculate and display average scores
- Show course-related statistics and summaries

---

## Core Functionality

This project is designed to allow instructors to:

- create courses
- create assignments
- add students
- store student scores
- enroll students in courses
- display assignment submissions
- sort student records
- calculate average grades
- view dashboard statistics

The system connects the frontend to a Flask API, which communicates with a MySQL database for persistent storage.

---

## Technologies Used

**Frontend:** Next.js  

**Backend:** Python Flask and Node.js (auth)

**Database:** MySQL  

**Docker Container OS:** Ubuntu 24.04 (stable)  

**Version Control:** GitHub ([our branching strategy](git-branch-strategy.md))

---

## System Design

The project follows a full-stack structure:

- **Frontend:** User interface for instructors to access the dashboard and manage records
- **Backend:** Flask REST API that handles business logic, validation, sorting, and database communication
- **Database:** MySQL for storing students, assignments, grades, enrollments, and courses
- **Deployment/Environment:** Docker running on Ubuntu for consistent development and testing

---

## Features

Current and planned features include:

- student record management
- course creation and management
- assignment creation
- grade entry and bulk grade import
- course enrollments
- sorted reporting
- average score calculations
- dashboard statistics
- database-backed data storage
- full-stack integration across frontend, backend, and database

---

## Sorting and Reporting

One important requirement of this project is displaying assignment submissions and student data in sorted order.

The dashboard supports ascending sorting and reporting based on values such as:
- score
- student last name
- student ID

The backend also calculates average scores to help instructors quickly review class performance.

---

## Tech Stack Implementation

### Frontend
The frontend is built with **Next.js** and provides the user-facing dashboard interface.

### Backend
The backend is built with **Python Flask** and exposes API endpoints for:
- students
- courses
- assignments
- grades
- statistics
- average score calculations

### Database
The project uses **MySQL** to store:
- student information
- course information
- assignment records
- grades
- enrollments

### Containerization
The project environment is designed to support **Docker** using **Ubuntu 24.04 stable**.

---

## Development Environment

To support the project requirements, the development environment includes:

- Ubuntu 24.04.1
- Docker
- GitHub
- MySQL
- Python
- Node.js

Stable versions should always be used instead of beta versions.

---

## Installation and Setup

### Backend Setup

1. Clone the repository:
```bash
git clone <your-repository-url>
cd CS416-Course-Dashboard
```

2. Create a Python virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate
```

3. Install dependencies:
```bash
pip install flask flask-cors mysql-connector-python python-dotenv
```

4. Create your database configuration file:
```bash
cp .env.example db-config.env
```

5. Add your MySQL credentials to `db-config.env`:
```env
DB_HOST=localhost
DB_USER=your_username
DB_PASS=your_password
DB_NAME=your_database_name
```

6. Run the backend server:
```bash
python app.py
```

The backend runs on:
```bash
http://localhost:5000
```

### Frontend Setup

1. Navigate to the frontend folder:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend runs on:
```bash
http://localhost:3000
```

---

## Project Collaboration

This project is developed as a team using GitHub and Docker.

Team members are expected to:
- contribute code
- commit and push updates
- pull changes from teammates
- collaborate using branches
- document progress with screenshots
- demonstrate Docker and GitHub collaboration

---

## Assignment Alignment

This project supports the CS416 course project requirements by demonstrating:

- frontend and backend development
- database integration
- sorting algorithms
- Docker usage
- GitHub collaboration
- team contribution workflow
- project reporting and presentation

---

## Future Improvements

Possible improvements include:

- stronger validation for student IDs
- improved sorting options in the UI
- better analytics and visual reporting
- authentication for instructors
- cleaner course and assignment management pages
- deployment with Docker Compose

---

## Notes

- Use stable software versions only
- Ensure MySQL is running before starting the backend
- Confirm environment variables are configured properly
- Update this README as the project continues to evolve

---

## Authors

Developed by **CS416 Team 2**  
Purdue University Northwest  
CS416 Software Engineering

---

## License

This project was created for educational purposes as part of a university course project.