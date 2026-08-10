PRAGMA foreign_keys = ON;

CREATE TABLE app_meta (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  environment TEXT NOT NULL CHECK (environment IN ('production', 'preview')),
  database_id TEXT NOT NULL UNIQUE CHECK (length(database_id) BETWEEN 1 AND 128),
  initialized_at INTEGER NOT NULL
);

CREATE TRIGGER reject_app_meta_reinsert
BEFORE INSERT ON app_meta
WHEN EXISTS (
  SELECT 1 FROM app_meta WHERE singleton = NEW.singleton
)
BEGIN
  SELECT RAISE(ABORT, 'DATABASE_SENTINEL_IMMUTABLE');
END;

CREATE TRIGGER reject_app_meta_update
BEFORE UPDATE ON app_meta
BEGIN
  SELECT RAISE(ABORT, 'DATABASE_SENTINEL_IMMUTABLE');
END;

CREATE TRIGGER reject_app_meta_delete
BEFORE DELETE ON app_meta
BEGIN
  SELECT RAISE(ABORT, 'DATABASE_SENTINEL_IMMUTABLE');
END;

CREATE TABLE sync_enrollments (
  email_key TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TRIGGER enforce_enrollment_limit_insert
BEFORE INSERT ON sync_enrollments
WHEN NEW.enabled = 1 AND (
  SELECT COUNT(*) FROM sync_enrollments WHERE enabled = 1
) >= CASE (
  SELECT environment FROM app_meta WHERE singleton = 1
)
  WHEN 'production' THEN 12
  WHEN 'preview' THEN 1
  ELSE 0
END
BEGIN
  SELECT RAISE(ABORT, 'ENROLLMENT_LIMIT_REACHED');
END;

CREATE TRIGGER enforce_enrollment_limit_update
BEFORE UPDATE OF enabled ON sync_enrollments
WHEN OLD.enabled = 0 AND NEW.enabled = 1 AND (
  SELECT COUNT(*) FROM sync_enrollments WHERE enabled = 1
) >= CASE (
  SELECT environment FROM app_meta WHERE singleton = 1
)
  WHEN 'production' THEN 12
  WHEN 'preview' THEN 1
  ELSE 0
END
BEGIN
  SELECT RAISE(ABORT, 'ENROLLMENT_LIMIT_REACHED');
END;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email_key TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  access_sub TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('active', 'deleted')),
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  deleted_at INTEGER,
  CHECK (
    (status = 'active' AND email IS NOT NULL AND access_sub IS NOT NULL AND deleted_at IS NULL)
    OR
    (status = 'deleted' AND email IS NULL AND access_sub IS NULL AND deleted_at IS NOT NULL)
  )
);

CREATE TRIGGER reject_user_identity_reinsert
BEFORE INSERT ON users
WHEN EXISTS (
  SELECT 1 FROM users
  WHERE id = NEW.id
     OR email_key = NEW.email_key
     OR (NEW.email IS NOT NULL AND email = NEW.email)
     OR (NEW.access_sub IS NOT NULL AND access_sub = NEW.access_sub)
)
BEGIN
  SELECT RAISE(ABORT, 'USER_IDENTITY_IMMUTABLE');
END;

CREATE TRIGGER reject_user_identity_update
BEFORE UPDATE OF id, email_key ON users
BEGIN
  SELECT RAISE(ABORT, 'USER_IDENTITY_IMMUTABLE');
END;

CREATE TRIGGER reject_user_identity_conflict_update
BEFORE UPDATE OF email, access_sub ON users
WHEN EXISTS (
  SELECT 1 FROM users
  WHERE id != OLD.id
    AND (
      (NEW.email IS NOT NULL AND email = NEW.email)
      OR (NEW.access_sub IS NOT NULL AND access_sub = NEW.access_sub)
    )
)
BEGIN
  SELECT RAISE(ABORT, 'USER_IDENTITY_CONFLICT');
END;

