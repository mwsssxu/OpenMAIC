import asyncio
import asyncpg

async def migrate():
    conn = await asyncpg.connect('postgres://postgres:0okm9ijn@postgres:5432/postgres')
    try:
        # Add tags column
        await conn.execute('ALTER TABLE stages ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT \'[]\'::jsonb')
        print("Migration successful: tags column added")

        # Add generated_agent_configs column if not exists
        await conn.execute('ALTER TABLE stages ADD COLUMN IF NOT EXISTS generated_agent_configs JSONB DEFAULT NULL')
        print("Migration successful: generated_agent_configs column added")
    except Exception as e:
        print(f"Migration error: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(migrate())