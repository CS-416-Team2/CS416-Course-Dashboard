const { parse } = require("csv-parse/sync");

function normalizeKey(k) {
  return String(k || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

const REQUIRED = [
  "student_id",
  "first_name",
  "last_name",
  "course_name",
  "assignment_name",
  "score",
];

/**
 * Parse CSV matching Test/test_grades.csv: student_id, first_name, middle_name,
 * last_name, course_name, assignment_name, score [, max_points]
 */
function parseGradeCsv(text) {
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    bom: true,
  });

  const rows = [];
  const parseErrors = [];

  records.forEach((rec, idx) => {
    const lineNum = idx + 2;
    const row = {};
    for (const [k, v] of Object.entries(rec)) {
      row[normalizeKey(k)] = v;
    }

    const missing = REQUIRED.filter(
      (key) => row[key] == null || String(row[key]).trim() === ""
    );
    if (missing.length) {
      parseErrors.push({
        line: lineNum,
        message: `Missing required field(s): ${missing.join(", ")}`,
      });
      return;
    }

    const studentId = parseInt(String(row.student_id).trim(), 10);
    if (!Number.isInteger(studentId) || studentId < 1 || studentId > 20) {
      parseErrors.push({
        line: lineNum,
        message: "student_id must be an integer from 1 to 20",
      });
      return;
    }

    const score = parseFloat(String(row.score).trim());
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      parseErrors.push({
        line: lineNum,
        message: "score must be a number from 0 to 100",
      });
      return;
    }

    let maxPoints = null;
    if (row.max_points != null && String(row.max_points).trim() !== "") {
      const mp = parseFloat(String(row.max_points).trim());
      if (Number.isFinite(mp)) {
        maxPoints = mp;
      }
    }

    const firstName = String(row.first_name).trim();
    const lastName = String(row.last_name).trim();
    if (!firstName || !lastName) {
      parseErrors.push({
        line: lineNum,
        message: "first_name and last_name must be non-empty",
      });
      return;
    }

    rows.push({
      _lineNumber: lineNum,
      studentId,
      firstName,
      middleName:
        row.middle_name != null && String(row.middle_name).trim() !== ""
          ? String(row.middle_name).trim()
          : "",
      lastName,
      courseName: String(row.course_name).trim(),
      assignmentName: String(row.assignment_name).trim(),
      score,
      maxPoints,
    });
  });

  return { rows, parseErrors };
}

module.exports = { parseGradeCsv };
