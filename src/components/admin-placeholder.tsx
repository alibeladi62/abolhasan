import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function AdminPlaceholder({
  title,
  stage,
  columns,
  note,
}: {
  title: string;
  stage: string;
  columns: string[];
  note?: string;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold text-primary">{title}</h1>
        <Badge variant="secondary">ساخته‌شده در مرحله {stage}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">جدول مدیریتی</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column}>{column}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  {note ?? 'در این مرحله هیچ عملیاتی روی این جدول انجام نشده است.'}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
