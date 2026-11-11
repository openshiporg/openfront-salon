// Crawl every dashboard and storefront page as the demo admin; prints PASS/FAIL per page.
// Usage: CRAWL_BASE=http://localhost:3964 CRAWL_LOGINS=/path/salon.json node scripts/r6-crawl.mjs
import fs from 'node:fs'
import { chromium } from '/Users/junaid/Code/vibeghost/vibeghost/node_modules/playwright/index.mjs'
const BASE = process.env.CRAWL_BASE
const me = JSON.parse(fs.readFileSync(process.env.CRAWL_LOGINS, 'utf8'))
async function gql(query, cookie) {
  const r = await fetch(BASE + '/api/graphql', { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify({ query }) })
  return r.json()
}
const t = (await (await fetch(BASE + '/api/graphql', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: 'mutation($e:String!,$p:String!){authenticateUserWithPassword(email:$e,password:$p){... on UserAuthenticationWithPasswordSuccess{sessionToken}}}', variables: { e: me.email, p: me.password } }) })).json()).data?.authenticateUserWithPassword?.sessionToken
if (!t) { console.log('CHECK login: FAIL'); process.exit(1) }
const cookie = 'keystonejs-session=' + t
const d = (await gql(`{clients(take:1){id} appointments(take:1){id} services(take:1){id} stylists(take:1){id} salonTransactions(take:1){id} staffs: stylists(take:1){id}}`, cookie))
if (!d.data) { console.log('CHECK ids: FAIL ' + JSON.stringify(d.errors?.[0]?.message)); process.exit(1) }
const id = (k) => d.data[k]?.[0]?.id
const lists = ['waitlist','commissions','clients','gift-cards','sales','appointments','appointments/new','catalog','resources','store-settings','loyalty','schedules','checkout','engagement','integrations','inventory','consultations','benefits','administration','staff','reports','reviews']
const dash = lists.map((l) => '/dashboard/platform/' + l)
if (id('clients')) dash.push('/dashboard/platform/clients/' + id('clients'))
if (id('appointments')) dash.push('/dashboard/platform/appointments/' + id('appointments'), '/dashboard/platform/checkout/' + id('appointments'))
if (id('services')) dash.push('/dashboard/platform/catalog/' + id('services'))
if (id('stylists')) dash.push('/dashboard/platform/staff/' + id('stylists'))
if (id('salonTransactions')) dash.push('/dashboard/platform/sales/' + id('salonTransactions'))
dash.push('/dashboard', '/dashboard/users', '/dashboard/payments', '/dashboard/appointments')
const store = ['/', '/services', '/stylists', '/team', '/gallery', '/reviews', '/contact', '/memberships', '/gift-cards', '/book', '/account/signin', '/account/signup', '/appointments', '/account', '/pay']
if (id('services')) store.push('/services/' + id('services'))
if (id('stylists')) store.push('/team/' + id('stylists'))
const nope = ['/dashboard/platform/clients/nope123', '/dashboard/platform/appointments/nope123', '/dashboard/platform/staff/nope123', '/dashboard/platform/catalog/nope123', '/dashboard/platform/sales/nope123', '/dashboard/platform/checkout/nope123', '/dashboard/users/nope123', '/services/nope123', '/team/nope123', '/booking/nope123']
const b = await chromium.launch({ executablePath: process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-mac-arm64/chrome-headless-shell' })
let bad = 0, n = 0
async function run(label, ctx, paths, expect404) {
  const p = await ctx.newPage()
  for (const path of paths) {
    const r = await p.goto(BASE + path, { waitUntil: 'load', timeout: 90000 }).catch(() => null)
    await p.waitForTimeout(800); const txt = await p.evaluate(() => document.body.innerText).catch(() => '')
    const http = r?.status() ?? 0
    const broken = /this page could not be loaded|something went wrong|application error|QUERY_TOO_BROAD|too broad|Internal Server Error/i.test(txt)
    const ok = expect404 ? http === 404 : http === 200 && !broken
    n++; if (!ok) bad++
    console.log(`CHECK ${label} ${path}: ${ok ? 'PASS' : 'FAIL'} (${http}${expect404 ? ' expect 404' : ''}${broken ? ' broken-text' : ''})`)
  }
}
const anon = await b.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true })
await run('anon', anon, store, false)
await run('anon', anon, ['/services/nope123', '/team/nope123', '/booking/nope123'], true)
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true })
const p = await ctx.newPage()
await p.goto(BASE + '/dashboard/signin')
await p.fill('input[name=email]', me.email); await p.fill('input[name=password]', me.password)
await Promise.all([p.waitForURL((u) => !u.pathname.includes('signin'), { timeout: 30000 }), p.click('button[type=submit]')])
await run('owner', ctx, dash, false)
await run('owner', ctx, nope.filter((x) => x.startsWith('/dashboard')), true)
await b.close()
console.log(`CHECK summary: ${bad ? 'FAIL' : 'PASS'} (${n - bad}/${n})`)
