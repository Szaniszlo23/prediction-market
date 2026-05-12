# QFin Polymarket

A fully functional prediction market platform where users trade on the outcomes of real-world events. Built with **Next.js 14**, **Supabase**, and deployed on **Vercel**.

---

## Features

### Trading
- **Buy YES or NO** on any binary market question (e.g. "Will Bitcoin hit $100k?")
- **Categorical markets** — pick which single outcome wins from a list (e.g. "Who wins the election?")
- **Multi-outcome markets** — each sub-question is independent with its own YES/NO (e.g. "Which features will ship?")
- **Live cost preview** — see exactly what you will pay and the new price before confirming
- **Sell shares at any time** — exit a position early and receive the current market value

### Portfolio
- View all open positions across every market
- Tracks cost basis, current value, and unrealised P&L per market
- Sell buttons embedded directly in your portfolio

### Market Resolution
- Admins resolve markets when the outcome is known
- Winning shareholders receive **$1.00 per winning share**
- Invalid markets (e.g. cancelled events) are refunded at cost

### Leaderboard
- Ranked by current balance
- Shows P&L vs the $1,000 starting balance, total trade volume, and trade count
- Your own row is highlighted

### Comments
- Each market has a live discussion thread
- Messages update in real time via Supabase Realtime

### Auth
- Email + password sign up with a required unique username
- Username appears on the leaderboard and in comments
- Middleware enforces username setup before accessing the app

---

## How the Market Maker Works (LMSR)

The platform uses a **Logarithmic Market Scoring Rule (LMSR)** automated market maker. There is no order book and no need for a counterparty — the market maker always accepts trades at a mathematically derived price.

### The Core Formula

For a binary market the cost function is:

```
C(q_yes, q_no) = b × ln(e^(q_yes/b) + e^(q_no/b))
```

Where:
- `q_yes` — total YES shares outstanding
- `q_no` — total NO shares outstanding
- `b` — the **liquidity parameter** (more on this below)

The **cost of buying `n` YES shares** is the difference in the cost function before and after:

```
cost = C(q_yes + n, q_no) − C(q_yes, q_no)
```

And the **current YES price** (the implied probability) is derived from the gradient:

```
P(YES) = e^(q_yes/b) / (e^(q_yes/b) + e^(q_no/b))
```

This is a softmax function — the price is always between 0 and 1, and YES + NO prices always sum to exactly 1.

### Categorical Markets

For markets with 3 or more outcomes (e.g. an election with multiple candidates), the formula generalises to a softmax over all outcomes:

```
C(q₁, q₂, ..., qₙ) = b × ln(Σ e^(qᵢ/b))
```

```
P(outcome i) = e^(qᵢ/b) / Σ e^(qⱼ/b)
```

All probabilities always sum to exactly 1, regardless of how many outcomes exist.

### Selling Shares

Selling is the exact reverse of buying. If you sell `n` YES shares, the outstanding quantity `q_yes` decreases, and you receive the resulting decrease in the cost function:

```
proceeds = C(q_yes, q_no) − C(q_yes − n, q_no)
```

You always sell at the current market price — if the probability has moved in your favour since you bought, you profit on the difference. Selling is always possible; there is no liquidity risk.

---

## The Liquidity Parameter (`b`)

`b` controls how much prices move per trade. It is the single most important market configuration value.

| `b` value | Behaviour |
|---|---|
| **Low (e.g. 50)** | Prices move a lot per trade. A single $10 purchase can shift the probability by 10–20%. High sensitivity, lower market maker subsidy needed. |
| **High (e.g. 500)** | Prices barely move. The market is "thick" — large volume is needed to shift probability. Lower sensitivity, higher market maker exposure. |

**Intuition:** `b` is roughly the dollar amount needed to move the price from 50% to ~73% (a shift of `ln(2)` ≈ 0.69 in log-odds). A market with `b = 100` requires around $69 of net one-sided buying pressure to shift from 50/50 to 73/27.

When a market is created, both `q_yes` and `q_no` are seeded with equal values so that prices start at exactly **50/50** regardless of the chosen `b`.

---

## Fees

Every trade (buy or sell) has a flat **1% fee** on the gross cost or proceeds:

```
total_cost    = gross_cost × 1.01        (buying)
net_proceeds  = gross_proceeds × 0.99    (selling)
```

Fees accumulate in the market's `fees_collected` column and are visible in the market detail page.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Realtime | Supabase Realtime (comments) |
| Trade logic | PostgreSQL stored procedures (RPC) |
| Styling | Tailwind CSS |
| Deployment | Vercel |

### Why stored procedures for trades?

All trade logic — balance deduction, position update, outcome quantity update, and trade recording — runs inside a single **PostgreSQL transaction** via `supabase.rpc('place_trade', {...})`. This means:

- **Atomic** — either everything succeeds or nothing does. No partial failures leaving the database in an inconsistent state.
- **Secure** — the function runs as `SECURITY DEFINER`, so it can update balances without exposing a service-role key to the browser.
- **Simple** — the frontend sends one RPC call and gets back the full cost breakdown.

---

## Getting Started Locally

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier is fine)

### Setup

```bash
git clone <your-repo-url>
cd prediction-market
npm install
```

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Database

Run the SQL migrations in your Supabase SQL Editor to create the following tables:

| Table | Purpose |
|---|---|
| `profiles` | User accounts, username, balance |
| `markets` | Market questions and config |
| `outcomes` | The tradeable outcomes per market |
| `trades` | Full trade history |
| `positions` | Per-user share holdings |
| `comments` | Market discussion threads |

And the RPC functions:

| Function | Purpose |
|---|---|
| `place_trade` | Atomic buy execution |
| `sell_shares` | Atomic sell execution |
| `resolve_outcome` | Binary/multi market resolution |
| `resolve_categorical` | Categorical market resolution |

---

## Project Structure

```
app/
  page.tsx              # Market browse / home feed
  markets/[id]/         # Market detail, trading, charts, comments
  portfolio/            # User positions and P&L
  leaderboard/          # Global rankings
  admin/                # Market creation and resolution
  login/                # Email + password login
  signup/               # New account with username
  setup/                # Username setup for legacy accounts
components/
  markets/
    TradeDialog.tsx     # Buy shares modal
    SellDialog.tsx      # Sell shares modal
    CommentsSection.tsx # Live discussion with Realtime
    PriceCharts.tsx     # Price history charts
  Navbar.tsx
lib/
  pricing.ts            # Pure LMSR formulas (no side-effects)
  supabase/             # Client, server, and middleware helpers
```

---

## Starting Balance

Every new user starts with **$1,000** of virtual currency. No real money is involved — this is a play-money platform for learning forecasting, testing intuitions, and competing with friends.
