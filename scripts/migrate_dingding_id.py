#!/usr/bin/env python3
"""Manually separate DingTalk IDs from users.open_id.

Run while application instances and directory sync jobs are stopped, then start
the new application version. Preview is the default; only --apply writes data.
The script adds dingding_id if missing and includes soft-deleted users.
Nonempty open_id values without the literal, case-sensitive 'ou_' prefix move
to dingding_id. A conflicting destination aborts the entire data transaction.
On MySQL, adding the column is separate DDL and cannot be rolled back with data.

Python 3.10+. SQLite needs no extra dependency. For PostgreSQL install
'psycopg[binary]'; for MySQL install 'pymysql'. Passwords come from DB_PASSWORD
(or the environment variable named by --password-env), never command arguments.

Examples (append --apply after reviewing the preview):
  python scripts/migrate_dingding_id.py --db sqlite --database ./one-api.db
  python scripts/migrate_dingding_id.py --db postgres --host localhost \
      --database gateway --user admin
  python scripts/migrate_dingding_id.py --db mysql --host localhost \
      --database gateway --user admin
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import sqlite3
import sys
from typing import Any


def connect(args: argparse.Namespace) -> Any:
    if args.db == "sqlite":
        # mode=rw prevents a typo from silently creating an empty database.
        uri = Path(args.database).expanduser().resolve().as_uri() + "?mode=rw"
        return sqlite3.connect(uri, uri=True, isolation_level=None)
    connection_args = {
        "host": args.host,
        "user": args.user,
        "password": os.environ.get(args.password_env, ""),
        "connect_timeout": 10,
        "autocommit": True,
    }
    if args.db == "postgres":
        import psycopg

        return psycopg.connect(
            **connection_args, dbname=args.database, port=args.port or 5432
        )
    import pymysql

    return pymysql.connect(
        **connection_args,
        database=args.database,
        port=args.port or 3306,
        charset="utf8mb4",
    )


def inspect_users(cursor: Any, dialect: str) -> bool:
    if dialect == "sqlite":
        cursor.execute("PRAGMA table_info(users)")
        columns = {row[1] for row in cursor.fetchall()}
    elif dialect == "postgres":
        cursor.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = current_schema() AND table_name = 'users'"
        )
        columns = {row[0] for row in cursor.fetchall()}
    else:
        cursor.execute(
            "SELECT ENGINE FROM information_schema.tables "
            "WHERE table_schema = DATABASE() AND table_name = 'users'"
        )
        table = cursor.fetchone()
        if table is None or table[0].lower() != "innodb":
            raise ValueError("users must be an InnoDB table for transactional migration")
        cursor.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = DATABASE() AND table_name = 'users'"
        )
        columns = {row[0] for row in cursor.fetchall()}
    if not {"id", "open_id"}.issubset(columns):
        raise ValueError("users table with id and open_id columns was not found")
    return "dingding_id" in columns


def migrate_users(cursor: Any, dialect: str, has_column: bool, apply: bool) -> int:
    placeholder = "?" if dialect == "sqlite" else "%s"
    destination = "dingding_id" if has_column else "'' AS dingding_id"
    last_id = None
    count = 0
    while True:
        query = f"SELECT id, open_id, {destination} FROM users"
        params = ()
        if last_id is not None:
            query += f" WHERE id > {placeholder}"
            params = (last_id,)
        query += " ORDER BY id ASC LIMIT 500"
        if apply and dialect != "sqlite":
            query += " FOR UPDATE"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        if not rows:
            return count
        for user_id, open_id, dingding_id in rows:
            last_id = user_id
            # Python avoids SQL LIKE's '_' wildcard and database collation rules.
            if not open_id or open_id.startswith("ou_"):
                continue
            if dingding_id and dingding_id != open_id:
                raise ValueError(f"Conflicting dingding_id for user {user_id}")
            count += 1
            if apply:
                cursor.execute(
                    f"UPDATE users SET dingding_id = {placeholder}, open_id = '' "
                    f"WHERE id = {placeholder}",
                    (open_id, user_id),
                )
                if cursor.rowcount != 1:
                    raise ValueError(f"Unexpected update count for user {user_id}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--db", required=True, choices=("sqlite", "postgres", "mysql"))
    parser.add_argument("--database", required=True, help="Database name, or SQLite file path")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int)
    parser.add_argument("--user")
    parser.add_argument("--password-env", default="DB_PASSWORD")
    parser.add_argument("--apply", action="store_true", help="Add the column if missing and migrate data")
    args = parser.parse_args()
    connection = None
    cursor = None
    in_transaction = False
    try:
        connection = connect(args)
        cursor = connection.cursor()
        has_column = inspect_users(cursor, args.db)
        # Check conflicts before schema changes. Recheck under row locks on apply.
        count = migrate_users(cursor, args.db, has_column, False)
        print(f"Rows to migrate: {count} (including soft-deleted users)")
        if not has_column:
            print("The dingding_id column needs to be added")
        if not args.apply:
            print("Preview only; no changes written. Use --apply to execute.")
            return 0
        if args.db == "sqlite":
            cursor.execute("BEGIN IMMEDIATE")
        elif args.db == "postgres":
            cursor.execute("BEGIN")
        else:
            # MySQL DDL commits implicitly; create the column before data BEGIN.
            if not has_column:
                cursor.execute("ALTER TABLE users ADD COLUMN dingding_id VARCHAR(64) DEFAULT ''")
                has_column = True
            cursor.execute("START TRANSACTION")
        in_transaction = True
        if not has_column:
            cursor.execute("ALTER TABLE users ADD COLUMN dingding_id VARCHAR(64) DEFAULT ''")
        count = migrate_users(cursor, args.db, True, True)
        cursor.execute("COMMIT")
        in_transaction = False
        print(f"Migration committed: {count} rows. Matching legacy open_id values cleared.")
        return 0
    except Exception as error:
        if in_transaction and cursor is not None:
            try:
                cursor.execute("ROLLBACK")
            except Exception:
                print("Rollback could not be confirmed; inspect the database before retrying.", file=sys.stderr)
        if isinstance(error, ValueError):
            print(str(error), file=sys.stderr)
        elif isinstance(error, ImportError):
            print("Missing driver: install psycopg[binary] for PostgreSQL or pymysql for MySQL.", file=sys.stderr)
        else:
            # Driver errors can contain connection details or user identity data.
            print(f"Migration failed ({type(error).__name__}); check database access and schema.", file=sys.stderr)
        if args.apply and args.db == "mysql":
            print("Any added dingding_id column remains; MySQL DDL is not rolled back.", file=sys.stderr)
        return 1
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None:
            connection.close()


if __name__ == "__main__":
    raise SystemExit(main())
