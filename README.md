# Crossbook

Kalshi and Polymarket often list the same question. They don't always price it the same.
Crossbook shows both side by side, sorted by how far apart they are.

Live: **https://crossbook-682l.onrender.com**

I matched the topic pairs by hand. That turned out to be the whole problem, so most of this
README is about it.

One warning about the "gross edge" column: it's before fees. Don't read it as free money.
It leaves out Kalshi's fees and the fact that one venue settles in USD and the other onchain,
and it has no idea how thin the book is.

## What's in it

React with Vite and Tailwind on the front, Node and Express behind it, Postgres through Prisma.
Express serves the built client itself, so it's one origin and one process.

The board is a table on desktop and stacked cards on mobile. Rows fade in, and a spread badge
flashes when its number moves between refreshes. Open a topic and you get both venues' bid and
ask, links out to each market, a 48 hour chart of the two midpoints, and the note I wrote when
I matched the pair.

You can register and sign in. Sessions are cookies backed by Postgres, passwords are bcrypt,
request bodies go through zod, and the login and register routes are rate limited. Signed in,
you can star topics onto a watchlist.

Behind that, a poller hits both venues every five minutes and writes a snapshot per market,
which is what the chart draws from. Each venue is a class implementing one `VenueAdapter`
interface, so the rest of the app never knows which venue it's talking to. Topics retire
themselves once both venues close.

There are unit tests for the pricing math and both adapters, a probe script that checks the
two APIs still behave the way the adapters assume, and CI that typechecks, tests and builds
before deploying.

## Time spent

About six hours.

## Running it

Live link's above. Free tier, so if nobody's visited recently the first load takes 30 to 60
seconds while it wakes up.

Locally you need Node 20+ and a Postgres database. A free [Neon](https://neon.tech) project
is easiest.

```bash
git clone https://github.com/JonahFishman/crossbook.git
cd crossbook
cp .env.example .env
```

Fill in `DATABASE_URL` and `DATABASE_URL_UNPOOLED`. Neon gives you both, and Prisma needs the
unpooled one for migrations. Generate the two secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then:

```bash
npm install
npx prisma migrate deploy   # tables
npm run seed                # the 14 pairs
npm run probe               # fetch prices once so the board isn't empty

npm run dev:server          # :3000
npm run dev:client          # :5173, proxies /api
```

Open http://localhost:5173. To run it the way it's deployed, one process on one port:
`npm run build && NODE_ENV=production npm start`.

Also there: `npm test`, `npm run typecheck`.

## The matching problem

I tried to automate this first. My matcher scored Kalshi titles against Polymarket search
results and confidently paired "Will AOC run for Senate in 2028?" with "Will Republicans
control the Senate after the 2026 midterms?" because the prices were close. Obvious garbage
is easy to filter. The near-misses are what get you.

So I read both rulebooks for every pair and wrote down what I checked. That note shows on
each topic page.

I left the recession pair in on purpose, as a worked example of a near-miss. Kalshi
wants two consecutive negative GDP quarters inside a specific window. Polymarket takes a wider
window and will also resolve Yes if NBER just declares a recession. Polymarket is easier to
resolve Yes, so some of that 6-point gap is definitional rather than the venues disagreeing
about anything.

Which is my argument against ranking the board by biggest edge, if that comes up. Pairs that
resolve differently are exactly the pairs showing big gaps, so you'd sort your worst matches
to the top and label them opportunities. The recession row is the widest spread I have, and
it's badged with its edge struck through for that reason.

## Two API things worth knowing

Kalshi's orderbook has no ask side. Both arrays it returns are bids, which threw me for a
while. In a binary market YES and NO are the same bet from opposite ends, so selling YES at
p is bidding 1-p for NO. Best YES ask = 1 minus best NO bid.

What bothered me is that getting this backwards doesn't break anything. The site keeps working
and every number on it is quietly wrong. So the probe script verifies that identity against a
live orderbook rather than trusting my reasoning, and the adapter re-checks it on every fetch.

Polymarket sends `outcomes`, `outcomePrices` and `clobTokenIds` as JSON-encoded strings inside
an already-JSON response, so you parse twice. I also assert `outcomes[0] === "Yes"` instead of
assuming, since a flipped market would invert every price on the page silently. And
`/markets?search=` returns rows that make it look like a search endpoint. It isn't. Use
`/public-search`.

Two things I'd add next: fee modelling, since Kalshi's fees depend on price and volume and
folding them in is what would make the edge number real, and a nightly job proposing new pairs.
That job should rank candidates on how confidently the resolution criteria line up rather than
on edge, and I'd still approve them myself before anything hit the board.

Read-only public data from Kalshi and Polymarket. Not trading advice, not affiliated with
either.
