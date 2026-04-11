import 'dotenv/config';
import mysql from 'mysql2/promise';

type Status = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed' | 'violated';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const execRun = argv.includes('--execute');
  const retentionArg = argv.find(a => a.startsWith('--days='));
  const retentionDays = retentionArg ? parseInt(retentionArg.split('=')[1], 10) : (parseInt(process.env.RESERVATION_ARCHIVE_RETENTION_DAYS || '180', 10));
  const statusesToArchive: Status[] = ['completed', 'cancelled', 'rejected'];

  const connection = await mysql.createConnection(dbUrl);
  const [serverVersion] = await connection.query('SELECT VERSION() as v');
  console.log(`[Archive] Connected. MySQL:`, serverVersion);
  console.log(`[Archive] Retention: ${retentionDays} days; Statuses: ${statusesToArchive.join(', ')}`);

  const cutoffExpr = `DATE_SUB(NOW(), INTERVAL ${retentionDays} DAY)`;

  // Count candidates
  const [countRows] = await connection.query(
    `SELECT COUNT(*) AS cnt
     FROM lab_reservations
     WHERE status IN (${statusesToArchive.map(s => `'${s}'`).join(', ')})
       AND endTime < ${cutoffExpr}`
  );
  const total = Array.isArray(countRows) ? (countRows[0] as any).cnt : 0;
  console.log(`[Archive] Candidates: ${total}`);

  if (dryRun && !execRun) {
    await connection.end();
    return;
  }

  // Ensure archive table exists
  await connection.query(`CREATE TABLE IF NOT EXISTS lab_reservations_archive LIKE lab_reservations`);
  // Add specific archive columns/constraints if not present
  await connection.query(`ALTER TABLE lab_reservations_archive
    ADD COLUMN IF NOT EXISTS originalId INT NOT NULL,
    ADD COLUMN IF NOT EXISTS archivedAt TIMESTAMP NOT NULL DEFAULT (NOW())`);

  // Copy columns
  const cols = [
    'id AS originalId',
    'labId','userId','title','reason','peopleCount',
    'startTime','endTime','status','rejectReason','applyTime','approveTime','createdAt','updatedAt',
    'NOW() AS archivedAt'
  ].join(', ');

  try {
    await connection.beginTransaction();
    const [insertResult] = await connection.query(
      `INSERT INTO lab_reservations_archive (${['originalId','labId','userId','title','reason','peopleCount','startTime','endTime','status','rejectReason','applyTime','approveTime','createdAt','updatedAt','archivedAt'].join(', ')})
       SELECT ${cols}
       FROM lab_reservations
       WHERE status IN (${statusesToArchive.map(s => `'${s}'`).join(', ')})
         AND endTime < ${cutoffExpr}`
    );
    console.log(`[Archive] Inserted:`, insertResult);

    const [deleteResult] = await connection.query(
      `DELETE FROM lab_reservations
       WHERE status IN (${statusesToArchive.map(s => `'${s}'`).join(', ')})
         AND endTime < ${cutoffExpr}`
    );
    console.log(`[Archive] Deleted from primary:`, deleteResult);

    await connection.commit();
    console.log(`[Archive] Completed.`);
  } catch (err) {
    await connection.rollback();
    console.error(`[Archive] Failed. Rolled back.`, err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