CREATE TRIGGER reject_deleted_user_update
BEFORE UPDATE ON users
WHEN OLD.status = 'deleted'
BEGIN
  SELECT RAISE(ABORT, 'ACCOUNT_DELETED');
END;

CREATE TRIGGER reject_user_delete
BEFORE DELETE ON users
BEGIN
  SELECT RAISE(ABORT, 'ACCOUNT_TOMBSTONE_REQUIRED');
END;

CREATE TABLE identity_relinks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  old_access_sub_hash TEXT NOT NULL,
  new_access_sub_hash TEXT NOT NULL,
  confirmed_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE decks (
  user_id TEXT NOT NULL,
  deck_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  partner_card_num TEXT NOT NULL CHECK (length(partner_card_num) BETWEEN 1 AND 32),
  case_card_num TEXT NOT NULL CHECK (length(case_card_num) BETWEEN 1 AND 32),
  cards_json TEXT NOT NULL CHECK (
    json_valid(cards_json)
    AND json_type(cards_json) = 'array'
    AND length(cards_json) <= 65536
  ),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  client_modified_at INTEGER NOT NULL,
  server_updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, deck_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE deck_tombstones (
  user_id TEXT NOT NULL,
  deck_id TEXT NOT NULL,
  deleted_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, deck_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TRIGGER enforce_deck_tombstone_limit
BEFORE INSERT ON deck_tombstones
WHEN (
  SELECT COUNT(*) FROM deck_tombstones WHERE user_id = NEW.user_id
) >= 500
BEGIN
  SELECT RAISE(ABORT, 'TOMBSTONE_LIMIT_REACHED');
END;

CREATE TRIGGER reject_tombstoned_deck_insert
BEFORE INSERT ON decks
WHEN EXISTS (
  SELECT 1 FROM deck_tombstones
  WHERE user_id = NEW.user_id AND deck_id = NEW.deck_id
)
BEGIN
  SELECT RAISE(ABORT, 'DECK_TOMBSTONED');
END;

CREATE TRIGGER reject_tombstoned_deck_update
BEFORE UPDATE OF user_id, deck_id ON decks
WHEN EXISTS (
  SELECT 1 FROM deck_tombstones
  WHERE user_id = NEW.user_id AND deck_id = NEW.deck_id
)
BEGIN
  SELECT RAISE(ABORT, 'DECK_TOMBSTONED');
END;

CREATE TRIGGER delete_live_deck_after_tombstone
AFTER INSERT ON deck_tombstones
BEGIN
  DELETE FROM decks
  WHERE user_id = NEW.user_id AND deck_id = NEW.deck_id;
END;

CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY,
  active_deck_id TEXT,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  server_updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TRIGGER reject_invalid_active_deck_insert
BEFORE INSERT ON user_preferences
WHEN NEW.active_deck_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM decks
  WHERE user_id = NEW.user_id AND deck_id = NEW.active_deck_id
)
BEGIN
  SELECT RAISE(ABORT, 'ACTIVE_DECK_INVALID');
END;

CREATE TRIGGER reject_invalid_active_deck_update
BEFORE UPDATE OF user_id, active_deck_id ON user_preferences
WHEN NEW.active_deck_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM decks
  WHERE user_id = NEW.user_id AND deck_id = NEW.active_deck_id
)
BEGIN
  SELECT RAISE(ABORT, 'ACTIVE_DECK_INVALID');
END;

CREATE TRIGGER clear_preference_after_deck_delete
AFTER DELETE ON decks
BEGIN
  UPDATE user_preferences
  SET active_deck_id = NULL,
      revision = revision + 1,
      server_updated_at = COALESCE(
        (
          SELECT deleted_at FROM deck_tombstones
          WHERE user_id = OLD.user_id AND deck_id = OLD.deck_id
        ),
        server_updated_at
      )
  WHERE user_id = OLD.user_id AND active_deck_id = OLD.deck_id;
END;

