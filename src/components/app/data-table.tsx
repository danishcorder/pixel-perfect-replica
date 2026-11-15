import { useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, SampleBadge } from "./states";

export type Column<T> = { key: string; header: string; cell: (row: T) => ReactNode; className?: string };

export function DataTable<T>({ title, rows, columns, searchKeys, sample, actions, emptyTitle = "No records yet" }: {
  title: string; rows: T[]; columns: Column<T>[]; searchKeys?: (row: T) => string; sample?: boolean; actions?: ReactNode; emptyTitle?: string;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => (q && searchKeys ? rows.filter((r) => searchKeys(r).toLowerCase().includes(q.toLowerCase())) : rows), [q, rows, searchKeys]);
  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div className="flex items-center gap-2"><CardTitle className="text-base">{title}</CardTitle>{sample && <SampleBadge />}</div>
        <div className="flex items-center gap-2">
          {searchKeys && (
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-9 w-48 pl-8" aria-label={`Search ${title}`} />
            </div>
          )}
          {actions}
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <EmptyState title={q ? "No matches" : emptyTitle} description={q ? `Nothing matches “${q}”.` : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>{columns.map((c) => <TableHead key={c.key} className={c.className}>{c.header}</TableHead>)}</TableRow></TableHeader>
              <TableBody>
                {filtered.map((r, i) => <TableRow key={i}>{columns.map((c) => <TableCell key={c.key} className={c.className}>{c.cell(r)}</TableCell>)}</TableRow>)}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
