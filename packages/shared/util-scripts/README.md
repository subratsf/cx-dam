# Database Utility Scripts

This folder contains utility scripts for managing the CX-DAM database.

## Prerequisites

- `psql` command-line tool must be installed
- `DATABASE_URL` environment variable must be set, or a `.env` file must exist in the project root

## Scripts

### 🧹 `clean-all-data.sh`
**Deletes ALL data from assets and bloom_filter_state tables**

```bash
./clean-all-data.sh
```

**What it does:**
- Shows current record counts
- Asks for confirmation (type `yes` to proceed)
- Deletes all assets
- Deletes all bloom filters
- Shows final counts

**⚠️ WARNING:** This is destructive and cannot be undone!

---

### 🗑️ `clean-orphaned-assets.sh`
**Removes orphaned asset records (Stage state, older than 1 hour)**

```bash
./clean-orphaned-assets.sh
```

**What it does:**
- Finds assets in 'Stage' state older than 1 hour
- Shows the list of orphaned records
- Asks for confirmation
- Deletes the orphaned records

**Use case:** When S3 uploads fail, database records may remain in 'Stage' state. This script cleans them up.

---

### 📊 `view-data-stats.sh`
**Shows database statistics and insights**

```bash
./view-data-stats.sh
```

**What it shows:**
- Total record counts (assets, bloom filters, users)
- Assets grouped by workspace
- Assets grouped by file type
- Orphaned assets count and age
- Bloom filters by workspace

**Use case:** Quick overview of database contents without making any changes.

---

## Usage from Project Root

All scripts can be run from the project root:

```bash
# View stats
./packages/shared/util-scripts/view-data-stats.sh

# Clean orphaned assets
./packages/shared/util-scripts/clean-orphaned-assets.sh

# Clean ALL data (destructive!)
./packages/shared/util-scripts/clean-all-data.sh
```

## Usage from util-scripts folder

Or navigate to the folder first:

```bash
cd packages/shared/util-scripts

./view-data-stats.sh
./clean-orphaned-assets.sh
./clean-all-data.sh
```

## Environment Variables

The scripts will look for `DATABASE_URL` in this order:
1. Environment variable `$DATABASE_URL`
2. `../../.env` (project root .env file)
3. `.env` (current directory .env file)

Example `DATABASE_URL`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/cx_dam
```

## Troubleshooting

### "DATABASE_URL not found"
Make sure you have a `.env` file in the project root with `DATABASE_URL` set, or export it in your shell:
```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/cx_dam"
```

### "psql: command not found"
Install PostgreSQL client tools:
- **Mac:** `brew install postgresql`
- **Ubuntu/Debian:** `sudo apt-get install postgresql-client`
- **Windows:** Download from https://www.postgresql.org/download/windows/

### Permission denied
Make sure scripts are executable:
```bash
chmod +x *.sh
```

## Safety Features

- All destructive operations require confirmation (`yes`)
- Scripts show what they will do before doing it
- Non-zero exit codes on errors (`set -e`)
- Clear success/failure messages
