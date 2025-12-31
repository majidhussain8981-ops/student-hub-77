import { supabase } from "@/integrations/supabase/client";

type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE' | 'SYNC_ALL';

interface SyncPayload {
  operation: SyncOperation;
  table: string;
  data?: Record<string, unknown>;
  id?: string;
}

export const syncToExternal = async (payload: SyncPayload): Promise<boolean> => {
  try {
    console.log(`[syncToExternal] Syncing ${payload.operation} on ${payload.table}`);
    
    const { data, error } = await supabase.functions.invoke('sync-to-external', {
      body: payload,
    });

    if (error) {
      console.error('[syncToExternal] Error:', error);
      return false;
    }

    console.log('[syncToExternal] Success:', data);
    return true;
  } catch (error) {
    console.error('[syncToExternal] Exception:', error);
    return false;
  }
};

// Convenience functions for common operations
export const syncInsert = (table: string, data: Record<string, unknown>) =>
  syncToExternal({ operation: 'INSERT', table, data });

export const syncUpdate = (table: string, data: Record<string, unknown>) =>
  syncToExternal({ operation: 'UPDATE', table, data });

export const syncDelete = (table: string, id: string) =>
  syncToExternal({ operation: 'DELETE', table, id });

export const syncAllRecords = (table: string) =>
  syncToExternal({ operation: 'SYNC_ALL', table });
