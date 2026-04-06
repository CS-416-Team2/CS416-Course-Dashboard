const http = require("http");
const path = require("path");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { initDb, letterGradeFromPercent } = require("./db");
const { parseGradeCsv } = require("./csvImport");

const FRONTEND_DIR = path.join(__dirname, "..", "Frontend");

const START_PORT = Number(process.env.PORT) || 3000;
const PORT_RANGE = 25;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

function csvBodyMiddleware(req, res, next) {
  const ct = req.headers["content-type"] || "";
  if (ct.includes("multipart/form-data")) {
    return upload.single("file")(req, res, next);
  }
  return express.text({ limit: "5mb", type: () => true })(req, res, next);
}

function validateGradeBody(body) {
  const errors = [];
  const studentId = body.studentId;
  const firstName = body.firstName;
  const middleName = body.middleName;
  const lastName = body.lastName;
  const courseName = body.courseName;
  const assignmentName = body.assignmentName;
  const score = body.score;

  if (
    typeof firstName !== "string" ||
    !firstName.trim() ||
    typeof lastName !== "string" ||
    !lastName.trim()
  ) {
    errors.push("firstName and lastName are required non-empty strings");
  }

  if (typeof middleName !== "string") {
    errors.push("middleName must be a string (may be empty)");
  }

  if (typeof courseName !== "string" || !courseName.trim()) {
    errors.push("courseName is required");
  }

  if (typeof assignmentName !== "string" || !assignmentName.trim()) {
    errors.push("assignmentName is required");
  }

  if (!Number.isInteger(studentId) || studentId < 1 || studentId > 20) {
    errors.push("studentId must be an integer between 1 and 20 (inclusive)");
  }

  if (
    typeof score !== "number" ||
    !Number.isFinite(score) ||
    score < 0 ||
    score > 100
  ) {
    errors.push("score must be a number between 0 and 100 (inclusive)");
  }

  return {
    errors,
    studentId,
    firstName,
    middleName: middleName || "",
    lastName,
    courseName: courseName && courseName.trim(),
    assignmentName: assignmentName && assignmentName.trim(),
    score,
    maxPoints: body.maxPoints,
  };
}

async function main() {
  const {
    importGradeRows,
    upsertGradeFromApi,
    listStudentsAscending,
    getSummary,
    overallGradeStats,
    studentCount,
    listCourses,
    listAssignments,
    listGradesDetail,
  } = await initDb();

  const app = express();

  app.use(cors());
  app.use(express.json());

  /** Import grades from CSV (multipart field `file` or raw body). */
  app.post("/api/import/csv", csvBodyMiddleware, (req, res) => {
    let text = "";
    if (req.file && req.file.buffer) {
      text = req.file.buffer.toString("utf8");
    } else if (typeof req.body === "string") {
      text = req.body;
    } else {
      return res.status(400).json({
        error:
          'Upload a CSV file (multipart field name: "file") or POST the CSV as text',
      });
    }
    try {
      const { rows, parseErrors } = parseGradeCsv(text);
      const result = importGradeRows(rows);
      return res.json({
        imported: result.imported,
        errors: [...parseErrors, ...result.errors],
      });
    } catch (e) {
      return res.status(400).json({ error: String(e.message || e) });
    }
  });

  /** One grade row: student + course + assignment + score. */
  app.post("/api/students", (req, res) => {
    const v = validateGradeBody(req.body);
    if (v.errors.length) {
      return res.status(400).json({ error: v.errors.join("; ") });
    }
    try {
      upsertGradeFromApi({
        studentId: v.studentId,
        firstName: v.firstName.trim(),
        middleName: (v.middleName || "").trim(),
        lastName: v.lastName.trim(),
        courseName: v.courseName,
        assignmentName: v.assignmentName,
        score: v.score,
        maxPoints: v.maxPoints,
      });
      return res.status(201).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: String(e.message || e) });
    }
  });

  app.get("/api/students", (_req, res) => {
    try {
      const students = listStudentsAscending();
      return res.json({ students });
    } catch (e) {
      return res.status(500).json({ error: String(e.message || e) });
    }
  });

  app.get("/api/courses", (_req, res) => {
    try {
      return res.json({ courses: listCourses() });
    } catch (e) {
      return res.status(500).json({ error: String(e.message || e) });
    }
  });

  app.get("/api/assignments", (_req, res) => {
    try {
      return res.json({ assignments: listAssignments() });
    } catch (e) {
      return res.status(500).json({ error: String(e.message || e) });
    }
  });

  app.get("/api/grades", (_req, res) => {
    try {
      return res.json({ grades: listGradesDetail() });
    } catch (e) {
      return res.status(500).json({ error: String(e.message || e) });
    }
  });

  app.get("/api/stats/average", (_req, res) => {
    try {
      const g = overallGradeStats();
      return res.json({
        gradeRowCount: g.gradeRowCount,
        average: g.average,
        averageLetterGrade: letterGradeFromPercent(g.average),
        studentCount: studentCount(),
      });
    } catch (e) {
      return res.status(500).json({ error: String(e.message || e) });
    }
  });

  app.get("/api/summary", (_req, res) => {
    try {
      return res.json(getSummary());
    } catch (e) {
      return res.status(500).json({ error: String(e.message || e) });
    }
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(express.static(FRONTEND_DIR));

  listenAvailable(app, START_PORT, PORT_RANGE);
}

function listenAvailable(app, startPort, range) {
  const endPort = startPort + range;

  const tryPort = (port) => {
    if (port > endPort) {
      console.error(
        `No free port between ${startPort} and ${endPort}. Pick one, e.g. PORT=4000 npm start`
      );
      process.exit(1);
      return;
    }

    const server = http.createServer(app);
    server.once("error", (err) => {
      if (err.code === "EADDRINUSE") {
        tryPort(port + 1);
      } else {
        console.error(err);
        process.exit(1);
      }
    });
    server.listen(port, () => {
      if (port !== startPort) {
        console.warn(`Port ${startPort} was busy; using ${port} instead.`);
      }
      console.log(`Course API listening on http://localhost:${port}`);
    });
  };

  tryPort(startPort);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
