/**
 * Removes passwords and codes from the activity log.
 *
 * Until September 2026 the log saved the whole form an admin submitted when
 * creating or editing an account, password included, and any signed-in
 * account could read it. The log no longer does either; this cleans what it
 * had already saved.
 *
 * By default it only shows what it would change. Nothing is written without
 * --apply.
 *
 *   node scripts/strip-activity-log-secrets.js           what would change
 *   node scripts/strip-activity-log-secrets.js --apply   change it
 *   node scripts/strip-activity-log-secrets.js --quiet   counts only, no email addresses
 */
const SENSITIVE_KEY = /pass(word)?|otp|token|secret|refresh/i;

/** The message without its secret fields, and the names of the fields removed. */
function stripSecrets(message) {
  let parsed;
  try {
    parsed = JSON.parse(message);
  } catch {
    return { cleaned: message, removed: [] };
  }
  const removed = [];
  const walk = (value) => {
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === 'object') {
      const kept = {};
      for (const [key, inner] of Object.entries(value)) {
        if (SENSITIVE_KEY.test(key)) {
          removed.push(key);
          continue;
        }
        kept[key] = walk(inner);
      }
      return kept;
    }
    return value;
  };
  const cleaned = walk(parsed);
  return removed.length ? { cleaned: JSON.stringify(cleaned), removed } : { cleaned: message, removed };
}

/** The account an entry was about, when the saved form says. */
function accountOf(message) {
  try {
    const parsed = JSON.parse(message);
    return typeof parsed?.email === 'string' ? parsed.email : null;
  } catch {
    return null;
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  const quiet = process.argv.includes('--quiet');
  require('dotenv').config();
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient();

  try {
    const rows = await db.activityLog.findMany({
      select: { id: true, action: true, createdAt: true, message: true },
    });
    const affected = rows
      .map((row) => ({ row, ...stripSecrets(row.message || '') }))
      .filter((entry) => entry.removed.length > 0);

    console.log(`${rows.length} entries in the log; ${affected.length} hold a password or code.`);

    if (!quiet && affected.length) {
      console.log('\nWhose they were, where the entry says (ask them to change their password):');
      for (const { row, removed } of affected) {
        const day = row.createdAt.toISOString().slice(0, 10);
        const account = accountOf(row.message) ?? 'the entry does not say which account';
        console.log(`  ${day}  ${row.action}  ${account}  [${[...new Set(removed)].join(', ')}]`);
      }
    }

    if (!apply) {
      console.log('\nNothing was changed. Run again with --apply to remove them.');
      return;
    }

    for (const { row, cleaned } of affected) {
      await db.activityLog.update({ where: { id: row.id }, data: { message: cleaned } });
    }
    console.log(`\nRemoved them from ${affected.length} entries.`);
  } finally {
    await db.$disconnect();
  }
}

module.exports = { stripSecrets };

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
