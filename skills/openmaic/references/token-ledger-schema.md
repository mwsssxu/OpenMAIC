# Token/Points Ledger Schema (CeBan)

The OpenMAIC codebase has a misleading split: **balances live in account
tables, not on users**. Code written without checking schema typically
crashes at runtime.

## Reality

```
users
  ├── id (uuid, PK)
  ├── total_points  (legacy denormalized counter — DO NOT mutate directly)
  └── (no token_balance column — DOES NOT EXIST)

token_accounts                  point_accounts
  ├── id (uuid, NOT NULL, NO default)    ← must generate uuid.uuid4() in app
  ├── user_id (uuid, UNIQUE)             ← UPSERT key
  ├── balance (int)
  └── created_at / updated_at

token_transactions              point_transactions
  ├── id (uuid, NOT NULL, NO default)    ← must generate uuid.uuid4() in app
  ├── user_id, type, amount
  ├── balance_after (int)                ← snapshot for audit
  ├── description, reference_id
  └── created_at

admin_logs
  ├── id (uuid, default gen_random_uuid())  ← only this one has a default
  ├── admin_id (uuid, FK → admins.id)
  ├── action, target (varchar — user_id stored as string)
  ├── details (text), created_at
```

## Common bug: writing to users.token_balance

`gift_tokens_to_user` was 100% broken from the day it was written:

```python
# WRONG — column doesn't exist, every call 500s
await db.execute("UPDATE users SET token_balance = token_balance + $1 ...")

# CORRECT — UPSERT into token_accounts
await db.fetchval("""
    INSERT INTO token_accounts (id, user_id, balance, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $4)
    ON CONFLICT (user_id) DO UPDATE SET
        balance = token_accounts.balance + EXCLUDED.balance,
        updated_at = EXCLUDED.updated_at
    RETURNING balance
""", uuid.uuid4(), uuid.UUID(user_id), amount, utcnow())
```

## Pitfalls

1. **`id` columns have no DB default** on `token_accounts` and
   `token_transactions`. asyncpg won't auto-generate. Always pass
   `uuid.uuid4()` explicitly.
2. **asyncpg is strict about uuid types** — pass `uuid.UUID(str)`, not raw
   strings, when the column type is `uuid`. `admin_logs.target` is `varchar`
   so a string user_id is fine there.
3. **First-time gifts**: a user may have no `token_accounts` row yet (auto-
   created on first transaction in normal flow). The UPSERT pattern above
   handles that — never assume the row exists.
4. **`balance_after` in transactions** is a snapshot, not a running total —
   record it from the UPSERT's RETURNING value, not by re-querying after the
   insert.
5. **`users.total_points`** is a legacy counter that may drift from
   `point_accounts.balance`. Treat `point_accounts.balance` as the source
   of truth; the users column exists for legacy queries only.

## Inline conversion-funnel UX

The profitability dashboard surfaces "high-cost / unpaid" users and offers
one-click gifting in the same view. Pattern:

- Backend returns `cost_only_users` ordered by cost desc, with email/nickname
  joined for identification.
- Frontend table has a "赠 Token" action per row → modal with quick-pick
  presets (20/50/100/200) → POSTs to `/admin/users/{id}/gift-tokens`
  with amount + reason → auto-refreshes the dashboard on success.

This closes the loop: spot the cost-burner → reward + retain → watch
profit_today move. No leaving the dashboard, no copy-pasting UUIDs.
