import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This function should only be called once during setup
// It creates the demo users without requiring auth (for initial setup)
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Allow this to run without auth for initial setup
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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

    const results = { admin: null as any, student: null as any, errors: [] as string[] };

    // Create admin user
    const { data: adminData, error: adminError } = await supabaseAdmin.auth.admin.createUser({
      email: 'admin@sims.com',
      password: 'admin123',
      email_confirm: true,
      user_metadata: { full_name: 'System Administrator' },
    });

    if (adminError) {
      if (adminError.message.includes('already been registered')) {
        // User exists, get the user ID
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingAdmin = existingUsers?.users?.find(u => u.email === 'admin@sims.com');
        if (existingAdmin) {
          // Make sure they have admin role
          await supabaseAdmin.from('user_roles').upsert({
            user_id: existingAdmin.id,
            role: 'admin',
          }, { onConflict: 'user_id' });
          results.admin = { id: existingAdmin.id, email: existingAdmin.email, status: 'already exists, role assigned' };
        }
      } else {
        results.errors.push(`Admin error: ${adminError.message}`);
      }
    } else if (adminData.user) {
      // Assign admin role
      await supabaseAdmin.from('user_roles').insert({
        user_id: adminData.user.id,
        role: 'admin',
      });
      results.admin = { id: adminData.user.id, email: adminData.user.email, status: 'created' };
    }

    // Create student user
    const { data: studentData, error: studentError } = await supabaseAdmin.auth.admin.createUser({
      email: 'student@sims.com',
      password: 'student123',
      email_confirm: true,
      user_metadata: { full_name: 'Demo Student' },
    });

    if (studentError) {
      if (studentError.message.includes('already been registered')) {
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingStudent = existingUsers?.users?.find(u => u.email === 'student@sims.com');
        if (existingStudent) {
          // Make sure they have student role
          await supabaseAdmin.from('user_roles').upsert({
            user_id: existingStudent.id,
            role: 'student',
          }, { onConflict: 'user_id' });
          
          // Create student record if not exists
          const { data: existingStudentRecord } = await supabaseAdmin
            .from('students')
            .select('id')
            .eq('user_id', existingStudent.id)
            .maybeSingle();
          
          if (!existingStudentRecord) {
            const { data: depts } = await supabaseAdmin.from('departments').select('id').limit(1);
            await supabaseAdmin.from('students').insert({
              user_id: existingStudent.id,
              student_id: 'STU-DEMO-001',
              name: 'Demo Student',
              email: 'student@sims.com',
              department_id: depts?.[0]?.id || null,
              semester: 3,
              status: 'active',
            });
          }
          
          results.student = { id: existingStudent.id, email: existingStudent.email, status: 'already exists, role assigned' };
        }
      } else {
        results.errors.push(`Student error: ${studentError.message}`);
      }
    } else if (studentData.user) {
      // Assign student role
      await supabaseAdmin.from('user_roles').insert({
        user_id: studentData.user.id,
        role: 'student',
      });

      // Create student record
      const { data: depts } = await supabaseAdmin.from('departments').select('id').limit(1);
      await supabaseAdmin.from('students').insert({
        user_id: studentData.user.id,
        student_id: 'STU-DEMO-001',
        name: 'Demo Student',
        email: 'student@sims.com',
        department_id: depts?.[0]?.id || null,
        semester: 3,
        status: 'active',
      });

      results.student = { id: studentData.user.id, email: studentData.user.email, status: 'created' };
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
