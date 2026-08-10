INSERT INTO app_meta (singleton, environment, database_id, initialized_at)
VALUES (1, 'production', 'production-database', unixepoch('now') * 1000);