CREATE TABLE matches (
  user_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  played_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at = played_at + 2592000000),
  first_ingested_at INTEGER NOT NULL,
  deck_id TEXT NOT NULL,
  deck_revision INTEGER NOT NULL CHECK (deck_revision >= 1),
  deck_name_snapshot TEXT NOT NULL CHECK (length(deck_name_snapshot) BETWEEN 1 AND 80),
  cpu_requested_difficulty TEXT NOT NULL CHECK (
    cpu_requested_difficulty IN ('weak', 'normal', 'strong')
  ),
  cpu_effective_difficulty TEXT NOT NULL CHECK (
    cpu_effective_difficulty IN ('weak', 'normal', 'strong')
  ),
  cpu_policy_version TEXT NOT NULL CHECK (length(cpu_policy_version) BETWEEN 1 AND 80),
  outcome TEXT NOT NULL CHECK (outcome IN ('win', 'loss')),
  turn_count INTEGER NOT NULL CHECK (turn_count BETWEEN 1 AND 1000),
  app_version TEXT NOT NULL CHECK (length(app_version) BETWEEN 1 AND 120),
  request_hash TEXT NOT NULL,
  PRIMARY KEY (user_id, match_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE user_match_stats (
  user_id TEXT PRIMARY KEY,
  matches INTEGER NOT NULL CHECK (matches >= 0),
  wins INTEGER NOT NULL CHECK (wins >= 0),
  losses INTEGER NOT NULL CHECK (losses >= 0),
  CHECK (matches = wins + losses),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TRIGGER enforce_retained_match_limit
BEFORE INSERT ON matches
WHEN COALESCE(
  (SELECT matches FROM user_match_stats WHERE user_id = NEW.user_id),
  0
) >= 250
BEGIN
  SELECT RAISE(ABORT, 'MATCH_LIMIT_REACHED');
END;

CREATE TRIGGER update_match_stats_after_insert
AFTER INSERT ON matches
BEGIN
  INSERT INTO user_match_stats (user_id, matches, wins, losses)
  VALUES (
    NEW.user_id,
    1,
    CASE WHEN NEW.outcome = 'win' THEN 1 ELSE 0 END,
    CASE WHEN NEW.outcome = 'loss' THEN 1 ELSE 0 END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    matches = user_match_stats.matches + 1,
    wins = user_match_stats.wins + CASE WHEN NEW.outcome = 'win' THEN 1 ELSE 0 END,
    losses = user_match_stats.losses + CASE WHEN NEW.outcome = 'loss' THEN 1 ELSE 0 END;
END;

CREATE TRIGGER update_match_stats_after_delete
AFTER DELETE ON matches
BEGIN
  UPDATE user_match_stats
  SET matches = matches - 1,
      wins = wins - CASE WHEN OLD.outcome = 'win' THEN 1 ELSE 0 END,
      losses = losses - CASE WHEN OLD.outcome = 'loss' THEN 1 ELSE 0 END
  WHERE user_id = OLD.user_id;
END;

CREATE TRIGGER reject_match_stats_owner_update
BEFORE UPDATE OF user_id ON user_match_stats
BEGIN
  SELECT RAISE(ABORT, 'OWNER_IMMUTABLE');
END;

CREATE TRIGGER reject_active_match_stats_delete
BEFORE DELETE ON user_match_stats
WHEN COALESCE(
  (SELECT status FROM users WHERE id = OLD.user_id),
  'active'
) != 'deleted'
BEGIN
  SELECT RAISE(ABORT, 'MATCH_STATS_IMMUTABLE');
END;

CREATE TABLE idempotency_keys (
  user_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  operation TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'complete' CHECK (state IN ('pending', 'complete')),
  lease_token TEXT NOT NULL DEFAULT '' CHECK (length(lease_token) <= 128),
  lease_expires_at INTEGER NOT NULL DEFAULT 0,
  response_status INTEGER NOT NULL,
  response_json TEXT NOT NULL CHECK (json_valid(response_json)),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at),
  CHECK (
    (
      state = 'pending'
      AND length(lease_token) >= 16
      AND lease_expires_at > created_at
      AND lease_expires_at <= expires_at
      AND response_status = 0
      AND response_json = 'null'
    )
    OR
    (
      state = 'complete'
      AND response_status BETWEEN 200 AND 599
    )
  ),
  PRIMARY KEY (user_id, idempotency_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE rate_limit_buckets (
  user_id TEXT NOT NULL,
  route_class TEXT NOT NULL,
  bucket_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count >= 1),
  minute_start INTEGER NOT NULL DEFAULT 0,
  minute_count INTEGER NOT NULL DEFAULT 1 CHECK (
    minute_count >= 1 AND minute_count <= request_count
  ),
  PRIMARY KEY (user_id, route_class, bucket_start),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE deletion_challenges (
  user_id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TRIGGER cleanup_expired_records_after_match_insert
AFTER INSERT ON matches
BEGIN
  DELETE FROM matches
  WHERE rowid IN (
    SELECT rowid FROM matches
    WHERE expires_at <= NEW.first_ingested_at
    ORDER BY expires_at, rowid
    LIMIT 2
  );
  DELETE FROM idempotency_keys
  WHERE rowid IN (
    SELECT rowid FROM idempotency_keys
    WHERE expires_at <= NEW.first_ingested_at
    ORDER BY expires_at, rowid
    LIMIT 2
  );
  DELETE FROM deletion_challenges
  WHERE rowid IN (
    SELECT rowid FROM deletion_challenges
    WHERE expires_at <= NEW.first_ingested_at
    ORDER BY expires_at, rowid
    LIMIT 2
  );
END;

CREATE TRIGGER cleanup_old_rate_buckets_after_insert
AFTER INSERT ON rate_limit_buckets
BEGIN
  DELETE FROM rate_limit_buckets
  WHERE rowid IN (
    SELECT rowid FROM rate_limit_buckets
    WHERE bucket_start < NEW.bucket_start - 86400000
    ORDER BY bucket_start, rowid
    LIMIT 10
  );
END;

CREATE TRIGGER reject_enrollment_identity_update
BEFORE UPDATE OF email_key ON sync_enrollments
BEGIN
  SELECT RAISE(ABORT, 'ENROLLMENT_IDENTITY_IMMUTABLE');
END;

CREATE TRIGGER reject_identity_relink_owner_update
BEFORE UPDATE ON identity_relinks
BEGIN
  SELECT RAISE(ABORT, 'IDENTITY_RELINK_IMMUTABLE');
END;

CREATE TRIGGER reject_identity_relink_reinsert
BEFORE INSERT ON identity_relinks
WHEN EXISTS (
  SELECT 1 FROM identity_relinks WHERE id = NEW.id
)
BEGIN
  SELECT RAISE(ABORT, 'IDENTITY_RELINK_IMMUTABLE');
END;

CREATE TRIGGER reject_active_identity_relink_delete
BEFORE DELETE ON identity_relinks
WHEN COALESCE(
  (SELECT status FROM users WHERE id = OLD.user_id),
  'active'
) != 'deleted'
BEGIN
  SELECT RAISE(ABORT, 'IDENTITY_RELINK_IMMUTABLE');
END;

CREATE TRIGGER reject_deck_identity_update
BEFORE UPDATE OF user_id, deck_id ON decks
BEGIN
  SELECT RAISE(ABORT, 'DECK_IDENTITY_IMMUTABLE');
END;

CREATE TRIGGER reject_deck_delete_without_tombstone
BEFORE DELETE ON decks
WHEN COALESCE(
  (SELECT status FROM users WHERE id = OLD.user_id),
  'active'
) = 'active'
AND NOT EXISTS (
  SELECT 1 FROM deck_tombstones
  WHERE user_id = OLD.user_id AND deck_id = OLD.deck_id
)
BEGIN
  SELECT RAISE(ABORT, 'DECK_DELETE_REQUIRES_TOMBSTONE');
END;

CREATE TRIGGER reject_deck_tombstone_update
BEFORE UPDATE ON deck_tombstones
BEGIN
  SELECT RAISE(ABORT, 'DECK_TOMBSTONE_IMMUTABLE');
END;

CREATE TRIGGER reject_deck_tombstone_reinsert
BEFORE INSERT ON deck_tombstones
WHEN EXISTS (
  SELECT 1 FROM deck_tombstones
  WHERE user_id = NEW.user_id AND deck_id = NEW.deck_id
)
BEGIN
  SELECT RAISE(ABORT, 'DECK_TOMBSTONE_IMMUTABLE');
END;

CREATE TRIGGER reject_active_account_tombstone_delete
BEFORE DELETE ON deck_tombstones
WHEN COALESCE(
  (SELECT status FROM users WHERE id = OLD.user_id),
  'active'
) != 'deleted'
BEGIN
  SELECT RAISE(ABORT, 'DECK_TOMBSTONE_IMMUTABLE');
END;

CREATE TRIGGER reject_preference_owner_update
BEFORE UPDATE OF user_id ON user_preferences
BEGIN
  SELECT RAISE(ABORT, 'OWNER_IMMUTABLE');
END;

CREATE TRIGGER reject_match_owner_update
BEFORE UPDATE ON matches
BEGIN
  SELECT RAISE(ABORT, 'MATCH_IMMUTABLE');
END;

CREATE TRIGGER reject_match_reinsert
BEFORE INSERT ON matches
WHEN EXISTS (
  SELECT 1 FROM matches
  WHERE user_id = NEW.user_id AND match_id = NEW.match_id
)
BEGIN
  SELECT RAISE(ABORT, 'MATCH_IMMUTABLE');
END;

CREATE TRIGGER reject_idempotency_identity_update
BEFORE UPDATE OF user_id, idempotency_key, operation, request_hash,
                 created_at, expires_at ON idempotency_keys
BEGIN
  SELECT RAISE(ABORT, 'IDEMPOTENCY_RECORD_IMMUTABLE');
END;

CREATE TRIGGER reject_idempotency_state_rewrite
BEFORE UPDATE ON idempotency_keys
WHEN OLD.state = 'complete'
  OR (
    OLD.state = 'pending' AND NEW.state = 'pending'
    AND (
      NEW.lease_token = OLD.lease_token
      OR NEW.lease_expires_at <= OLD.lease_expires_at
      OR NEW.response_status != 0
      OR NEW.response_json != 'null'
    )
  )
  OR (
    OLD.state = 'pending' AND NEW.state = 'complete'
    AND (
      NEW.lease_token != OLD.lease_token
      OR NEW.lease_expires_at != OLD.lease_expires_at
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'IDEMPOTENCY_RECORD_IMMUTABLE');
END;

CREATE TRIGGER reject_idempotency_reinsert
BEFORE INSERT ON idempotency_keys
WHEN EXISTS (
  SELECT 1 FROM idempotency_keys
  WHERE user_id = NEW.user_id AND idempotency_key = NEW.idempotency_key
)
BEGIN
  SELECT RAISE(ABORT, 'IDEMPOTENCY_RECORD_IMMUTABLE');
END;

CREATE TRIGGER reject_rate_limit_owner_update
BEFORE UPDATE OF user_id ON rate_limit_buckets
BEGIN
  SELECT RAISE(ABORT, 'OWNER_IMMUTABLE');
END;

CREATE TRIGGER reject_deletion_challenge_owner_update
BEFORE UPDATE OF user_id ON deletion_challenges
BEGIN
  SELECT RAISE(ABORT, 'OWNER_IMMUTABLE');
END;

CREATE TRIGGER reject_deleted_user_identity_relink
BEFORE INSERT ON identity_relinks
WHEN COALESCE((SELECT status FROM users WHERE id = NEW.user_id), 'deleted') != 'active'
BEGIN
  SELECT RAISE(ABORT, 'ACCOUNT_DELETED');
END;

CREATE TRIGGER reject_deleted_user_deck
BEFORE INSERT ON decks
WHEN COALESCE((SELECT status FROM users WHERE id = NEW.user_id), 'deleted') != 'active'
BEGIN
  SELECT RAISE(ABORT, 'ACCOUNT_DELETED');
END;

CREATE TRIGGER reject_deleted_user_deck_tombstone
BEFORE INSERT ON deck_tombstones
WHEN COALESCE((SELECT status FROM users WHERE id = NEW.user_id), 'deleted') != 'active'
BEGIN
  SELECT RAISE(ABORT, 'ACCOUNT_DELETED');
END;

CREATE TRIGGER reject_deleted_user_preference
BEFORE INSERT ON user_preferences
WHEN COALESCE((SELECT status FROM users WHERE id = NEW.user_id), 'deleted') != 'active'
BEGIN
  SELECT RAISE(ABORT, 'ACCOUNT_DELETED');
END;

CREATE TRIGGER reject_deleted_user_match
BEFORE INSERT ON matches
WHEN COALESCE((SELECT status FROM users WHERE id = NEW.user_id), 'deleted') != 'active'
BEGIN
  SELECT RAISE(ABORT, 'ACCOUNT_DELETED');
END;

CREATE TRIGGER reject_deleted_user_idempotency_key
BEFORE INSERT ON idempotency_keys
WHEN COALESCE((SELECT status FROM users WHERE id = NEW.user_id), 'deleted') != 'active'
BEGIN
  SELECT RAISE(ABORT, 'ACCOUNT_DELETED');
END;

CREATE TRIGGER reject_deleted_user_rate_limit_bucket
BEFORE INSERT ON rate_limit_buckets
WHEN COALESCE((SELECT status FROM users WHERE id = NEW.user_id), 'deleted') != 'active'
BEGIN
  SELECT RAISE(ABORT, 'ACCOUNT_DELETED');
END;

CREATE TRIGGER reject_deleted_user_deletion_challenge
BEFORE INSERT ON deletion_challenges
WHEN COALESCE((SELECT status FROM users WHERE id = NEW.user_id), 'deleted') != 'active'
BEGIN
  SELECT RAISE(ABORT, 'ACCOUNT_DELETED');
END;

CREATE TRIGGER reject_deleted_email_enrollment
BEFORE INSERT ON sync_enrollments
WHEN EXISTS (
  SELECT 1 FROM users
  WHERE email_key = NEW.email_key AND status = 'deleted'
)
BEGIN
  SELECT RAISE(ABORT, 'ACCOUNT_DELETED');
END;

CREATE TRIGGER delete_owned_data_after_account_tombstone
AFTER UPDATE OF status ON users
WHEN OLD.status = 'active' AND NEW.status = 'deleted'
BEGIN
  DELETE FROM identity_relinks WHERE user_id = NEW.id;
  DELETE FROM decks WHERE user_id = NEW.id;
  DELETE FROM deck_tombstones WHERE user_id = NEW.id;
  DELETE FROM user_preferences WHERE user_id = NEW.id;
  DELETE FROM matches WHERE user_id = NEW.id;
  DELETE FROM user_match_stats WHERE user_id = NEW.id;
  DELETE FROM idempotency_keys WHERE user_id = NEW.id;
  DELETE FROM rate_limit_buckets WHERE user_id = NEW.id;
  DELETE FROM deletion_challenges WHERE user_id = NEW.id;
  DELETE FROM sync_enrollments WHERE email_key = NEW.email_key;
END;

CREATE INDEX decks_by_owner_updated
  ON decks(user_id, server_updated_at DESC);

CREATE INDEX matches_by_owner_played
  ON matches(user_id, played_at DESC, match_id);

CREATE INDEX matches_by_owner_deck
  ON matches(user_id, deck_id, played_at DESC);

CREATE INDEX matches_by_owner_expiry
  ON matches(user_id, expires_at);

CREATE INDEX matches_by_expiry
  ON matches(expires_at);

CREATE INDEX idempotency_by_expiry
  ON idempotency_keys(expires_at);

CREATE INDEX rate_limit_by_bucket
  ON rate_limit_buckets(bucket_start);

CREATE INDEX deletion_challenges_by_expiry
  ON deletion_challenges(expires_at);
