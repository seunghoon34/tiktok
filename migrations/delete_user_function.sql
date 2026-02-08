-- Function to delete a user and all their data
-- This runs with elevated privileges to delete from auth.users
CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Get the current user's ID from auth context
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete from User table (this will cascade to related tables via foreign keys)
  DELETE FROM public."User"
  WHERE id = current_user_id;

  -- Delete from auth.users (requires SECURITY DEFINER to bypass RLS)
  DELETE FROM auth.users
  WHERE id = current_user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_user() TO authenticated;
