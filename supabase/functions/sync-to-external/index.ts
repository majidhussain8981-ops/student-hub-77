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

    if (!externalUrl || !externalKey) {
      console.error('[sync-to-external] Missing external Supabase credentials');
      return new Response(
        JSON.stringify({ error: 'External Supabase credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { operation, table, data, id } = await req.json();
    console.log(`[sync-to-external] ${operation} on ${table}`, { id, data });

    // Create external Supabase client
    const externalSupabase = createClient(externalUrl, externalKey);

    let result;

    switch (operation) {
      case 'INSERT':
        const { data: insertData, error: insertError } = await externalSupabase
          .from(table)
          .upsert(data, { onConflict: 'id' });
        
        if (insertError) throw insertError;
        result = insertData;
        console.log(`[sync-to-external] INSERT success on ${table}`);
        break;

      case 'UPDATE':
        const { data: updateData, error: updateError } = await externalSupabase
          .from(table)
          .upsert(data, { onConflict: 'id' });
        
        if (updateError) throw updateError;
        result = updateData;
        console.log(`[sync-to-external] UPDATE success on ${table}`);
        break;

      case 'DELETE':
        const { error: deleteError } = await externalSupabase
          .from(table)
          .delete()
          .eq('id', id);
        
        if (deleteError) throw deleteError;
        console.log(`[sync-to-external] DELETE success on ${table}, id: ${id}`);
        break;

      case 'SYNC_ALL':
        // Sync all data from a table
        const lovableUrl = Deno.env.get('SUPABASE_URL');
        const lovableKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        
        if (!lovableUrl || !lovableKey) {
          throw new Error('Lovable Cloud credentials not available');
        }

        const lovableSupabase = createClient(lovableUrl, lovableKey);
        
        const { data: allData, error: fetchError } = await lovableSupabase
          .from(table)
          .select('*');
        
        if (fetchError) throw fetchError;

        if (allData && allData.length > 0) {
          const { error: syncError } = await externalSupabase
            .from(table)
            .upsert(allData, { onConflict: 'id' });
          
          if (syncError) throw syncError;
          console.log(`[sync-to-external] SYNC_ALL success on ${table}, ${allData.length} records`);
        }
        result = { synced: allData?.length || 0 };
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
    console.error('[sync-to-external] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
