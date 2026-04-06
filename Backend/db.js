const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

const dbPath = process.env.DB_PATH || path.join(__dirname, "course.db");

/** Letter grade from percent (0–100); not stored in DB. */
function letterGradeFromPercent(p) {
  if (p == null || !Number.isFinite(Number(p))) return null;
  const x = Number(p);
  if (x >= 90) return "A";
  if (x >= 80) return "B";
  if (x >= 70) return "C";
  if (x >= 60) return "D";
  return "F";
}

function getLastInsertRowid(db) {
  const s = db.prepare("SELECT last_insert_rowid() AS i");
  s.step();
  const o = s.getAsObject();
  s.free();
  return o.i;
}

function tableExists(db, name) {
  const s = db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?"
  );
  s.bind([name]);
  const ok = s.step();
  s.free();
  return ok;
}

function columnExists(db, table, col) {
  const s = db.prepare(`PRAGMA table_info(${table})`);
  while (s.step()) {
    const o = s.getAsObject();
    if (o.name === col) {
      s.free();
      return true;
    }
  }
  s.free();
  return false;
}

function createTables(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      student_id INTEGER PRIMARY KEY CHECK (student_id >= 1 AND student_id <= 20),
      first_name TEXT NOT NULL,
      middle_name TEXT,
      last_name TEXT NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS courses (
      course_id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_name TEXT NOT NULL UNIQUE
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS assignments (
      assignment_id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      assignment_name TEXT NOT NULL,
      max_points REAL,
      FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE,
      UNIQUE (course_id, assignment_name)
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS grades (
      grade_id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      assignment_id INTEGER NOT NULL,
      score REAL NOT NULL CHECK (score >= 0 AND score <= 100),
      FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
      FOREIGN KEY (assignment_id) REFERENCES assignments(assignment_id) ON DELETE CASCADE,
      UNIQUE (student_id, assignment_id)
    );
  `);
}

function hasLegacyFlatStudents(db) {
  if (!tableExists(db, "students")) return false;
  if (tableExists(db, "grades")) return false;
  return columnExists(db, "students", "score");
}

/**
 * Older DBs may still have CHECK (student_id <= 10). Widen to 20 without dropping grades.
 */
function migrateStudentIdCheckTo20(db) {
  let stmt = db.prepare(
    `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'students'`
  );
  if (!stmt.step()) {
    stmt.free();
    return;
  }
  const ddl = String(stmt.getAsObject().sql || "");
  stmt.free();
  if (!/student_id\s*<=\s*10\b/.test(ddl)) return;

  db.run("PRAGMA foreign_keys = OFF");
  db.run(`CREATE TABLE students__mig (
    student_id INTEGER PRIMARY KEY CHECK (student_id >= 1 AND student_id <= 20),
    first_name TEXT NOT NULL,
    middle_name TEXT,
    last_name TEXT NOT NULL
  );`);
  db.run(`INSERT INTO students__mig SELECT * FROM students`);
  db.run(`DROP TABLE students`);
  db.run(`ALTER TABLE students__mig RENAME TO students`);
  db.run("PRAGMA foreign_keys = ON");
}

function migrateLegacyFlatScores(db) {
  const s = db.prepare(
    "SELECT student_id, first_name, middle_name, last_name, score FROM students"
  );
  const rows = [];
  while (s.step()) {
    rows.push(s.getAsObject());
  }
  s.free();
  db.run("DROP TABLE students");
  createTables(db);
  if (rows.length === 0) return;

  const courseId = getOrCreateCourse(db, "Migrated course");
  const assignmentId = getOrCreateAssignment(
    db,
    courseId,
    "Overall score",
    null
  );
  for (const r of rows) {
    upsertStudentRecord(db, {
      studentId: r.student_id,
      firstName: r.first_name,
      middleName: r.middle_name != null ? String(r.middle_name) : "",
      lastName: r.last_name,
    });
    upsertGradeRecord(db, r.student_id, assignmentId, Number(r.score));
  }
}

function getOrCreateCourse(db, courseName) {
  const trimmed = String(courseName).trim();
  let s = db.prepare("SELECT course_id FROM courses WHERE course_name = ?");
  s.bind([trimmed]);
  if (s.step()) {
    const id = s.getAsObject().course_id;
    s.free();
    return id;
  }
  s.free();
  db.run("INSERT INTO courses (course_name) VALUES (?)", [trimmed]);
  return getLastInsertRowid(db);
}

function getOrCreateAssignment(db, courseId, assignmentName, maxPoints) {
  const name = String(assignmentName).trim();
  let s = db.prepare(
    "SELECT assignment_id FROM assignments WHERE course_id = ? AND assignment_name = ?"
  );
  s.bind([courseId, name]);
  if (s.step()) {
    const id = s.getAsObject().assignment_id;
    s.free();
    return id;
  }
  s.free();
  db.run(
    "INSERT INTO assignments (course_id, assignment_name, max_points) VALUES (?, ?, ?)",
    [courseId, name, maxPoints != null && maxPoints !== "" ? Number(maxPoints) : null]
  );
  return getLastInsertRowid(db);
}

function upsertStudentRecord(db, row) {
  db.run(
    `INSERT INTO students (student_id, first_name, middle_name, last_name)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(student_id) DO UPDATE SET
       first_name = excluded.first_name,
       middle_name = excluded.middle_name,
       last_name = excluded.last_name`,
    [
      row.studentId,
      row.firstName,
      row.middleName || null,
      row.lastName,
    ]
  );
}

function upsertGradeRecord(db, studentId, assignmentId, score) {
  const sc = Number(score);
  db.run(
    `INSERT INTO grades (student_id, assignment_id, score)
     VALUES (?, ?, ?)
     ON CONFLICT(student_id, assignment_id) DO UPDATE SET score = excluded.score`,
    [studentId, assignmentId, sc]
  );
}

/**
 * SQLite via sql.js (WASM).
 */
async function initDb() {
  const SQL = await initSqlJs();
  let db;
  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    db = new SQL.Database();
  }

  db.run("PRAGMA foreign_keys = ON");

  if (hasLegacyFlatStudents(db)) {
    migrateLegacyFlatScores(db);
  } else {
    createTables(db);
  }
  migrateStudentIdCheckTo20(db);

  function persist() {
    fs.writeFileSync(dbPath, Buffer.from(db.export()));
  }

  persist();

  function importGradeRows(rows) {
    const errors = [];
    let ok = 0;
    db.run("BEGIN");
    try {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        try {
          const sid = r.studentId;
          if (!Number.isInteger(sid) || sid < 1 || sid > 20) {
            throw new Error("student_id must be integer 1–20");
          }
          const score = Number(r.score);
          if (!Number.isFinite(score) || score < 0 || score > 100) {
            throw new Error("score must be between 0 and 100");
          }
          const courseId = getOrCreateCourse(db, r.courseName);
          const aid = getOrCreateAssignment(
            db,
            courseId,
            r.assignmentName,
            r.maxPoints
          );
          upsertStudentRecord(db, {
            studentId: sid,
            firstName: r.firstName,
            middleName: r.middleName || "",
            lastName: r.lastName,
          });
          upsertGradeRecord(db, sid, aid, score);
          ok++;
        } catch (e) {
          errors.push({ line: r._lineNumber || i + 2, message: String(e.message || e) });
        }
      }
      db.run("COMMIT");
    } catch (e) {
      db.run("ROLLBACK");
      throw e;
    }
    persist();
    return { imported: ok, errors };
  }

  function upsertGradeFromApi(body) {
    const courseId = getOrCreateCourse(db, body.courseName);
    const aid = getOrCreateAssignment(
      db,
      courseId,
      body.assignmentName,
      body.maxPoints
    );
    upsertStudentRecord(db, {
      studentId: body.studentId,
      firstName: body.firstName,
      middleName: body.middleName || "",
      lastName: body.lastName,
    });
    upsertGradeRecord(db, body.studentId, aid, body.score);
    persist();
  }

  function listStudentsAscending() {
    const stmt = db.prepare(
      `SELECT s.student_id AS studentId, s.first_name AS firstName, s.middle_name AS middleName,
              s.last_name AS lastName,
              (SELECT AVG(g.score) FROM grades g WHERE g.student_id = s.student_id) AS avgScore,
              (SELECT COUNT(*) FROM grades g WHERE g.student_id = s.student_id) AS gradeCount
       FROM students s
       ORDER BY s.student_id ASC`
    );
    const rows = [];
    while (stmt.step()) {
      const o = stmt.getAsObject();
      const avg = o.avgScore;
      const avgNum =
        avg === null || avg === undefined
          ? null
          : Number(Number(avg).toFixed(2));
      rows.push({
        studentId: o.studentId,
        firstName: o.firstName,
        middleName: o.middleName,
        lastName: o.lastName,
        averageScore: avgNum,
        letterGrade: letterGradeFromPercent(avgNum),
        gradeCount: o.gradeCount,
      });
    }
    stmt.free();
    return rows;
  }

  function overallGradeStats() {
    let stmt = db.prepare(
      `SELECT COUNT(*) AS c, AVG(score) AS avg FROM grades`
    );
    stmt.step();
    const o = stmt.getAsObject();
    stmt.free();
    const n = o.c || 0;
    const raw = o.avg;
    return {
      gradeRowCount: n,
      average:
        raw === null || raw === undefined || n === 0
          ? null
          : Number(Number(raw).toFixed(2)),
    };
  }

  function studentCount() {
    const stmt = db.prepare("SELECT COUNT(*) AS c FROM students");
    stmt.step();
    const c = stmt.getAsObject().c;
    stmt.free();
    return c;
  }

  function getSummary() {
    const students = listStudentsAscending();
    const g = overallGradeStats();
    return {
      students,
      studentCount: studentCount(),
      gradeRowCount: g.gradeRowCount,
      average: g.average,
      averageLetterGrade: letterGradeFromPercent(g.average),
    };
  }

  function listCourses() {
    const stmt = db.prepare(
      "SELECT course_id AS courseId, course_name AS courseName FROM courses ORDER BY course_name ASC"
    );
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }

  function listAssignments() {
    const stmt = db.prepare(
      `SELECT a.assignment_id AS assignmentId, a.course_id AS courseId,
              a.assignment_name AS assignmentName, a.max_points AS maxPoints,
              c.course_name AS courseName
       FROM assignments a
       JOIN courses c ON c.course_id = a.course_id
       ORDER BY c.course_name ASC, a.assignment_name ASC`
    );
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }

  function listGradesDetail() {
    const stmt = db.prepare(
      `SELECT g.grade_id AS gradeId, g.student_id AS studentId,
              g.assignment_id AS assignmentId, g.score,
              s.first_name AS firstName, s.middle_name AS middleName, s.last_name AS lastName,
              a.assignment_name AS assignmentName, c.course_name AS courseName
       FROM grades g
       JOIN students s ON s.student_id = g.student_id
       JOIN assignments a ON a.assignment_id = g.assignment_id
       JOIN courses c ON c.course_id = a.course_id
       ORDER BY g.student_id ASC, c.course_name ASC, a.assignment_name ASC`
    );
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }

  return {
    importGradeRows,
    upsertGradeFromApi,
    listStudentsAscending,
    getSummary,
    overallGradeStats,
    studentCount,
    listCourses,
    listAssignments,
    listGradesDetail,
  };
}

module.exports = { initDb, letterGradeFromPercent };
