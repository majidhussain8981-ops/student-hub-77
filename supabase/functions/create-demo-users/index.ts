import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type AppRole = 'admin' | 'student';

type DemoUser = {
  email: string;
  password: string;
  fullName: string;
  role: AppRole;
};

type DemoStudent = DemoUser & {
  studentCode: string;
  semester: number;
};

const DEMO_ADMIN: DemoUser = {
  email: 'admin@sims.com',
  password: 'admin123',
  fullName: 'Dr. Abdul Rasheed',
  role: 'admin',
};

const DEMO_STUDENT: DemoStudent = {
  email: 'student@sims.com',
  password: 'student123',
  fullName: 'Usman Farooq',
  role: 'student',
  studentCode: 'STU-2024-001',
  semester: 3,
};

function isAlreadyRegisteredError(message: string) {
  return message.toLowerCase().includes('already been registered');
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log('[create-demo-users] Starting demo user setup...');

    const results: Record<string, unknown> = {
      admin: null,
      student: null,
    };

    const getUserIdByEmail = async (email: string) => {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      if (error) {
        console.error('[create-demo-users] Error listing users:', error.message);
        throw error;
      }
      const existing = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      return existing?.id ?? null;
    };

    const upsertRole = async (userId: string, role: AppRole) => {
      // First check if role exists
      const { data: existingRole } = await supabaseAdmin
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingRole?.id) {
        const { error } = await supabaseAdmin
          .from('user_roles')
          .update({ role })
          .eq('user_id', userId);
        if (error) {
          console.error('[create-demo-users] Error updating role:', error.message);
          throw error;
        }
      } else {
        const { error } = await supabaseAdmin
          .from('user_roles')
          .insert({ user_id: userId, role });
        if (error) {
          console.error('[create-demo-users] Error inserting role:', error.message);
          throw error;
        }
      }
    };

    const createOrUpdateAuthUser = async (u: DemoUser) => {
      console.log(`[create-demo-users] Processing user: ${u.email}`);
      
      // Check if user exists first
      const existingId = await getUserIdByEmail(u.email);
      
      if (existingId) {
        console.log(`[create-demo-users] User exists, updating: ${u.email}`);
        // Update existing user
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingId, {
          password: u.password,
          email_confirm: true,
          user_metadata: { full_name: u.fullName },
        });
        if (updateError) {
          console.error('[create-demo-users] Error updating user:', updateError.message);
          throw updateError;
        }

        await upsertRole(existingId, u.role);
        return { id: existingId, status: 'updated', email: u.email, role: u.role };
      }

      // Create new user
      console.log(`[create-demo-users] Creating new user: ${u.email}`);
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { full_name: u.fullName },
      });

      if (createError) {
        console.error('[create-demo-users] Error creating user:', createError.message);
        throw createError;
      }

      const userId = created.user?.id;
      if (!userId) throw new Error('User creation returned no user id');

      await upsertRole(userId, u.role);
      return { id: userId, status: 'created', email: u.email, role: u.role };
    };

    const getOrCreateDepartment = async () => {
      const { data, error } = await supabaseAdmin
        .from('departments')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(1);
      
      if (error) {
        console.error('[create-demo-users] Error fetching department:', error.message);
        throw error;
      }
      
      if (data && data.length > 0) {
        return data[0].id;
      }

      // Create a default department if none exists
      console.log('[create-demo-users] Creating default department...');
      const { data: newDept, error: insertError } = await supabaseAdmin
        .from('departments')
        .insert({
          code: 'CS',
          name: 'Computer Science',
          description: 'Department of Computer Science and Engineering',
          head_name: 'Dr. Khalid Mahmood',
        })
        .select('id')
        .single();
      
      if (insertError) {
        console.error('[create-demo-users] Error creating department:', insertError.message);
        throw insertError;
      }
      
      return newDept.id;
    };

    const getOrCreateCourses = async (departmentId: string) => {
      const { data, error } = await supabaseAdmin
        .from('courses')
        .select('id')
        .limit(3);
      
      if (error) {
        console.error('[create-demo-users] Error fetching courses:', error.message);
        throw error;
      }
      
      if (data && data.length > 0) {
        return data.map((c) => c.id);
      }

      // Create default courses if none exist
      console.log('[create-demo-users] Creating default courses...');
      const coursesToCreate = [
        { code: 'CS101', name: 'Introduction to Programming', credits: 3, department_id: departmentId, description: 'Learn the basics of programming with Python' },
        { code: 'CS201', name: 'Data Structures', credits: 4, department_id: departmentId, description: 'Arrays, linked lists, trees, graphs, and algorithms' },
        { code: 'CS301', name: 'Database Systems', credits: 3, department_id: departmentId, description: 'SQL, normalization, and database design' },
      ];

      const { data: newCourses, error: insertError } = await supabaseAdmin
        .from('courses')
        .insert(coursesToCreate)
        .select('id');
      
      if (insertError) {
        console.error('[create-demo-users] Error creating courses:', insertError.message);
        throw insertError;
      }
      
      return newCourses.map((c) => c.id);
    };

    const ensureStudentRecord = async (studentUserId: string, meta: DemoStudent, departmentId: string) => {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('user_id', studentUserId)
        .maybeSingle();
      
      if (existingError) {
        console.error('[create-demo-users] Error checking student:', existingError.message);
        throw existingError;
      }

      const payload = {
        user_id: studentUserId,
        student_id: meta.studentCode,
        name: meta.fullName,
        email: meta.email,
        department_id: departmentId,
        semester: meta.semester,
        status: 'active',
        gender: 'Male',
        phone: '+92-300-1234567',
      };

      if (existing?.id) {
        console.log('[create-demo-users] Updating existing student record...');
        const { error: updateError } = await supabaseAdmin.from('students').update(payload).eq('id', existing.id);
        if (updateError) {
          console.error('[create-demo-users] Error updating student:', updateError.message);
          throw updateError;
        }
        return existing.id as string;
      }

      console.log('[create-demo-users] Creating new student record...');
      const { data: created, error: insertError } = await supabaseAdmin
        .from('students')
        .insert(payload)
        .select('id')
        .single();
      
      if (insertError) {
        console.error('[create-demo-users] Error inserting student:', insertError.message);
        throw insertError;
      }
      
      return created.id as string;
    };

    const ensureEnrollment = async (studentId: string, courseId: string) => {
      const { data } = await supabaseAdmin
        .from('enrollments')
        .select('id')
        .eq('student_id', studentId)
        .eq('course_id', courseId)
        .maybeSingle();

      if (!data?.id) {
        await supabaseAdmin.from('enrollments').insert({
          student_id: studentId,
          course_id: courseId,
          status: 'enrolled',
        });
      }
    };

    const ensureAttendance = async (studentId: string, courseId: string, date: string, status: string, remarks: string | null) => {
      const { data } = await supabaseAdmin
        .from('attendance')
        .select('id')
        .eq('student_id', studentId)
        .eq('course_id', courseId)
        .eq('date', date)
        .maybeSingle();

      if (!data?.id) {
        await supabaseAdmin.from('attendance').insert({
          student_id: studentId,
          course_id: courseId,
          date,
          status,
          remarks,
        });
      }
    };

    const ensureResult = async (studentId: string, courseId: string, exam_type: string, marks_obtained: number, total_marks: number, grade: string, remarks: string | null) => {
      const { data } = await supabaseAdmin
        .from('results')
        .select('id')
        .eq('student_id', studentId)
        .eq('course_id', courseId)
        .eq('exam_type', exam_type)
        .maybeSingle();

      if (!data?.id) {
        await supabaseAdmin.from('results').insert({
          student_id: studentId,
          course_id: courseId,
          exam_type,
          marks_obtained,
          total_marks,
          grade,
          remarks,
        });
      }
    };

    // 1) Create admin user
    results.admin = await createOrUpdateAuthUser(DEMO_ADMIN);
    console.log('[create-demo-users] Admin user ready');

    // 2) Ensure department and courses exist
    const departmentId = await getOrCreateDepartment();
    const courseIds = await getOrCreateCourses(departmentId);
    console.log('[create-demo-users] Department and courses ready');

    // 3) Create student user
    const studentAuth = await createOrUpdateAuthUser(DEMO_STUDENT);
    const studentRowId = await ensureStudentRecord(studentAuth.id, DEMO_STUDENT, departmentId);
    console.log('[create-demo-users] Student user ready');

    // 4) Ensure demo enrollments
    for (const courseId of courseIds) {
      await ensureEnrollment(studentRowId, courseId);
    }
    console.log('[create-demo-users] Enrollments ready');

    // 5) Add sample attendance and results for all courses
    if (courseIds[0]) {
      // CS101 - Introduction to Programming
      await ensureAttendance(studentRowId, courseIds[0], '2025-01-06', 'present', null);
      await ensureAttendance(studentRowId, courseIds[0], '2025-01-07', 'present', null);
      await ensureAttendance(studentRowId, courseIds[0], '2025-01-08', 'late', 'Arrived 10 min late');
      await ensureAttendance(studentRowId, courseIds[0], '2025-01-09', 'present', null);
      await ensureAttendance(studentRowId, courseIds[0], '2025-01-10', 'absent', 'Medical leave');
      await ensureAttendance(studentRowId, courseIds[0], '2025-01-13', 'present', null);
      await ensureAttendance(studentRowId, courseIds[0], '2025-01-14', 'present', null);
      await ensureAttendance(studentRowId, courseIds[0], '2025-01-15', 'present', null);

      await ensureResult(studentRowId, courseIds[0], 'Quiz 1', 18, 20, 'A+', 'Perfect score');
      await ensureResult(studentRowId, courseIds[0], 'Quiz 2', 17, 20, 'A', null);
      await ensureResult(studentRowId, courseIds[0], 'Midterm', 42, 50, 'A', 'Excellent performance');
      await ensureResult(studentRowId, courseIds[0], 'Assignment 1', 28, 30, 'A', null);
      await ensureResult(studentRowId, courseIds[0], 'Final', 85, 100, 'A', 'Great work!');
    }

    if (courseIds[1]) {
      // CS201 - Data Structures
      await ensureAttendance(studentRowId, courseIds[1], '2025-01-06', 'present', null);
      await ensureAttendance(studentRowId, courseIds[1], '2025-01-07', 'present', null);
      await ensureAttendance(studentRowId, courseIds[1], '2025-01-08', 'present', null);
      await ensureAttendance(studentRowId, courseIds[1], '2025-01-09', 'absent', 'Family emergency');
      await ensureAttendance(studentRowId, courseIds[1], '2025-01-10', 'present', null);
      await ensureAttendance(studentRowId, courseIds[1], '2025-01-13', 'present', null);
      
      await ensureResult(studentRowId, courseIds[1], 'Quiz 1', 16, 20, 'A', null);
      await ensureResult(studentRowId, courseIds[1], 'Midterm', 38, 50, 'B+', 'Good effort');
      await ensureResult(studentRowId, courseIds[1], 'Assignment 1', 25, 30, 'B+', null);
    }

    if (courseIds[2]) {
      // CS301 - Database Systems
      await ensureAttendance(studentRowId, courseIds[2], '2025-01-06', 'present', null);
      await ensureAttendance(studentRowId, courseIds[2], '2025-01-07', 'late', 'Traffic delay');
      await ensureAttendance(studentRowId, courseIds[2], '2025-01-08', 'present', null);
      await ensureAttendance(studentRowId, courseIds[2], '2025-01-09', 'present', null);
      await ensureAttendance(studentRowId, courseIds[2], '2025-01-10', 'present', null);
      
      await ensureResult(studentRowId, courseIds[2], 'Quiz 1', 19, 20, 'A+', 'Excellent!');
      await ensureResult(studentRowId, courseIds[2], 'Midterm', 45, 50, 'A', 'Outstanding performance');
      await ensureResult(studentRowId, courseIds[2], 'Project', 90, 100, 'A+', 'Best project in class');
    }

    console.log('[create-demo-users] Attendance and results ready');

    results.student = { ...studentAuth, student_row_id: studentRowId };

    console.log('[create-demo-users] Setup complete!');

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[create-demo-users] error:', errorMessage);

    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
