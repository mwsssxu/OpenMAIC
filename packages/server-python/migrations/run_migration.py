import asyncio
import asyncpg

async def migrate():
    conn = await asyncpg.connect('postgres://postgres:0okm9ijn@postgres:5432/postgres')
    try:
        await conn.execute('ALTER TABLE stages ADD COLUMN IF NOT EXISTS pending_outlines JSONB DEFAULT NULL')
        print("Migration successful: pending_outlines column added")
    except Exception as e:
        print(f"Migration error: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(migrate())