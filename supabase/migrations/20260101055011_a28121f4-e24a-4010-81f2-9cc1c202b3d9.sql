-- Create function to auto-create student record on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_student_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_student_id TEXT;
BEGIN
  -- Generate a unique student ID (STU + timestamp + random)
  new_student_id := 'STU' || to_char(NOW(), 'YYMM') || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  
  -- Create student record linked to the new user
  INSERT INTO public.students (
    user_id,
    name,
    email,
    student_id,
    status,
    semester
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    new_student_id,
    'active',
    1
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-create student on signup
DROP TRIGGER IF EXISTS on_auth_user_created_student ON auth.users;
CREATE TRIGGER on_auth_user_created_student
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_student_signup();