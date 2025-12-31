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
  fullName: 'System Administrator',
  role: 'admin',
};

const DEMO_STUDENTS: DemoStudent[] = [
  {
    email: 'student@sims.com',
    password: 'student123',
    fullName: 'Demo Student 1',
    role: 'student',
    studentCode: 'STU-DEMO-001',
    semester: 3,
  },
  {
    email: 'student2@sims.com',
    password: 'student123',
    fullName: 'Demo Student 2',
    role: 'student',
    studentCode: 'STU-DEMO-002',
    semester: 2,
  },
  {
    email: 'student3@sims.com',
    password: 'student123',
    fullName: 'Demo Student 3',
    role: 'student',
    studentCode: 'STU-DEMO-003',
    semester: 4,
  },
];

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

    const results: Record<string, unknown> = {
      admin: null,
      students: [],
      errors: [],
    };

    const getUserIdByEmail = async (email: string) => {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      if (error) throw error;
      const existing = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      return existing?.id ?? null;
    };

    const upsertRole = async (userId: string, role: AppRole) => {
      const { error } = await supabaseAdmin
        .from('user_roles')
        .upsert({ user_id: userId, role }, { onConflict: 'user_id' });
      if (error) throw error;
    };

    const createOrUpdateAuthUser = async (u: DemoUser) => {
      // Try create first
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { full_name: u.fullName },
      });

      if (createError) {
        if (!isAlreadyRegisteredError(createError.message)) throw createError;

        const existingId = await getUserIdByEmail(u.email);
        if (!existingId) throw new Error(`User exists but could not be found: ${u.email}`);

        // Force reset password to known demo password (idempotent)
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingId, {
          password: u.password,
          email_confirm: true,
          user_metadata: { full_name: u.fullName },
        });
        if (updateError) throw updateError;

        await upsertRole(existingId, u.role);
        return { id: existingId, status: 'updated', email: u.email, role: u.role };
      }

      const userId = created.user?.id;
      if (!userId) throw new Error('User creation returned no user id');

      await upsertRole(userId, u.role);
      return { id: userId, status: 'created', email: u.email, role: u.role };
    };

    const getDefaultDepartmentId = async () => {
      const { data, error } = await supabaseAdmin
        .from('departments')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(1);
      if (error) throw error;
      return data?.[0]?.id ?? null;
    };

    const getDemoCourseIds = async () => {
      const { data, error } = await supabaseAdmin
        .from('courses')
        .select('id')
        .order('created_at', { ascending: true })
        .limit(3);
      if (error) throw error;
      return (data ?? []).map((c) => c.id);
    };

    const ensureStudentRecord = async (studentUserId: string, meta: DemoStudent, departmentId: string | null) => {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('user_id', studentUserId)
        .maybeSingle();
      if (existingError) throw existingError;

      const payload = {
        user_id: studentUserId,
        student_id: meta.studentCode,
        name: meta.fullName,
        email: meta.email,
        phone: null,
        gender: null,
        department_id: departmentId,
        semester: meta.semester,
        status: 'active',
      };

      if (existing?.id) {
        const { error: updateError } = await supabaseAdmin.from('students').update(payload).eq('id', existing.id);
        if (updateError) throw updateError;
        return existing.id as string;
      }

      const { error: insertError } = await supabaseAdmin.from('students').insert(payload);
      if (insertError) throw insertError;

      const { data: created, error: createdError } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('user_id', studentUserId)
        .maybeSingle();
      if (createdError) throw createdError;
      if (!created?.id) throw new Error('Student record could not be fetched after insert');
      return created.id as string;
    };

    const ensureEnrollment = async (studentId: string, courseId: string) => {
      const { data, error } = await supabaseAdmin
        .from('enrollments')
        .select('id')
        .eq('student_id', studentId)
        .eq('course_id', courseId)
        .maybeSingle();
      if (error) throw error;

      if (!data?.id) {
        const { error: insertError } = await supabaseAdmin.from('enrollments').insert({
          student_id: studentId,
          course_id: courseId,
          status: 'enrolled',
        });
        if (insertError) throw insertError;
      }
    };

    const ensureAttendance = async (studentId: string, courseId: string, date: string, status: string, remarks: string | null) => {
      const { data, error } = await supabaseAdmin
        .from('attendance')
        .select('id')
        .eq('student_id', studentId)
        .eq('course_id', courseId)
        .eq('date', date)
        .maybeSingle();
      if (error) throw error;

      if (!data?.id) {
        const { error: insertError } = await supabaseAdmin.from('attendance').insert({
          student_id: studentId,
          course_id: courseId,
          date,
          status,
          remarks,
        });
        if (insertError) throw insertError;
      }
    };

    const ensureResult = async (studentId: string, courseId: string, exam_type: string, marks_obtained: number, total_marks: number, grade: string, remarks: string | null) => {
      const { data, error } = await supabaseAdmin
        .from('results')
        .select('id')
        .eq('student_id', studentId)
        .eq('course_id', courseId)
        .eq('exam_type', exam_type)
        .maybeSingle();
      if (error) throw error;

      if (!data?.id) {
        const { error: insertError } = await supabaseAdmin.from('results').insert({
          student_id: studentId,
          course_id: courseId,
          exam_type,
          marks_obtained,
          total_marks,
          grade,
          remarks,
        });
        if (insertError) throw insertError;
      }
    };

    // 1) Ensure auth users + roles
    results.admin = await createOrUpdateAuthUser(DEMO_ADMIN);

    const departmentId = await getDefaultDepartmentId();
    const courseIds = await getDemoCourseIds();

    const studentsOut: any[] = [];
    for (const s of DEMO_STUDENTS) {
      const authUser = await createOrUpdateAuthUser(s);
      const studentRowId = await ensureStudentRecord(authUser.id, s, departmentId);

      // 2) Ensure demo enrollments/attendance/results (minimal, idempotent)
      for (const courseId of courseIds) {
        await ensureEnrollment(studentRowId, courseId);
      }

      if (courseIds[0]) {
        await ensureAttendance(studentRowId, courseIds[0], '2024-12-01', 'present', null);
        await ensureAttendance(studentRowId, courseIds[0], '2024-12-02', 'late', 'Arrived 10 min late');
        await ensureAttendance(studentRowId, courseIds[0], '2024-12-03', 'absent', 'Medical leave');

        await ensureResult(studentRowId, courseIds[0], 'Midterm', 42, 50, 'A', 'Excellent performance');
        await ensureResult(studentRowId, courseIds[0], 'Quiz', 18, 20, 'A+', null);
      }

      studentsOut.push({ ...authUser, student_row_id: studentRowId });
    }

    results.students = studentsOut;

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
