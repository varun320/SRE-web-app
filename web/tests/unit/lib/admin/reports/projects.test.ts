import { describe, it, expect } from 'vitest';
import { aggregateByProject, type ProjectHoursRow } from '@/lib/admin/reports/projects';

function row(p: Partial<ProjectHoursRow> & Pick<ProjectHoursRow, 'project_id' | 'user_id' | 'hrs'>): ProjectHoursRow {
  return {
    project_id: p.project_id,
    project_number: p.project_number ?? 2026100,
    project_name: p.project_name ?? 'Project A',
    user_id: p.user_id,
    employee_code: p.employee_code ?? 'E001',
    full_name: p.full_name ?? 'Alice',
    hrs: p.hrs,
  };
}

describe('aggregateByProject', () => {
  it('groups by project and sums total hours', () => {
    const rows = [
      row({ project_id: 'p1', project_number: 2026100, project_name: 'Alpha', user_id: 'u1', hrs: 8 }),
      row({ project_id: 'p1', project_number: 2026100, project_name: 'Alpha', user_id: 'u1', hrs: 4 }),
    ];
    const out = aggregateByProject(rows);
    expect(out).toHaveLength(1);
    expect(out[0].project_id).toBe('p1');
    expect(out[0].total_hrs).toBe(12);
    expect(out[0].by_employee).toHaveLength(1);
    expect(out[0].by_employee[0].hrs).toBe(12);
  });

  it('breaks down per employee inside a project', () => {
    const rows = [
      row({ project_id: 'p1', user_id: 'u1', employee_code: 'E001', full_name: 'Alice', hrs: 8 }),
      row({ project_id: 'p1', user_id: 'u2', employee_code: 'E002', full_name: 'Bob',   hrs: 4 }),
      row({ project_id: 'p1', user_id: 'u1', employee_code: 'E001', full_name: 'Alice', hrs: 2 }),
    ];
    const out = aggregateByProject(rows);
    expect(out[0].total_hrs).toBe(14);
    const alice = out[0].by_employee.find((e) => e.employee_code === 'E001')!;
    const bob = out[0].by_employee.find((e) => e.employee_code === 'E002')!;
    expect(alice.hrs).toBe(10);
    expect(bob.hrs).toBe(4);
  });

  it('sorts projects by total_hrs descending', () => {
    const rows = [
      row({ project_id: 'p1', project_number: 2026100, project_name: 'Alpha', user_id: 'u1', hrs: 5 }),
      row({ project_id: 'p2', project_number: 2026200, project_name: 'Beta',  user_id: 'u1', hrs: 20 }),
      row({ project_id: 'p3', project_number: 2026300, project_name: 'Gamma', user_id: 'u1', hrs: 10 }),
    ];
    const out = aggregateByProject(rows);
    expect(out.map((p) => p.project_number)).toEqual([2026200, 2026300, 2026100]);
  });

  it('sorts employees within a project by hrs descending', () => {
    const rows = [
      row({ project_id: 'p1', user_id: 'u1', employee_code: 'E001', hrs: 3 }),
      row({ project_id: 'p1', user_id: 'u2', employee_code: 'E002', hrs: 10 }),
      row({ project_id: 'p1', user_id: 'u3', employee_code: 'E003', hrs: 5 }),
    ];
    const out = aggregateByProject(rows);
    expect(out[0].by_employee.map((e) => e.employee_code)).toEqual(['E002', 'E003', 'E001']);
  });

  it('returns an empty array for empty input', () => {
    expect(aggregateByProject([])).toEqual([]);
  });
});
