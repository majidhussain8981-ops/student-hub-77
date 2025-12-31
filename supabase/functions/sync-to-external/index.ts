import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SyncOperation = "INSERT" | "UPDATE" | "DELETE" | "SYNC_ALL";

type SyncPayload = {
  operation: SyncOperation;
  table: string;
  data?: unknown;
  id?: string;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL");
    const externalKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY");

    console.log("[sync-to-external] External URL configured:", !!externalUrl);
    console.log("[sync-to-external] External Key configured:", !!externalKey);

    if (!externalUrl || !externalKey) {
      console.error("[sync-to-external] Missing external database credentials");
      return new Response(
        JSON.stringify({ error: "External database credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload = (await req.json()) as SyncPayload;
    const { operation, table, data, id } = payload;

    console.log(
      `[sync-to-external] ${operation} on ${table}`,
      JSON.stringify({ id, dataId: (data as any)?.id }),
    );

    const externalSupabase = createClient(externalUrl, externalKey);

    // Some external databases may not have the full schema. If PostgREST returns
    // PGRST204 (missing column), we auto-drop that column and retry.
    const removeColumnFromData = (raw: unknown, column: string): unknown => {
      const removeFromRow = (row: Record<string, unknown>) => {
        const copy: Record<string, unknown> = { ...row };
        delete copy[column];
        return copy;
      };

      if (Array.isArray(raw)) {
        return raw.map((item) =>
          item && typeof item === "object" && !Array.isArray(item)
            ? removeFromRow(item as Record<string, unknown>)
            : item
        );
      }

      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        return removeFromRow(raw as Record<string, unknown>);
      }

      return raw;
    };

    const upsertWithAutoDrop = async (tableName: string, rawData: unknown) => {
      let dataToSend: unknown = rawData;
      const droppedColumns: string[] = [];

      for (let attempt = 0; attempt < 10; attempt++) {
        const { data: upserted, error } = await externalSupabase
          .from(tableName)
          .upsert(dataToSend as any, { onConflict: "id" });

        if (!error) {
          return { upserted, droppedColumns };
        }

        const code = (error as any)?.code as string | undefined;
        const message = (error as any)?.message as string | undefined;

        if (code === "PGRST204" && message) {
          const match = message.match(/Could not find the '([^']+)' column/);
          const missingColumn = match?.[1];

          if (missingColumn && !droppedColumns.includes(missingColumn)) {
            droppedColumns.push(missingColumn);
            console.warn(
              `[sync-to-external] External missing column "${missingColumn}" on "${tableName}". Dropping and retrying.`,
            );
            dataToSend = removeColumnFromData(dataToSend, missingColumn);
            continue;
          }
        }

        console.error("[sync-to-external] Upsert error:", JSON.stringify(error));
        throw error;
      }

      throw new Error(
        `[sync-to-external] Upsert failed after dropping columns: ${droppedColumns.join(", ")}`,
      );
    };

    let result: unknown;

    switch (operation) {
      case "INSERT":
      case "UPDATE": {
        console.log(`[sync-to-external] Upserting to ${table}...`);
        const { upserted, droppedColumns } = await upsertWithAutoDrop(table, data);
        result = { upserted, droppedColumns };
        console.log(
          `[sync-to-external] ${operation} success on ${table}`,
          droppedColumns.length ? JSON.stringify({ droppedColumns }) : "",
        );
        break;
      }

      case "DELETE": {
        console.log(`[sync-to-external] Deleting from ${table} where id=${id}...`);
        const { error } = await externalSupabase.from(table).delete().eq("id", id);
        if (error) {
          console.error("[sync-to-external] Delete error:", JSON.stringify(error));
          throw error;
        }
        result = { deleted: true, id };
        console.log(`[sync-to-external] DELETE success on ${table}, id: ${id}`);
        break;
      }

      case "SYNC_ALL": {
        console.log(`[sync-to-external] Starting SYNC_ALL for ${table}...`);

        const lovableUrl = Deno.env.get("SUPABASE_URL");
        const lovableKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!lovableUrl || !lovableKey) {
          throw new Error("Primary backend credentials not available");
        }

        const lovableSupabase = createClient(lovableUrl, lovableKey);

        // Select only columns we *expect* the external DB to have.
        // (If some are still missing, upsertWithAutoDrop() will handle it.)
        const tableColumns: Record<string, string> = {
          students:
            "id, student_id, name, email, phone, gender, department_id, semester, status, created_at, updated_at, enrollment_date",
          courses:
            "id, code, name, description, credits, department_id, instructor_id, semester, created_at, updated_at",
          departments: "id, code, name, description, head_name, created_at, updated_at",
          instructors:
            "id, name, email, phone, department_id, qualification, specialization, created_at, updated_at",
          enrollments: "id, student_id, course_id, enrollment_date, status, created_at",
          attendance: "id, student_id, course_id, date, status, remarks, created_at",
          results:
            "id, student_id, course_id, exam_type, marks_obtained, total_marks, grade, remarks, created_at, updated_at",
        };

        const columns = tableColumns[table] || "*";
        console.log(`[sync-to-external] Selecting columns: ${columns}`);

        const { data: allData, error: fetchError } = await lovableSupabase
          .from(table)
          .select(columns);

        if (fetchError) {
          console.error("[sync-to-external] Fetch error:", JSON.stringify(fetchError));
          throw fetchError;
        }

        console.log(`[sync-to-external] Fetched ${allData?.length || 0} records from ${table}`);

        const droppedSet = new Set<string>();

        if (allData && allData.length > 0) {
          const batchSize = 100;
          for (let i = 0; i < allData.length; i += batchSize) {
            const batch = allData.slice(i, i + batchSize);
            const { droppedColumns } = await upsertWithAutoDrop(table, batch);
            droppedColumns.forEach((c) => droppedSet.add(c));

            console.log(
              `[sync-to-external] Synced batch ${i / batchSize + 1} of ${Math.ceil(allData.length / batchSize)}`,
            );
          }
        }

        result = {
          synced: allData?.length || 0,
          table,
          droppedColumns: Array.from(droppedSet),
        };

        console.log(`[sync-to-external] SYNC_ALL success on ${table}`);
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorDetails = error instanceof Error ? error.stack : JSON.stringify(error);
    console.error("[sync-to-external] Error:", errorMessage, errorDetails);
    return new Response(JSON.stringify({ error: errorMessage, details: errorDetails }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
