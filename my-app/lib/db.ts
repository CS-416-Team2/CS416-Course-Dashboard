import mysql, { type Pool } from "mysql2/promise";
import { env } from "@/lib/env";

let pool: Pool | null = null;

export function getDbPool(): Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASS,
      database: env.DB_NAME,
      connectionLimit: 10,
      namedPlaceholders: true,
      enableKeepAlive: true,
      decimalNumbers: true,
      timezone: "Z",
    });
  }

  return pool;
}
