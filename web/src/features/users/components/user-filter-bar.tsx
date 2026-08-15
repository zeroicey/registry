import { PlusIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectPopup,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AttributeDef } from '@/types/attribute';
import type { AttributeFilterValue } from '../types';

const BOOL_OPTIONS = [
  { value: 'true', label: '是' },
  { value: 'false', label: '否' },
];

interface UserFilterBarProps {
  /** Active attribute definitions (from useAttributeDefs). */
  defs: AttributeDef[];
  /** Currently applied filters. */
  filters: AttributeFilterValue[];
  onChange: (filters: AttributeFilterValue[]) => void;
}

/** Filter chips bar + add-filter dialog. Renders a value control per attribute type. */
export function UserFilterBar({ defs, filters, onChange }: UserFilterBarProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const removeFilter = (key: string) => onChange(filters.filter((f) => f.key !== key));
  const clearAll = () => onChange([]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
        <PlusIcon className="size-3.5" />
        添加筛选
      </Button>

      {filters.map((filter) => {
        const def = defs.find((d) => d.key === filter.key);
        return (
          <span
            key={filter.key}
            className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 py-1 pr-1 pl-3 text-sm"
          >
            <span className="text-muted-foreground">{def?.label ?? filter.key}</span>
            <span className="font-medium">{formatFilterValue(def, filter.value)}</span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`移除 ${def?.label ?? filter.key} 筛选`}
              onClick={() => removeFilter(filter.key)}
            >
              <XIcon className="size-3" />
            </Button>
          </span>
        );
      })}

      {filters.length > 0 && (
        <Button variant="link" size="sm" onClick={clearAll}>
          清除全部
        </Button>
      )}

      <FilterDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defs={defs}
        existingKeys={filters.map((f) => f.key)}
        onConfirm={(filter) => onChange([...filters, filter])}
      />
    </div>
  );
}

/** Human-readable chip text: bool → 是/否, others verbatim. */
function formatFilterValue(def: AttributeDef | undefined, value: string): string {
  if (def?.type === 'bool') return value === 'true' ? '是' : '否';
  return value;
}

interface FilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defs: AttributeDef[];
  /** Keys already used by an existing filter — excluded from the picker. */
  existingKeys: string[];
  onConfirm: (filter: AttributeFilterValue) => void;
}

function FilterDialog({ open, onOpenChange, defs, existingKeys, onConfirm }: FilterDialogProps) {
  const available = defs.filter((d) => !existingKeys.includes(d.key));

  const [key, setKey] = useState<string>('');
  const [value, setValue] = useState<string>('');

  const selectedDef = defs.find((d) => d.key === key);

  const reset = () => {
    setKey('');
    setValue('');
  };

  const confirm = () => {
    if (!key || value.trim() === '') return;
    onConfirm({ key, value: value.trim() });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>添加筛选</DialogTitle>
          <DialogDescription>按属性值精确过滤人员，可叠加多个筛选条件。</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>属性</Label>
            {available.length === 0 ? (
              <p className="text-sm text-muted-foreground">没有可添加的属性。</p>
            ) : (
              <SelectRoot value={key} onValueChange={(v) => setKey(v as string)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择属性" />
                </SelectTrigger>
                <SelectPopup>
                  <SelectGroup>
                    <SelectLabel>属性</SelectLabel>
                    {available.map((def) => (
                      <SelectItem key={def.key} value={def.key}>
                        {def.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectPopup>
              </SelectRoot>
            )}
          </div>

          {selectedDef && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-value">值</Label>
              {renderValueControl(selectedDef, value, setValue)}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button disabled={!selectedDef || value.trim() === ''} onClick={confirm}>
            确定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function renderValueControl(def: AttributeDef, value: string, onChange: (value: string) => void) {
  switch (def.type) {
    case 'bool':
      return (
        <SelectRoot value={value} onValueChange={(v) => onChange(v as string)}>
          <SelectTrigger id="filter-value">
            <SelectValue placeholder="选择" />
          </SelectTrigger>
          <SelectPopup>
            {BOOL_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectPopup>
        </SelectRoot>
      );
    case 'number':
      return (
        <Input
          id="filter-value"
          type="number"
          step="any"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    case 'date':
      return (
        <Input
          id="filter-value"
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    case 'select':
      return (
        <SelectRoot value={value} onValueChange={(v) => onChange(v as string)}>
          <SelectTrigger id="filter-value">
            <SelectValue placeholder="选择" />
          </SelectTrigger>
          <SelectPopup>
            {(def.config.options ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectPopup>
        </SelectRoot>
      );
    case 'string':
      return (
        <Input
          id="filter-value"
          value={value}
          placeholder="精确匹配"
          onChange={(event) => onChange(event.target.value)}
        />
      );
  }
}
