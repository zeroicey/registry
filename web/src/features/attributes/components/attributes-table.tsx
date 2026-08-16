import { PencilIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AttributeConfig, AttributeDef, AttributeType } from '@/types/attribute';

const TYPE_LABELS: Record<AttributeType, string> = {
  string: '文本',
  number: '数字',
  bool: '布尔',
  date: '日期',
  select: '下拉',
};

/** Compact human-readable summary of an attribute's config rules. */
export function configSummary(config: AttributeConfig): string {
  const parts: string[] = [];
  if (config.options !== undefined && config.options.length > 0) {
    parts.push(`${config.options.length} 个选项`);
  }
  if (config.min !== undefined && config.max !== undefined) {
    parts.push(`${config.min} ~ ${config.max}`);
  } else if (config.min !== undefined) {
    parts.push(`≥ ${config.min}`);
  } else if (config.max !== undefined) {
    parts.push(`≤ ${config.max}`);
  }
  if (config.regex) parts.push('正则校验');
  return parts.join(' · ') || '—';
}

interface AttributesTableProps {
  attributes: AttributeDef[];
  onEdit: (attribute: AttributeDef) => void;
  onDelete: (attribute: AttributeDef) => void;
}

export function AttributesTable({ attributes, onEdit, onDelete }: AttributesTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>名称</TableHead>
          <TableHead>key</TableHead>
          <TableHead>类型</TableHead>
          <TableHead>规则</TableHead>
          <TableHead className="w-24 text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {attributes.map((attribute) => (
          <TableRow key={attribute.id}>
            <TableCell className="font-medium">{attribute.label}</TableCell>
            <TableCell>
              <code className="rounded bg-muted px-1 py-0.5 text-xs">{attribute.key}</code>
            </TableCell>
            <TableCell>
              <span className="rounded-full border px-2 py-0.5 text-xs">
                {TYPE_LABELS[attribute.type]}
              </span>
            </TableCell>
            <TableCell className="max-w-64 truncate text-muted-foreground">
              {configSummary(attribute.config)}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`编辑 ${attribute.label}`}
                  onClick={() => onEdit(attribute)}
                >
                  <PencilIcon className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`删除 ${attribute.label}`}
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(attribute)}
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
