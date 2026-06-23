'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseBrowser } from './supabase/client';
import { fetchSubCategories, fetchProjects, fetchTimesheet, replaceEntries, submitTimesheet } from './queries';
import type { TimesheetEntryDraft } from './types';

export function useSubCategories() {
  const sb = getSupabaseBrowser();
  return useQuery({ queryKey: ['sub_categories'], queryFn: () => fetchSubCategories(sb), staleTime: 5 * 60_000 });
}

export function useProjects() {
  const sb = getSupabaseBrowser();
  return useQuery({ queryKey: ['projects'], queryFn: () => fetchProjects(sb), staleTime: 60_000 });
}

export function useTimesheet(id: string | null) {
  const sb = getSupabaseBrowser();
  return useQuery({
    queryKey: ['timesheet', id],
    queryFn: () => fetchTimesheet(sb, id as string),
    enabled: !!id,
  });
}

export function useSaveEntries(timesheetId: string) {
  const sb = getSupabaseBrowser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entries: Omit<TimesheetEntryDraft,'id'>[]) => replaceEntries(sb, timesheetId, entries),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timesheet', timesheetId] }),
  });
}

export function useSubmit(timesheetId: string) {
  const sb = getSupabaseBrowser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => submitTimesheet(sb, timesheetId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timesheet', timesheetId] }),
  });
}
