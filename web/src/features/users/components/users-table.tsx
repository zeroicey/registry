import { format } from 'date-fns';
import { ExternalLinkIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { UserSummaryDto } from '../types';

function formatDateTime(iso: string): string {
  return format(new Date(iso), 'yyyy-MM-dd HH:mm');
}

interface UsersTableProps {
  users: UserSummaryDto[];
  onDetail: (user: UserSummaryDto) => void;
  onDelete: (user: UserSummaryDto) => void;
}

export function UsersTable({ users, onDetail, onDelete }: UsersTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>姓名</TableHead>
          <TableHead>身份证号</TableHead>
          <TableHead>更新时间</TableHead>
          <TableHead className="w-28 text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="font-medium">{user.realName}</TableCell>
            <TableCell className="text-muted-foreground">{user.code ?? '—'}</TableCell>
            <TableCell className="text-muted-foreground">
              {formatDateTime(user.updatedAt)}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`查看详情 ${user.realName}`}
                  onClick={() => onDetail(user)}
                >
                  <ExternalLinkIcon className="size-3.5" />
                  详情
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`删除 ${user.realName}`}
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(user)}
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
