/**
 * One-time Firestore migration: old Firebase project → new Firebase project.
 *
 * Setup:
 *   1. Download service account JSON keys (see README steps in repo chat).
 *   2. Save as scripts/keys/old-service-account.json and scripts/keys/new-service-account.json
 *   3. npm install
 *   4. npm run migrate:firestore
 *
 * Options:
 *   --dry-run   Log counts only, do not write
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEYS_DIR = resolve(__dirname, 'keys');

const SOURCE = {
  projectId: 'gen-lang-client-0730371199',
  databaseId: 'ai-studio-6e88db3f-bd4b-4318-840c-9af7e0054958',
  keyPath: resolve(KEYS_DIR, 'old-service-account.json'),
};

const DEST = {
  projectId: 'pachamama-calendar',
  databaseId: '(default)',
  keyPath: resolve(KEYS_DIR, 'new-service-account.json'),
};

const COLLECTIONS = [
  'rooms',
  'bookingTypes',
  'bookingChannels',
  'paymentChannels',
  'bookingWebsites',
  'settings',
  'teamPositions',
  'retreatTypes',
  'retreats',
  'bookings',
  'venueHires',
  'teamAssignments',
  'housekeeping',
  'users',
  'activityLog',
  'profiles',
] as const;

const BATCH_SIZE = 400;
const dryRun = process.argv.includes('--dry-run');

function loadServiceAccount(path: string): ServiceAccount {
  if (!existsSync(path)) {
    throw new Error(`Missing service account key: ${path}`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as ServiceAccount;
}

async function copyCollection(
  sourceDb: Firestore,
  destDb: Firestore,
  collectionName: string,
  skipExisting: boolean,
): Promise<{ read: number; written: number; skipped: number }> {
  const snapshot = await sourceDb.collection(collectionName).get();
  let written = 0;
  let skipped = 0;

  if (snapshot.empty) {
    console.log(`  ${collectionName}: (empty)`);
    return { read: 0, written: 0, skipped: 0 };
  }

  const docs = snapshot.docs;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const batch = destDb.batch();
    let batchOps = 0;

    for (const docSnap of chunk) {
      if (skipExisting) {
        const existing = await destDb.collection(collectionName).doc(docSnap.id).get();
        if (existing.exists) {
          skipped += 1;
          continue;
        }
      }
      batch.set(destDb.collection(collectionName).doc(docSnap.id), docSnap.data(), { merge: false });
      batchOps += 1;
    }

    if (batchOps > 0) {
      if (dryRun) {
        written += batchOps;
      } else {
        await batch.commit();
        written += batchOps;
      }
    }
  }

  console.log(`  ${collectionName}: ${docs.length} read, ${written} written, ${skipped} skipped`);
  return { read: docs.length, written, skipped };
}

async function main() {
  console.log(dryRun ? 'DRY RUN — no writes\n' : 'Starting Firestore migration…\n');

  const sourceApp = initializeApp(
    { credential: cert(loadServiceAccount(SOURCE.keyPath)), projectId: SOURCE.projectId },
    'migrate-source',
  );
  const destApp = initializeApp(
    { credential: cert(loadServiceAccount(DEST.keyPath)), projectId: DEST.projectId },
    'migrate-dest',
  );

  const sourceDb = getFirestore(sourceApp, SOURCE.databaseId);
  const destDb = getFirestore(destApp, DEST.databaseId);

  let totalRead = 0;
  let totalWritten = 0;
  let totalSkipped = 0;

  for (const name of COLLECTIONS) {
    const skipExisting = name === 'users';
    const result = await copyCollection(sourceDb, destDb, name, skipExisting);
    totalRead += result.read;
    totalWritten += result.written;
    totalSkipped += result.skipped;
  }

  console.log('\nDone.');
  console.log(`  Total documents read:   ${totalRead}`);
  console.log(`  Total documents written: ${totalWritten}`);
  console.log(`  Total skipped (existing users): ${totalSkipped}`);
  if (dryRun) console.log('\nRe-run without --dry-run to apply changes.');
}

main().catch(err => {
  console.error('\nMigration failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
