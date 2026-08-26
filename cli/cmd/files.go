package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/zeroicey/registry-cli/internal/client"
)

// fileDto mirrors the backend FileDto.
type fileDto struct {
	ID           int64  `json:"id"`
	UserID       int64  `json:"userId"`
	OriginalName string `json:"originalName"`
	MimeType     string `json:"mimeType"`
	Size         int64  `json:"size"`
	CreatedAt    string `json:"createdAt"`
}

var (
	filesPage     = 1
	filesPageSize = 20
	filesAll      bool

	flagFileOutput string
	flagForceFiles bool
)

// filesCmd is the per-user attachment management entry.
//
// Endpoints: POST /api/users/:userId/files (multipart upload),
// GET /api/users/:userId/files (list), GET /api/files/:id/content (binary
// stream), DELETE /api/files/:id.
var filesCmd = &cobra.Command{
	Use:   "files",
	Short: "人员附件管理",
	Long: `管理人员附件：按人员上传（支持多文件）、列出、下载、删除。

多文件上传会循环发起 N 个请求并逐个上报结果；任一失败时整体退出码
非 0（已成功的文件不回滚）。`,
}

// failedFile records one per-file upload failure for the JSON batch summary.
type failedFile struct {
	Path  string `json:"path"`
	Error string `json:"error"`
}

const (
	fileContentPathFmt = "/api/files/%d/content"
	fileItemPathFmt    = "/api/files/%d"
)

// filesUploadCmd uploads one or more files for a user.
var filesUploadCmd = &cobra.Command{
	Use:   "upload <userId> <file...>",
	Short: "为人员上传附件（可多文件）",
	Long: `为指定人员上传一个或多个附件（multipart/form-data，字段名 file）。

每个文件独立成一次请求、逐行上报 ✓/✗ 结果；全部成功 exit 0，
任一失败 exit 非 0（其余文件仍会上传完毕）。

示例:
  registry files upload 4 身份证正面.jpg
  registry files upload 4 a.pdf b.pdf c.png`,
	Args: cobra.MinimumNArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		userID, err := parseID(args[0])
		if err != nil {
			return err
		}
		paths := args[1:]
		path := fmt.Sprintf("/api/users/%d/files", userID)
		ctx := commandContext(cmd)

		var uploaded []fileDto
		var failures []failedFile
		for _, p := range paths {
			var dto fileDto
			err := apiClient.UploadFile(ctx, path, p, nil, &dto)
			switch {
			case err != nil:
				failures = append(failures, failedFile{Path: p, Error: err.Error()})
				// Per-file failure lines always go to stderr — even in table
				// mode — so stdout never mixes results with error noise and
				// --json keeps its single-document guarantee.
				fmt.Fprintf(os.Stderr, "✗ %s: %s\n", p, err.Error())
			default:
				uploaded = append(uploaded, dto)
				if !useJSON {
					printer.PrintMessage(fmt.Sprintf("✓ %s → 文件 ID %d (%d 字节)", p, dto.ID, dto.Size))
				}
			}
		}

		if useJSON {
			printUploadSummary(uploaded, failures)
		}
		if len(failures) > 0 && len(failures) == len(paths) {
			return &renderedError{message: fmt.Sprintf("%d/%d 个文件上传失败", len(failures), len(paths))}
		}
		if len(failures) > 0 {
			return &renderedError{message: fmt.Sprintf("%d/%d 个文件上传失败（其余已成功）", len(failures), len(paths))}
		}
		if !useJSON {
			printer.PrintMessage(fmt.Sprintf("共上传 %d 个文件", len(uploaded)))
		}
		return nil
	},
}

// printUploadSummary renders the batch upload result as ONE JSON document:
// success envelope when everything uploaded, partial shape otherwise.
func printUploadSummary(uploaded []fileDto, failures []failedFile) {
	if len(failures) == 0 {
		printer.PrintSuccess("上传完成", map[string]any{"files": uploaded})
		return
	}
	printer.PrintSuccess("部分文件上传失败", map[string]any{
		"files":    uploaded,
		"failures": failures,
	})
}

