import type { SourceFileDto } from './types';

/**
 * Build the import prompt handed to an external AI agent (CodeX / Cloud Code /
 * pi). The prompt encodes the provenance contract the importer must honour so
 * that every imported row is traceable back to this source file.
 */
export function buildImportPrompt(file: SourceFileDto): string {
  return [
    '你是数据导入助手，请把以下数据文件导入 Registry 数据库（PostgreSQL，表结构见 api/src/db/schema.ts，Bun + Drizzle + postgres.js）。',
    '',
    '【文件信息】',
    `- 数据源文件 id: ${file.id}`,
    `- 文件名: ${file.originalName}`,
    `- 原始内容：GET /api/source-files/${file.id}/content 可下载；或读服务器 UPLOAD_ROOT/source-files/ 下的文件`,
    '',
    '【溯源契约（必须遵守）】',
    "1. 本文件导入的每个人员，users.source_type 必须设为 'file'。",
    `2. 每个导入的 user 都要在 user_source_files 表插入一行 (user_id, source_file_id=${file.id})。`,
    "3. 不要改动手动录入（source_type='manual'）的人员。",
    `4. 导入完成后，把 source_files 表 id=${file.id} 的 status 更新为 'imported'。`,
    '',
    '【属性建议】',
    '- 文件里的新列，先列出建议属性（key/类型/options）给我确认，确认后再创建 attributes、再导入。',
    '- 已存在的属性按现有 key 复用。',
    '',
    '【去重（一人多文件）】',
    '- 发现疑似同一人（按 emp_no 或 code 匹配）已存在时，停下告诉我，等我决定「新建」还是「合并」。',
    '- 合并：更新属性值，并在 user_source_files 追加一行来源，不新建 user。',
    '',
    '请先解析文件并列出你的导入计划（新属性建议 + 可能冲突），等我确认后再写入。',
  ].join('\n');
}
