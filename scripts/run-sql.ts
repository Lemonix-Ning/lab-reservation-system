import 'dotenv/config';
import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is not set. Please set it before running this script.");
    process.exit(1);
  }

  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("Usage: tsx scripts/run-sql.ts <file1.sql> [file2.sql ...]");
    process.exit(1);
  }

  const connection = await mysql.createConnection(dbUrl);
  try {
    for (const file of files) {
      const absolutePath = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
      const content = fs.readFileSync(absolutePath, "utf-8");
      const statements = content
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      console.log(`[RunSQL] Executing ${statements.length} statements from ${file}`);
      for (const stmt of statements) {
        try {
          console.log(`[RunSQL] >>> ${stmt.substring(0, Math.min(stmt.length, 120))}${stmt.length > 120 ? "..." : ""}`);
          const [rows] = await connection.query(stmt);
          const isExplainOrSelect = /^\s*(EXPLAIN|SELECT)/i.test(stmt);
          if (isExplainOrSelect) {
            const preview = Array.isArray(rows) ? rows.slice(0, 10) : rows;
            console.log(`[RunSQL] <<< Result:`, JSON.stringify(preview, null, 2));
          }
        } catch (err: any) {
          const code = err?.code;
          const msg = String(err?.message || err);
          // Known idempotent cases: duplicate FK/index names, already exists
          if (code === 'ER_FK_DUP_NAME' || code === 'ER_DUP_KEYNAME' || msg.includes('already exists') || msg.includes('Duplicate')) {
            console.warn(`[RunSQL] Skipping idempotent error: ${msg}`);
            continue;
          }
          console.error(`[RunSQL] Statement failed: ${msg}`);
          throw err;
        }
      }
    }
    console.log("[RunSQL] All statements executed successfully.");
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