// filesListCmd lists a user's attachments.
var filesListCmd = &cobra.Command{
	Use:   "list <userId>",
	Short: "列出某人员的附件",
	Long: `分页列出指定人员的全部附件。

示例:
  registry files list 4
  registry files list 4 --all`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		userID, err := parseID(args[0])
		if err != nil {
			return err
		}
		path := fmt.Sprintf("/api/users/%d/files", userID)
		ctx := commandContext(cmd)

		var items []fileDto
		var total int
		if filesAll {
			var err error
			items, total, err = walkAllPages[fileDto](apiClient, ctx, path, nil)
			if err != nil {
				return err
			}
		} else {
			if err := validatePageParams(filesPage, filesPageSize); err != nil {
				return err
			}
			q := urlValuesFor(filesPage, filesPageSize)
			items, total, err = client.List[fileDto](apiClient, ctx, path, q)
		}
		if err != nil {
			return err
		}

		if useJSON {
			printer.PrintSuccess("查询成功", map[string]any{"items": items, "total": total})
			return nil
		}
		if total == 0 {
			printer.PrintMessage("(该人员暂无附件)")
			return nil
		}
		if len(items) == 0 {
			printer.PrintMessage(fmt.Sprintf("本页无数据，共 %d 条记录", total))
			return nil
		}
		rows := make([]map[string]string, len(items))
		for i, f := range items {
			rows[i] = map[string]string{
				"ID":   fmt.Sprintf("%d", f.ID),
				"文件名":  truncateRunes(f.OriginalName, 30),
				"类型":   truncateRunes(f.MimeType, 20),
				"大小":   humanSize(f.Size),
				"上传时间": formatTimestamp(f.CreatedAt),
			}
		}
		printer.PrintTable([]string{"ID", "文件名", "类型", "大小", "上传时间"}, rows)
		fmt.Printf("\n共 %d 条记录\n", total)
		return nil
	},
}

// filesDownloadCmd downloads an attachment to disk.
var filesDownloadCmd = &cobra.Command{
	Use:   "download <fileId>",
	Short: "下载附件",
	Long: `下载指定附件到本地。

省略 -o 时以服务器声明的原始文件名保存到当前目录；
目标文件已存在时拒绝覆盖（--force/-f 允许覆盖）。
二进制内容只落盘，stdout 仅输出摘要（--json 下为 JSON 摘要）。

示例:
  registry files download 7
  registry files download 7 -o ./身份证正面.jpg`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		id, err := parseID(args[0])
		if err != nil {
			return err
		}
		saved, n, err := apiClient.DownloadFile(commandContext(cmd), fmt.Sprintf(fileContentPathFmt, id), flagFileOutput, flagForceFiles)
		if err != nil {
			return err
		}
		if useJSON {
			printer.PrintSuccess("下载完成", map[string]any{"id": id, "path": saved, "bytes": n})
			return nil
		}
		printer.PrintMessage(fmt.Sprintf("✓ 已保存 %s（%s）", saved, humanSize(n)))
		return nil
	},
}

// filesDeleteCmd deletes an attachment.
var filesDeleteCmd = &cobra.Command{
	Use:   "delete <fileId>",
	Short: "删除附件",
	Long: `删除指定附件（存储与记录一并移除）。

默认交互确认；--force/-f 跳过确认（供脚本使用）。`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		id, err := parseID(args[0])
		if err != nil {
			return err
		}
		if err := confirm(fmt.Sprintf("确认删除附件 %d？", id), flagForceFiles); err != nil {
			return err
		}
		if err := apiClient.Delete(commandContext(cmd), fmt.Sprintf(fileItemPathFmt, id)); err != nil {
			return err
		}
		printDeleteResult("附件已删除", "id", id)
		return nil
	},
}

// humanSize renders a byte count as a human-readable string.
func humanSize(n int64) string {
	const unit = 1024
	if n < unit {
		return fmt.Sprintf("%d B", n)
	}
	div, exp := int64(unit), 0
	for m := n / unit; m >= unit; m /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(n)/float64(div), "KMGTPE"[exp])
}

func init() {
	filesListCmd.Flags().IntVarP(&filesPage, "page", "p", 1, "页码")
	filesListCmd.Flags().IntVarP(&filesPageSize, "page-size", "", 20, "每页条数（最大 100）")
	filesListCmd.Flags().BoolVarP(&filesAll, "all", "a", false, "列出全部分页数据")

	filesDownloadCmd.Flags().StringVarP(&flagFileOutput, "output", "o", "", "输出路径（缺省用服务器声明的原始文件名）")
	filesDownloadCmd.Flags().BoolVarP(&flagForceFiles, "force", "f", false, "覆盖已存在的目标文件")

	filesDeleteCmd.Flags().BoolVarP(&flagForceFiles, "force", "f", false, "跳过删除确认")

	filesCmd.AddCommand(filesUploadCmd)
	filesCmd.AddCommand(filesListCmd)
	filesCmd.AddCommand(filesDownloadCmd)
	filesCmd.AddCommand(filesDeleteCmd)
	rootCmd.AddCommand(filesCmd)
}
