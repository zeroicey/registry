import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2Icon } from 'lucide-react';
import { useEffect } from 'react';
import { useController, useForm, useWatch } from 'react-hook-form';
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
import { useCreateAttribute, useUpdateAttribute } from '../queries';
import {
  type AttributeFormValues,
  attributeFormSchema,
  toCreateInput,
  toFormValues,
  toUpdateInput,
} from '../schemas';

const DEFAULT_VALUES: AttributeFormValues = {
  key: '',
  label: '',
  type: 'string',
  sortOrder: '',
  help: '',
  optionsRaw: '',
  min: '',
  max: '',
  regex: '',
};

const TYPE_OPTIONS: Array<{ value: AttributeFormValues['type']; label: string }> = [
  { value: 'string', label: '文本' },
  { value: 'number', label: '数字' },
  { value: 'bool', label: '布尔' },
  { value: 'date', label: '日期' },
  { value: 'select', label: '下拉' },
];

interface AttributeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing attribute when editing; undefined = create mode. */
  attribute?: AttributeDef | undefined;
}

function FieldError({ message }: { message?: string | undefined }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

/** Create / edit dialog for an attribute definition. */
export function AttributeFormDialog({ open, onOpenChange, attribute }: AttributeFormDialogProps) {
  const isEditing = attribute !== undefined;
  const createMutation = useCreateAttribute();
  const updateMutation = useUpdateAttribute();
  const isPending = isEditing ? updateMutation.isPending : createMutation.isPending;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AttributeFormValues>({
    resolver: zodResolver(attributeFormSchema),
    defaultValues: attribute ? toFormValues(attribute) : DEFAULT_VALUES,
  });

  // Re-seed the form whenever the dialog opens for a different target.
  useEffect(() => {
    if (open) {
      reset(attribute ? toFormValues(attribute) : DEFAULT_VALUES);
    }
  }, [open, attribute, reset]);

  const type = useWatch({ control, name: 'type' });
  const typeField = useController({ control, name: 'type' });

  const onSubmit = handleSubmit((values) => {
    if (isEditing && attribute) {
      updateMutation.mutate(
        { id: attribute.id, input: toUpdateInput(values) },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      createMutation.mutate(toCreateInput(values), { onSuccess: () => onOpenChange(false) });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-4rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? '编辑属性' : '新建属性'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? '修改属性的展示与校验规则。已有值的属性不可修改类型。'
              : '定义人员的自定义属性，创建后 key 不可修改。'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="attr-label">名称</Label>
              <Input id="attr-label" placeholder="如：部门" {...register('label')} />
              <FieldError message={errors.label?.message} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="attr-key">key</Label>
              <Input
                id="attr-key"
                placeholder="如：dept"
                disabled={isEditing}
                {...register('key')}
              />
              <FieldError message={errors.key?.message} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>类型</Label>
            <SelectRoot value={type} onValueChange={(value) => typeField.field.onChange(value)}>
              <SelectTrigger>
                <SelectValue placeholder="请选择类型" />
              </SelectTrigger>
              <SelectPopup>
                <SelectGroup>
                  <SelectLabel>字段类型</SelectLabel>
                  {TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectPopup>
            </SelectRoot>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
            {type === 'string' && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="attr-max">最大长度</Label>
                <Input
                  id="attr-max"
                  type="number"
                  min={1}
                  placeholder="如：100"
                  {...register('max')}
                />
                <FieldError message={errors.max?.message} />
              </div>
            )}
            {type === 'number' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="attr-min">最小值</Label>
                  <Input id="attr-min" type="number" step="any" {...register('min')} />
                  <FieldError message={errors.min?.message} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="attr-max">最大值</Label>
                  <Input id="attr-max" type="number" step="any" {...register('max')} />
                  <FieldError message={errors.max?.message} />
                </div>
              </div>
            )}
            {type === 'string' && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="attr-regex">正则校验（可选）</Label>
                <Input id="attr-regex" placeholder="如：^[A-Z]+$" {...register('regex')} />
                <FieldError message={errors.regex?.message} />
              </div>
            )}
            {type === 'select' && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="attr-options">选项（每行一个）</Label>
                <textarea
                  id="attr-options"
                  className="h-20 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  placeholder={'研发\n市场\n财务'}
                  {...register('optionsRaw')}
                />
                <FieldError message={errors.optionsRaw?.message} />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="attr-sort">排序值</Label>
              <Input
                id="attr-sort"
                type="number"
                min={0}
                placeholder="升序排列"
                {...register('sortOrder')}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="attr-help">帮助文本</Label>
              <Input id="attr-help" placeholder="表单中的说明文字" {...register('help')} />
              <FieldError message={errors.help?.message} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2Icon className="size-4 animate-spin" />}
              {isEditing ? '保存修改' : '创建'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
