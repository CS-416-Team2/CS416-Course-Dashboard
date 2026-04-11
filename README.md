# CS416-Course-Dashboard

Course management dashboard for instructors — CS416 Software Engineering group project at Purdue.

**Frontend:** Next.js &nbsp;|&nbsp; **Backend:** Python Flask &nbsp;|&nbsp; **Database:** MySQL &nbsp;|&nbsp; **Version Control:** GitHub ([branching strategy](git-branch-strategy.md))

---

## Prerequisites

| Tool | Minimum version | How to check |
|------|----------------|--------------|
| **Node.js** | 18+ | `node -v` |
| **npm** | 9+ | `npm -v` |
| **Python** | 3.10+ | `python --version` |
| **MySQL** | 8.0+ | `mysql --version` |

---

## Quick Start

### 1. Set up the database

Run the setup script (prompts for your MySQL password):

```powershell
cd DB
.\setup.ps1
```

Or run the schema manually:

```bash
mysql -u root -p < DB/schema.sql
```

This creates the `school_db` database, all tables, and seeds a default instructor account.

> **Default login:** `admin@school.edu` / `ChangeMe123!`
>
> You can also create new accounts from the website at `/register` — no manual SQL needed.

### 2. Configure the Flask backend

Run the setup script (creates venv, installs deps, and prompts for DB config):

```powershell
cd Backend
.\setup.ps1
```

Or set up manually:

```bash
cd Backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1       # Windows PowerShell
pip install -r requirements.txt
cp .env.example db-config.env      # then edit with your MySQL password
```

Start the server:

```bash
.\.venv\Scripts\python.exe app.py
```

Flask runs on **http://localhost:5000**.

### 3. Configure the Next.js frontend

```bash
cd my-app

# Create your .env from the example
cp envExample.txt .env.local
```

Edit `.env.local`:

```env
# Generate a random secret (at least 32 characters). Example using OpenSSL:
#   openssl rand -base64 48
AUTH_SECRET=paste_your_random_secret_here

AUTH_TRUST_HOST=true

# Must match the database you created in step 1
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=your_mysql_password
DB_NAME=school_db

# Points to the Flask backend from step 2
BACKEND_API_BASE_URL=http://127.0.0.1:5000
```

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

Next.js runs on **http://localhost:3000**.

### 4. Open the app

1. Visit **http://localhost:3000**
2. Click **Sign In** or **Create Account** to register a new instructor
3. You're in the dashboard!

---

## Project Structure

```
CS416-Course-Dashboard/
├── Backend/             # Flask API server
│   ├── app.py           # All routes and DB setup
│   ├── setup.ps1        # First-time setup script (venv + deps + config)
│   ├── requirements.txt # Python dependencies
│   ├── .env.example     # Template → copy to db-config.env
│   └── db-config.env    # Your local MySQL creds (git-ignored)
├── my-app/              # Next.js frontend
│   ├── app/             # App Router pages and API routes
│   ├── lib/             # DB pool, auth helpers, env validation
│   ├── envExample.txt   # Template → copy to .env.local
│   └── .env.local       # Your local env config (git-ignored)
├── DB/
│   ├── schema.sql       # Canonical database schema + seed data
│   ├── setup.ps1        # Runs schema.sql against MySQL
│   └── ERD.md           # Entity-relationship diagram (Mermaid)
└── README.md            # ← You are here
```

---

## Business Requirements

Each instructor should be able to create, read, update, and delete (CRUD) the data they input for each of their courses.

Each course has a list of assignment submissions containing:
- Student first name, middle name, last name, and ID
- Assignment name and score

Assignments are displayed on the course page, with submissions sorted by grade.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `db-config.env is empty or missing` | Copy `Backend/.env.example` to `Backend/db-config.env` and fill in your MySQL password |
| `Invalid server environment variables` | Make sure `my-app/.env.local` exists with all required keys (see step 3) |
| `AUTH_SECRET must be at least 32 chars` | Generate a longer secret: `openssl rand -base64 48` |
| Database name mismatch | Ensure `DB_NAME` in both config files matches the database you created (`school_db` by default) |
| Flask can't connect to MySQL | Verify MySQL is running and the credentials in `db-config.env` are correct |
