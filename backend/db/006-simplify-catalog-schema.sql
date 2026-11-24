-- Keep previous asset notes and specifications in the Admin audit history.
INSERT INTO audit_log(id,action,entity,entity_id,details)
SELECT gen_random_uuid(), 'archive-asset-details', 'assets', id,
       jsonb_build_object('notes', notes, 'specs', specs)
FROM assets
WHERE notes <> '' OR specs <> '{}'::jsonb;

ALTER TABLE assets
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
  DROP COLUMN notes,
  DROP COLUMN specs,
  DROP COLUMN version;

-- Existing policy edits retain their actor in audit_log.
ALTER TABLE ticket_policy DROP COLUMN version, DROP COLUMN updated_by;

-- Preserve all four combinations, including the intended audience of draft articles.
ALTER TABLE documents ADD COLUMN access_level text;
UPDATE documents SET access_level = (CASE WHEN published THEN 'published_' ELSE 'draft_' END) || visibility;
ALTER TABLE documents
  ALTER COLUMN access_level SET NOT NULL,
  ADD CONSTRAINT document_access_levels CHECK (access_level IN ('draft_public','draft_internal','published_public','published_internal')),
  DROP COLUMN published,
  DROP COLUMN visibility;
