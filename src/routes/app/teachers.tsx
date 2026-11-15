import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Search, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/app/page-header';
import { RoleGuard } from '@/components/app/role-guard';
import { EmptyState, ErrorState, LoadingState } from '@/components/app/states';
import { StatusPill } from '@/components/app/status-pill';
import { useAuth } from '@/lib/auth';
import { getAcademicCatalogFn, listTeachersFn } from '@/lib/academic.functions';
import { INSTITUTION_ROLE_LABELS } from '@/lib/roles';

export const Route = createFileRoute('/app/teachers')({
  head: () => ({
    meta: [
      { title: 'Teachers — ExamFlow' },
      { name: 'description', content: 'Search, filter, and browse institution teachers.' },
    ],
  }),
  component: TeachersPage,
});

const ALL = '__all__';

function TeachersPage() {
  const { user, activeInstitutionId, activeMembership, authHeaders, workspace } = useAuth();
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState(ALL);
  const [status, setStatus] = useState<'all' | 'active' | 'suspended'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const isAdmin =
    workspace?.isSuperAdmin || activeMembership?.role === 'institution_admin';

  const catalogQuery = useQuery({
    queryKey: ['academic-catalog', activeInstitutionId, user?.id],
    enabled: Boolean(user && activeInstitutionId),
    queryFn: async () => {
      if (!activeInstitutionId) throw new Error('No active institution');
      return getAcademicCatalogFn({
        data: { institutionId: activeInstitutionId },
        headers: authHeaders(),
      });
    },
  });

  const teachersQuery = useQuery({
    queryKey: [
      'teachers-directory',
      activeInstitutionId,
      user?.id,
      search,
      departmentId,
      status,
      page,
    ],
    enabled: Boolean(user && activeInstitutionId),
    queryFn: async () => {
      if (!activeInstitutionId) throw new Error('No active institution');
      return listTeachersFn({
        data: {
          institutionId: activeInstitutionId,
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(departmentId !== ALL ? { departmentId } : {}),
          ...(status !== 'all' ? { status } : {}),
          page,
          pageSize,
        },
        headers: authHeaders(),
      });
    },
  });

  const res = teachersQuery.data;
  const departments = catalogQuery.data?.departments ?? [];

  return (
    <RoleGuard allowedRoles={['institution', 'teacher']}>
      <PageHeader
        title="Teachers directory"
        description={
          activeMembership
            ? `Verified teaching faculty and coordinators in ${activeMembership.institution.name}.`
            : 'Institution teaching staff.'
        }
        actions={
          isAdmin ? (
            <Button asChild variant="outline">
              <Link to="/app/members">
                <UserPlus className="h-4 w-4" />
                Invite teacher
              </Link>
            </Button>
          ) : undefined
        }
      />

      <Card className="shadow-none">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">
            Faculty ({res?.total ?? 0})
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search name, email, course…"
                className="h-9 w-56 pl-8"
              />
            </div>

            <Select
              value={departmentId}
              onValueChange={(v) => {
                setDepartmentId(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-[170px]">
                <SelectValue placeholder="All departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v as 'all' | 'active' | 'suspended');
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {teachersQuery.isLoading ? (
            <LoadingState label="Loading teachers…" />
          ) : teachersQuery.error ? (
            <ErrorState
              title="Could not load teachers"
              description={
                teachersQuery.error instanceof Error
                  ? teachersQuery.error.message
                  : 'Unknown error'
              }
              onRetry={() => {
                void teachersQuery.refetch();
              }}
            />
          ) : !res || res.items.length === 0 ? (
            <EmptyState
              title="No matching teachers"
              description="Adjust filters or invite teachers from Members & Invites."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Assigned courses</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {res.items.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <p className="font-medium">
                            {t.profile?.full_name || t.profile?.email || t.user_id}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t.profile?.email ?? '—'}
                          </p>
                        </TableCell>
                        <TableCell>
                          <StatusPill tone="info">
                            {INSTITUTION_ROLE_LABELS[t.role]}
                          </StatusPill>
                        </TableCell>
                        <TableCell>
                          {t.courses.length === 0 ? (
                            <span className="text-xs text-muted-foreground">Unassigned</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {t.courses.slice(0, 4).map((c) => (
                                <StatusPill key={`${t.id}-${c.id}-${c.sessionId}`} tone="neutral">
                                  {c.code}
                                </StatusPill>
                              ))}
                              {t.courses.length > 4 && (
                                <span className="text-xs text-muted-foreground">
                                  +{t.courses.length - 4} more
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusPill tone={t.status === 'active' ? 'success' : 'warning'}>
                            {t.status}
                          </StatusPill>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between border-t pt-3 text-sm text-muted-foreground">
                <span>
                  Page {res.page} of {res.totalPages} ({res.total} total)
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={res.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={res.page >= res.totalPages}
                    onClick={() => setPage((p) => Math.min(res.totalPages, p + 1))}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </RoleGuard>
  );
}
