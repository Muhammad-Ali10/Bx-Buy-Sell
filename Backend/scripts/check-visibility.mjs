/**
 * Walk the listing visibility rules against a running server.
 *
 * The rules are easy to get wrong in a way the screen never shows: a field can
 * be blurred in the design and still be sitting in the JSON. This reads the
 * response instead, so "hidden" means actually absent or replaced — not merely
 * invisible.
 *
 *   node scripts/check-visibility.mjs
 *   node scripts/check-visibility.mjs --token eyJhbGciOi...
 *
 * With no token it checks the logged-out rules. With a token it checks what
 * that member is allowed to see, and reports which of the three states the
 * server decided they are in. Run it once as a registered buyer who has not
 * accepted a listing's agreement, and once as one who has.
 *
 * Get the token from the browser: DevTools → Application → Local Storage →
 * `bearer_token`.
 */

const API = process.env.API_URL || 'http://localhost:3000';

const tokenFlag = process.argv.indexOf('--token');
const TOKEN = tokenFlag !== -1 ? process.argv[tokenFlag + 1] : process.env.TOKEN || null;

const LOCK = /unlock|accept the agreement/i;

let failures = 0;

function check(ok, label, detail) {
  const mark = ok ? '  PASS' : '  FAIL';
  if (!ok) failures++;
  console.log(`${mark}  ${label}${detail ? `\n          ${detail}` : ''}`);
}

/** A row counts as hidden when it is empty, lock text, or a blurred image. */
function isHidden(row) {
  const answer = Array.isArray(row?.answer) ? row.answer.join(' ') : String(row?.answer ?? '');
  return answer.trim() === '' || LOCK.test(answer) || /e_blur/.test(answer);
}

function realRows(rows = []) {
  return rows.filter((row) => !isHidden(row));
}

async function get(path) {
  const res = await fetch(`${API}${path}`, {
    headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${text.slice(0, 200)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${path} returned non-JSON: ${text.slice(0, 200)}`);
  }
}

const run = async () => {
  console.log(`\nChecking ${API} — ${TOKEN ? 'with a token' : 'logged out'}\n`);

  const feed = await get('/listing?page=1&limit=5');
  const listings = Array.isArray(feed?.data) ? feed.data : [];
  if (!listings.length) {
    console.log('No listings came back — nothing to check.');
    process.exitCode = 1;
    return;
  }

  const level = listings[0].viewerLevel;
  console.log(`Server placed this viewer at: ${level}\n`);

  // --- Rules that hold no matter who is looking ---------------------------
  const feedJson = JSON.stringify(listings);
  check(!/"email"\s*:/.test(feedJson), 'No email address anywhere in the feed');

  const billing = [
    'packageStripeSubscriptionId',
    'addonStripeSubscriptionId',
    'successFeePercent',
    'packageActive',
    'packageBillingCycle',
  ];
  const ownIds = new Set(listings.filter((l) => l.viewerLevel === 'CONFIDENTIAL').map((l) => l.id));
  const leakedBilling = listings
    .filter((l) => !ownIds.has(l.id))
    .flatMap((l) => billing.filter((f) => f in l));
  check(
    leakedBilling.length === 0,
    'Billing fields absent on listings the viewer does not own',
    leakedBilling.length ? `found: ${[...new Set(leakedBilling)].join(', ')}` : '',
  );

  // --- Per-listing rules ---------------------------------------------------
  const detail = await get(`/listing/${listings[0].id}`);
  const listing = detail?.data ?? detail;
  const detailLevel = listing.viewerLevel;
  console.log(`Detail page for ${listings[0].id} — level ${detailLevel}\n`);

  const detailJson = JSON.stringify(listing);
  const unblurred = (detailJson.match(/res\.cloudinary\.com\/[^"]*/g) || []).filter(
    (url) => !url.includes('e_blur'),
  );

  if (detailLevel === 'PUBLIC') {
    const stats = listing.statistics || [];
    const allowed = /returning\s*customer|refund\s*rate/i;
    const wrong = realRows(stats).filter((r) => !allowed.test(String(r.question || '')));
    check(
      wrong.length === 0,
      'Statistics: only Returning Customers and Refund Rate carry values',
      wrong.length ? wrong.map((r) => r.question).join(', ') : '',
    );

    for (const section of ['productQuestion', 'managementQuestion']) {
      const open = realRows(listing[section]);
      check(open.length === 0, `${section} fully locked`, open.map((r) => r.question).join(', '));
    }

    check(unblurred.length === 0, 'Images sent only as blurred previews', unblurred[0] || '');
  }

  if (detailLevel === 'PUBLIC' || detailLevel === 'REGISTERED') {
    const social = realRows(listing.social_account);
    check(social.length === 0, 'Social accounts locked', social.map((r) => r.question).join(', '));

    const domains = [...(listing.brand || []), ...(listing.social_account || [])].filter((r) =>
      /domain/i.test(String(r.question || '')),
    );
    const openDomains = realRows(domains);
    check(openDomains.length === 0, 'Domain locked', openDomains.map((r) => r.answer).join(', '));

    const files = (listing.handover || [])
      .concat(listing.brand || [])
      .filter((r) => ['FILE', 'PHOTO'].includes(String(r.answer_type || '').toUpperCase()));
    const openFiles = realRows(files);
    check(
      openFiles.length === 0,
      'Attachments and photos locked',
      openFiles.map((r) => r.question).join(', '),
    );
  }

  if (detailLevel === 'REGISTERED') {
    const stats = realRows(listing.statistics);
    check(stats.length > 0, 'Statistics readable once registered');
  }

  if (detailLevel === 'CONFIDENTIAL') {
    check(unblurred.length > 0, 'Real images available after the agreement');
    const social = realRows(listing.social_account);
    check(social.length > 0, 'Social accounts readable after the agreement');
  }

  // The 300-character cut can only be judged on a description long enough to
  // be cut. Saying nothing is better than reporting a pass that proves nothing.
  const description = (listing.advertisement || []).find((r) =>
    /description/i.test(String(r.question || '')),
  );
  const text = String(
    Array.isArray(description?.answer) ? description.answer[0] : description?.answer || '',
  );
  if (detailLevel === 'PUBLIC') {
    if (text.length < 300 && !LOCK.test(text)) {
      console.log(
        `  SKIP  Description cut at 300 characters\n          this listing's description is only ${text.length} characters — untestable`,
      );
    } else {
      check(text.length <= 320, 'Description cut at 300 characters', `got ${text.length}`);
    }
  }

  console.log(
    `\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}\n`,
  );
  // Set the code and let Node wind down on its own. Calling process.exit()
  // here aborts on Windows while fetch's sockets are still closing.
  process.exitCode = failures === 0 ? 0 : 1;
};

run().catch((error) => {
  console.error(`\nCould not finish: ${error.message}\n`);
  process.exitCode = 1;
});
