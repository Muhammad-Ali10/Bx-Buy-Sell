/**
 * Forward Stripe's webhooks to this machine while developing.
 *
 * Stripe cannot reach `localhost`, so nothing it does — a package paid for, a
 * card that failed, a subscription that renewed — arrives on its own. The
 * Stripe CLI opens the connection the other way round and forwards each event
 * here. Without it running, payments succeed on Stripe and the platform never
 * hears about them, which is exactly what happened between August and now.
 *
 * A script rather than a line in the README because three things about that
 * line are easy to get wrong: where the CLI actually installed itself (winget
 * announced a PATH entry it did not make), that `--api-key` is what saves you
 * the browser login, and that the forwarded path is `/subscription/webhook`.
 *
 *   npm run stripe:listen
 *
 * Leave it running in its own terminal. The signing secret it prints must match
 * STRIPE_WEBHOOK_SECRET in .env, or every delivery comes back 400.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const PORT = process.env.PORT || 8000;
const ENV_FILE = join(process.cwd(), '.env');

/** Everywhere the CLI is known to end up, in the order worth trying. */
function findStripe() {
  const local = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');
  const candidates = [
    join(local, 'Microsoft', 'WinGet', 'Links', 'stripe.exe'),
    join(
      local,
      'Microsoft',
      'WinGet',
      'Packages',
      'Stripe.StripeCli_Microsoft.Winget.Source_8wekyb3d8bbwe',
      'stripe.exe',
    ),
    join(local, 'Programs', 'stripe', 'stripe.exe'),
    'C:\\Program Files\\Stripe\\stripe.exe',
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  // Not where we expect, but possibly on PATH — let the OS decide.
  return process.platform === 'win32' ? 'stripe.exe' : 'stripe';
}

function readSecretKey() {
  if (!existsSync(ENV_FILE)) return null;
  for (const line of readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const match = /^STRIPE_SECRET_KEY=(.*)$/.exec(line.trim());
    if (match) return match[1].trim();
  }
  return null;
}

const stripe = findStripe();
const apiKey = readSecretKey();

if (!apiKey) {
  console.error('STRIPE_SECRET_KEY not found in Backend/.env');
  process.exit(1);
}

const forwardTo = `localhost:${PORT}/subscription/webhook`;
console.log(`stripe : ${stripe}`);
console.log(`forward: ${forwardTo}`);
console.log('');
console.log('Leave this running. Every payment will be forwarded to the API.');
console.log('A delivery shows as [201]. A 400 means the signing secret in .env');
console.log('is not the one printed below.');
console.log('');

// `--api-key` rather than `stripe login`: the key is already in .env, and the
// login flow wants a browser and a device code every time the CLI forgets.
const child = spawn(stripe, ['listen', '--forward-to', forwardTo, '--api-key', apiKey], {
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(`\nCould not start the Stripe CLI: ${error.message}`);
  console.error('Install it with:  winget install --id Stripe.StripeCli');
  process.exit(1);
});

child.on('exit', (code) => process.exit(code ?? 0));
