import { zodResolver } from '@hookform/resolvers/zod';
import { SendIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { type CreateCommentInput, createCommentSchema } from '../schemas';

interface CommentFormProps {
  userId: number;
  onSubmit: (input: CreateCommentInput) => void;
  isPending?: boolean;
}

/** 底部留言输入框：提交成功后由父组件清空表单。 */
export function CommentForm({ userId, onSubmit, isPending }: CommentFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateCommentInput>({
    resolver: zodResolver(createCommentSchema),
    defaultValues: { content: '' },
  });

  const submit = (input: CreateCommentInput) => {
    onSubmit(input);
    reset({ content: '' });
  };

  return (
    <form
      onSubmit={handleSubmit(submit)}
      className="flex flex-col gap-2 border-t pt-3"
      aria-label={`给 ${userId} 留言`}
    >
      <Textarea
        data-testid="comment-input"
        placeholder="写留言…（最多 2000 字）"
        rows={3}
        aria-invalid={Boolean(errors.content)}
        className="resize-none rounded-none border-0 border-b bg-transparent px-0 py-2 focus-visible:ring-0"
        {...register('content')}
      />
      {errors.content && <p className="text-xs text-destructive">{errors.content.message}</p>}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isPending}>
          <SendIcon className="size-3.5" />
          {isPending ? '发布中…' : '发布留言'}
        </Button>
      </div>
    </form>
  );
}
