import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Schedule, Route, Bus } from '@/types';

const fetchCollectionData = async (table: string, companyId: string) => {
  if (!companyId) return [];
  const { data, error } = await supabase.from(table).select('*').eq('companyId', companyId);
  if (error) throw error;
  
  return (data || []).map(d => ({
    ...d,
    departureDateTime: d.departureDateTime ? new Date(d.departureDateTime) : undefined,
    arrivalDateTime:   d.arrivalDateTime   ? new Date(d.arrivalDateTime)   : undefined,
    createdAt: new Date(d.createdAt),
    updatedAt: new Date(d.updatedAt),
  }));
};

export function useCompanySchedules(companyId: string) {
  return useQuery({
    queryKey: ['schedules', companyId],
    queryFn: () => fetchCollectionData('Schedule', companyId),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCompanyTemplates(companyId: string) {
  return useQuery({
    queryKey: ['templates', companyId],
    queryFn: () => fetchCollectionData('ScheduleTemplate', companyId),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCompanyRoutes(companyId: string) {
  return useQuery({
    queryKey: ['routes', companyId],
    queryFn: () => fetchCollectionData('Route', companyId),
    enabled: !!companyId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useCompanyBuses(companyId: string) {
  return useQuery({
    queryKey: ['buses', companyId],
    queryFn: () => fetchCollectionData('Bus', companyId),
    enabled: !!companyId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useCompanyRegions(companyId: string) {
  return useQuery({
    queryKey: ['regions', companyId],
    queryFn: () => fetchCollectionData('Region', companyId),
    enabled: !!companyId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useCompanyReports(companyId: string) {
  return useQuery({
    queryKey: ['reports', companyId],
    queryFn: () => fetchCollectionData('DailyReport', companyId),
    enabled: !!companyId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCompanyOperators(companyId: string) {
  return useQuery({
    queryKey: ['operators', companyId],
    queryFn: async () => {
      const [operatorsRes, operatorTableRes] = await Promise.all([
        supabase.from('User').select('*').eq('companyId', companyId).in('role', ['operator', 'conductor']).order('createdAt', { ascending: false }),
        supabase.from('Operator').select('id, uid, regionId, status').eq('companyId', companyId),
      ]);
      
      const operatorTableRows = (operatorTableRes.data || []) as Array<{ id: string; uid?: string | null; regionId?: string | null; status?: string | null }>;
      
      // Build a lookup map: User.id -> Operator row, and User.uid -> Operator row
      const assignmentByUserId = new Map<string, { regionId?: string | null; status?: string | null }>();
      operatorTableRows.forEach((row) => {
        // The Operator table may store the User's id as either Operator.id or Operator.uid
        if (row.id) assignmentByUserId.set(row.id, row);
        if (row.uid && row.uid !== row.id) assignmentByUserId.set(row.uid, row);
      });

      return (operatorsRes.data || []).map((op: any) => {
        // Find the matching Operator row by looking up the user's id and uid
        const operatorRow = assignmentByUserId.get(op.id) || assignmentByUserId.get(op.uid);
        
        // regionId comes from the Operator table (the authoritative source)
        // fall back to checking if User.region is a UUID (legacy direct assignment)
        const resolvedRegionId = operatorRow?.regionId || null;
        
        return {
          ...op,
          regionId: resolvedRegionId,
          // Also expose the operator table status if different from user's isActive field
          operatorStatus: operatorRow?.status || (op.isActive === false ? 'inactive' : 'active'),
        };
      });
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });
}

