CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY, email text UNIQUE NOT NULL, password_hash text NOT NULL,
 name text NOT NULL, institution text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 access_hash text UNIQUE NOT NULL, refresh_hash text UNIQUE NOT NULL,
 access_expires_at timestamptz NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS documents (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name text NOT NULL, type text NOT NULL, size bigint NOT NULL, storage_key text,
 status text NOT NULL DEFAULT 'processing', error text, folder text NOT NULL DEFAULT '', url text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS document_chunks (
 id uuid PRIMARY KEY, document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
 ordinal integer NOT NULL, page integer, text text NOT NULL, embedding vector(768) NOT NULL,
 UNIQUE(document_id, ordinal)
);
CREATE INDEX IF NOT EXISTS chunks_document_idx ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS documents_owner_idx ON documents(user_id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS processing_token uuid;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;
CREATE TABLE IF NOT EXISTS conversations (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS messages (
 id uuid PRIMARY KEY, conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN ('user','assistant')), content text NOT NULL,
 sources jsonb NOT NULL DEFAULT '[]', agent text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS generated_content (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 kind text NOT NULL, title text NOT NULL, data jsonb NOT NULL, source_ids jsonb NOT NULL DEFAULT '[]',
 citations jsonb NOT NULL DEFAULT '[]', mode text NOT NULL, version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pending_generation jsonb;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS source_ids jsonb NOT NULL DEFAULT '[]';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'general';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS artifact_ids jsonb NOT NULL DEFAULT '[]';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_ids jsonb NOT NULL DEFAULT '[]';
CREATE TABLE IF NOT EXISTS conversation_attachments (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
 name text NOT NULL, type text NOT NULL, size bigint NOT NULL, storage_key text NOT NULL,
 purpose text NOT NULL DEFAULT 'content', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS attachments_conversation_idx ON conversation_attachments(conversation_id);
CREATE TABLE IF NOT EXISTS content_versions (
 id uuid PRIMARY KEY, content_id uuid NOT NULL REFERENCES generated_content(id) ON DELETE CASCADE,
 version integer NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(content_id,version)
);
CREATE TABLE IF NOT EXISTS ai_usage (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 model text NOT NULL, tokens_input integer NOT NULL DEFAULT 0, tokens_output integer NOT NULL DEFAULT 0,
 request_type text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_usage_owner_date_idx ON ai_usage(user_id,created_at);
CREATE TABLE IF NOT EXISTS exports (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 content_id uuid REFERENCES generated_content(id) ON DELETE SET NULL,
 format text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS academic_context jsonb NOT NULL DEFAULT '{}';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'material';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS institutional_templates (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 document_id uuid REFERENCES documents(id) ON DELETE SET NULL, name text NOT NULL,
 kind text NOT NULL, structure jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE generated_content ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES institutional_templates(id) ON DELETE SET NULL;
ALTER TABLE generated_content ADD COLUMN IF NOT EXISTS template_snapshot jsonb;
CREATE TABLE IF NOT EXISTS password_resets (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS visual_assets (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 storage_key text NOT NULL, mime text NOT NULL, size bigint NOT NULL,
 caption text NOT NULL DEFAULT '', provenance text NOT NULL DEFAULT 'teacher', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS templates_owner_idx ON institutional_templates(user_id);
CREATE INDEX IF NOT EXISTS assets_owner_idx ON visual_assets(user_id);
CREATE TABLE IF NOT EXISTS stored_files (
 storage_key uuid PRIMARY KEY, driver text NOT NULL CHECK(driver IN ('local','s3','cloudinary')),
 created_at timestamptz NOT NULL DEFAULT now()
);
