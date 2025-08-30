-- Migration to add media dimensions to TextOverlay table
-- This enables cross-device compatible text overlay positioning

ALTER TABLE "TextOverlay" 
ADD COLUMN "media_width" DOUBLE PRECISION,
ADD COLUMN "media_height" DOUBLE PRECISION,
ADD COLUMN "screen_width" DOUBLE PRECISION,
ADD COLUMN "screen_height" DOUBLE PRECISION;

-- Add comments to explain the new columns
COMMENT ON COLUMN "TextOverlay"."media_width" IS 'Width of the media container when overlay was created';
COMMENT ON COLUMN "TextOverlay"."media_height" IS 'Height of the media container when overlay was created';
COMMENT ON COLUMN "TextOverlay"."screen_width" IS 'Screen width when overlay was created';
COMMENT ON COLUMN "TextOverlay"."screen_height" IS 'Screen height when overlay was created';
