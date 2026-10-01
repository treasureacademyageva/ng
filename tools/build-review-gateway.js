#!/usr/bin/env node
/* Build the encrypted browser-only corpus review package.
 * Requires REVIEW_GATEWAY_PASSPHRASE. The passphrase is never written to disk.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'model/data/staging/review-workbooks/START-REVIEWING.html');
const OUTPUT = path.join(ROOT, 'assets/data/review-gateway.enc.json');
const REPORT = path.join(ROOT, 'model/reports/developer-review-gateway.json');
const PASSPHRASE = process.env.REVIEW_GATEWAY_PASSPHRASE || '';
const ITERATIONS = 310000;
const AAD = Buffer.from('treasure-developer-review-gateway-v1', 'utf8');

function sha256(data) { return crypto.createHash('sha256').update(data).digest('hex'); }
function die(message) { console.error(message); process.exit(1); }
if (PASSPHRASE.length < 20) die('REVIEW_GATEWAY_PASSPHRASE must contain at least 20 characters');
if (!fs.existsSync(SOURCE)) die('Generate the private START-REVIEWING.html portal first');

const source = fs.readFileSync(SOURCE, 'utf8');
const match = source.match(/<script id="portalData" type="application\/json">([\s\S]*?)<\/script>/);
if (!match) die('Could not locate private portal data');
let data;
try { data = JSON.parse(match[1]); } catch (error) { die('Private portal data is invalid JSON: ' + error.message); }
if (data.schema !== 'treasure-human-review-portal-v1') die('Unexpected private portal schema');
if (data.trainingAuthorised !== false) die('Private portal must not authorise training');

const counts = {};
for (const [key, track] of Object.entries(data.tracks || {})) counts[key] = track.ids.length;
const expected = {
  candidate_licence: 54,
  candidate_teacher: 50,
  candidate_safeguarding: 50,
  pilot_teacher: 96,
  pilot_safeguarding: 96,
  conditional_legal: 4
};
if (JSON.stringify(counts) !== JSON.stringify(expected)) die('Review track counts do not match the controlled handoff');

const plaintext = Buffer.from(JSON.stringify(data), 'utf8');
const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);
const key = crypto.pbkdf2Sync(PASSPHRASE, salt, ITERATIONS, 32, 'sha256');
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
cipher.setAAD(AAD);
const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
const tag = cipher.getAuthTag();
const sealed = Buffer.concat([encrypted, tag]);
const payload = {
  schema: 'treasure-encrypted-review-payload-v1',
  generated_at: '2026-10-01',
  cipher: 'AES-256-GCM',
  kdf: 'PBKDF2-HMAC-SHA-256',
  iterations: ITERATIONS,
  salt_b64: salt.toString('base64'),
  iv_b64: iv.toString('base64'),
  aad_b64: AAD.toString('base64'),
  ciphertext_b64: sealed.toString('base64'),
  plaintext_sha256: sha256(plaintext),
  plaintext_bytes: plaintext.length,
  training_authorised: false,
  tracks: counts
};
fs.mkdirSync(path.dirname(OUTPUT), {recursive: true});
fs.writeFileSync(OUTPUT, JSON.stringify(payload) + '\n');
const cipherBytes = fs.readFileSync(OUTPUT);
const report = {
  version: 1,
  generated_at: '2026-10-01',
  status: 'ENCRYPTED_PASSWORD_GATED_REVIEW_PACKAGE_NO_TRAINING_APPROVAL',
  owner_authorisation: 'Password-gated human review access only; plaintext public corpus distribution remains forbidden.',
  authorisation_record: 'model/reports/review-gateway-authorisation.json',
  gateway: 'developer-review.html',
  encrypted_payload: 'assets/data/review-gateway.enc.json',
  encrypted_payload_sha256: sha256(cipherBytes),
  encrypted_payload_bytes: cipherBytes.length,
  plaintext_sha256: payload.plaintext_sha256,
  plaintext_bytes: payload.plaintext_bytes,
  cipher: payload.cipher,
  kdf: payload.kdf,
  iterations: payload.iterations,
  tracks: counts,
  plaintext_committed: false,
  passphrase_committed: false,
  human_decisions_imported: 0,
  training_approvals_granted: 0
};
fs.mkdirSync(path.dirname(REPORT), {recursive: true});
fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
