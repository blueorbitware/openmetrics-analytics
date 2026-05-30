# Database Scripts

## Quick Setup

### 1. PostgreSQL Setup

SSH into your server and run:

```bash
# Get into PostgreSQL
docker exec -it $(docker ps -qf "name=analytics-db") psql -U postgres -d postgres

# Then copy/paste the contents of seed.sql
```

Or run directly:
```bash
docker exec -i $(docker ps -qf "name=analytics-db") psql -U postgres -d postgres < seed.sql
```

### 2. ClickHouse Setup

```bash
# Get into ClickHouse
docker exec -it $(docker ps -qf "name=analytics-clickhouse") clickhouse-client --user clickhouse --password YOUR_PASSWORD

# Then copy/paste the contents of seed-clickhouse.sql
```

## Default Super Admin

After running seed.sql, you can login with:

- **Email:** `admin@analytics.local`
- **Password:** `SuperAdmin123!`

## User Management

Public registration is disabled. Only super admins can create users via:

- **API:** `POST /v1/super/users`
- **Dashboard:** Settings → User Management (coming soon)

## Files

- `seed.sql` - PostgreSQL tables and super admin user
- `seed-clickhouse.sql` - ClickHouse events table
