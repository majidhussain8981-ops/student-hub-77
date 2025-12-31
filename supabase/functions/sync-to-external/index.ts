import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL');
    const externalKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_KEY');

    console.log('[sync-to-external] External URL configured:', !!externalUrl);
    console.log('[sync-to-external] External Key configured:', !!externalKey);

    if (!externalUrl || !externalKey) {
      console.error('[sync-to-external] Missing external Supabase credentials');
      return new Response(
        JSON.stringify({ error: 'External Supabase credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { operation, table, data, id } = await req.json();
    console.log(`[sync-to-external] ${operation} on ${table}`, JSON.stringify({ id, dataId: data?.id }));

    // Create external Supabase client
    const externalSupabase = createClient(externalUrl, externalKey);

    let result;

    switch (operation) {
      case 'INSERT':
      case 'UPDATE':
        console.log(`[sync-to-external] Upserting to ${table}...`);
        const { data: upsertData, error: upsertError } = await externalSupabase
          .from(table)
          .upsert(data, { onConflict: 'id' });
        
        if (upsertError) {
          console.error(`[sync-to-external] Upsert error:`, JSON.stringify(upsertError));
          throw upsertError;
        }
        result = upsertData;
        console.log(`[sync-to-external] ${operation} success on ${table}`);
        break;

      case 'DELETE':
        console.log(`[sync-to-external] Deleting from ${table} where id=${id}...`);
        const { error: deleteError } = await externalSupabase
          .from(table)
          .delete()
          .eq('id', id);
        
        if (deleteError) {
          console.error(`[sync-to-external] Delete error:`, JSON.stringify(deleteError));
          throw deleteError;
        }
        console.log(`[sync-to-external] DELETE success on ${table}, id: ${id}`);
        break;

      case 'SYNC_ALL':
        console.log(`[sync-to-external] Starting SYNC_ALL for ${table}...`);
        const lovableUrl = Deno.env.get('SUPABASE_URL');
        const lovableKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        
        if (!lovableUrl || !lovableKey) {
          throw new Error('Lovable Cloud credentials not available');
        }

        const lovableSupabase = createClient(lovableUrl, lovableKey);
        
        // Define column mappings for each table (only columns that exist in external DB)
        const tableColumns: Record<string, string> = {
          students: 'id, student_id, name, email, phone, gender, department_id, semester, status, created_at, updated_at, enrollment_date',
          courses: 'id, code, name, description, credits, department_id, instructor_id, semester, created_at, updated_at',
          departments: 'id, code, name, description, head_name, created_at, updated_at',
          instructors: 'id, name, email, phone, department_id, qualification, specialization, created_at, updated_at',
          enrollments: 'id, student_id, course_id, enrollment_date, status, created_at',
          attendance: 'id, student_id, course_id, date, status, remarks, created_at',
          results: 'id, student_id, course_id, exam_type, marks_obtained, total_marks, grade, remarks, created_at, updated_at',
        };
        
        const columns = tableColumns[table] || '*';
        console.log(`[sync-to-external] Selecting columns: ${columns}`);
        
        const { data: allData, error: fetchError } = await lovableSupabase
          .from(table)
          .select(columns);
        
        if (fetchError) {
          console.error(`[sync-to-external] Fetch error:`, JSON.stringify(fetchError));
          throw fetchError;
        }

        console.log(`[sync-to-external] Fetched ${allData?.length || 0} records from ${table}`);

        if (allData && allData.length > 0) {
          // Upsert in batches of 100
          const batchSize = 100;
          for (let i = 0; i < allData.length; i += batchSize) {
            const batch = allData.slice(i, i + batchSize);
            const { error: syncError } = await externalSupabase
              .from(table)
              .upsert(batch, { onConflict: 'id' });
            
            if (syncError) {
              console.error(`[sync-to-external] Batch sync error:`, JSON.stringify(syncError));
              throw syncError;
            }
            console.log(`[sync-to-external] Synced batch ${i / batchSize + 1} of ${Math.ceil(allData.length / batchSize)}`);
          }
          console.log(`[sync-to-external] SYNC_ALL success on ${table}, ${allData.length} records`);
        }
        result = { synced: allData?.length || 0, table };
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error ? error.stack : JSON.stringify(error);
    console.error('[sync-to-external] Error:', errorMessage, errorDetails);
    return new Response(
      JSON.stringify({ error: errorMessage, details: errorDetails }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
