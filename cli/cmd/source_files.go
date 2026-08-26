package cmd

import (
	"fmt"
	"net/url"

	"github.com/spf13/cobra"
	"github.com/zeroicey/registry-cli/internal/client"
)

// sourceFileDto mirrors the backend SourceFileDto.
type sourceFileDto struct {
	ID           int64  `json:"id"`
	CollectionID *int64 `json:"collectionId"`
	OriginalName string `json:"originalName"`
	MimeType     string `json:"mimeType"`
	Size         int64  `json:"size"`
	Status       string `json:"status"`
	CreatedAt    string `json:"createdAt"`
}

const sourceFilesPath = "/api/source-files"

var (
	sfPage     = 1
	sfPageSize = 20
	sfAll      bool

	flagSFCollID    int64
	flagSFOutput    string
	flagSFOverwrite bool
)

// sourceFilesCmd is the data-source-file management entry.
//
// Endpoints: POST /api/source-files (multipart: file + collectionId),
// GET /api/source-files (list), GET /api/source-files/:id/content (binary).
// No delete — a source file is the root of traceability (backend invariant).
var sourceFilesCmd = &cobra.Command{
	Use:     "source-files",
	Aliases: []string{"sf"},
	Short:   "数据源文件管理",
	Long: `管理数据源文件（导入溯源的根，不可删除）。

上传必须指定归属名录；列表可按名录过滤。`,
}

// sfUploadCmd uploads one source file into a collection.
var sfUploadCmd = &cobra.Command{
	Use:   "upload <file>",
	Short: "上传数据源文件（须指定名录）",
	Long: `上传一个数据源文件到指定名录。

--collection-id 必填（后端强校验）。文件字段名 file，名录以表单字段
collectionId 提交。

示例:
  registry source-files upload 名单.xlsx --collection-id 1`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if flagSFCollID <= 0 {
			return fmt.Errorf("必须通过 --collection-id 指定归属名录")
		}
		var dto sourceFileDto
		extra := map[string]string{"collectionId": fmt.Sprintf("%d", flagSFCollID)}
		if err := apiClient.UploadFile(commandContext(cmd), sourceFilesPath, args[0], extra, &dto); err != nil {
			return err
		}
		coll := "-"
		if dto.CollectionID != nil {
			coll = fmt.Sprintf("%d", *dto.CollectionID)
		}
		printCreateResult("源文件已上传", dto,
			fmt.Sprintf("源文件「%s」已上传 (ID %d)", dto.OriginalName, dto.ID),
			map[string]string{
				"ID":  fmt.Sprintf("%d", dto.ID),
				"文件名": dto.OriginalName,
				"名录":  coll,
				"状态":  dto.Status,
				"大小":  humanSize(dto.Size),
			})
		return nil
	},
}

// sfListCmd lists source files.
var sfListCmd = &cobra.Command{
	Use:   "list",
	Short: "列出数据源文件",
	Long: `分页列出数据源文件，可按名录过滤。

示例:
  registry source-files list
  registry source-files list --collection-id 1 --all`,
	Args: cobra.NoArgs,
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := commandContext(cmd)

		addCollFilter := func(q url.Values) {
			if flagSFCollID > 0 {
				q.Set("collectionId", fmt.Sprintf("%d", flagSFCollID))
			}
		}
		var items []sourceFileDto
		var total int
		var err error
		if sfAll {
			// --all overrides page/pageSize entirely; overflow errors loudly.
			items, total, err = walkAllPages[sourceFileDto](apiClient, commandContext(cmd), sourceFilesPath, addCollFilter)
		} else {
			if err = validatePageParams(sfPage, sfPageSize); err != nil {
				return err
			}
			q := urlValuesFor(sfPage, sfPageSize)
			addCollFilter(q)
			items, total, err = client.List[sourceFileDto](apiClient, ctx, sourceFilesPath, q)
		}
		if err != nil {
			return err
		}

		if useJSON {
			printer.PrintSuccess("查询成功", map[string]any{"items": items, "total": total})
			return nil
		}
		if total == 0 {
			printer.PrintMessage("(暂无数据源文件)")
			return nil
		}
		if len(items) == 0 {
			printer.PrintMessage(fmt.Sprintf("本页无数据，共 %d 条记录", total))
			return nil
		}
		rows := make([]map[string]string, len(items))
		for i, f := range items {
			coll := "-"
			if f.CollectionID != nil {
				coll = fmt.Sprintf("%d", *f.CollectionID)
			}
			rows[i] = map[string]string{
				"ID":  fmt.Sprintf("%d", f.ID),
				"文件名": truncateRunes(f.OriginalName, 30),
				"名录":  coll,
				"状态":  f.Status,
				"大小":  humanSize(f.Size),
				"时间":  formatTimestamp(f.CreatedAt),
			}
		}
		printer.PrintTable([]string{"ID", "文件名", "名录", "状态", "大小", "时间"}, rows)
		fmt.Printf("\n共 %d 条记录\n", total)
		return nil
	},
}

// sfDownloadCmd downloads a source file's content.
var sfDownloadCmd = &cobra.Command{
	Use:   "download <id>",
	Short: "下载数据源文件",
	Long: `下载指定数据源文件的原始内容。

省略 -o 时以服务器声明的原始文件名保存到当前目录；
目标文件已存在时拒绝覆盖（--force/-f 允许覆盖）。
二进制内容只落盘，stdout 仅输出摘要（--json 下为 JSON 摘要）。

示例:
  registry source-files download 3
  registry source-files download 3 -o ./名单.xlsx`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		id, err := parseID(args[0])
		if err != nil {
			return err
		}
		saved, n, err := apiClient.DownloadFile(commandContext(cmd), fmt.Sprintf("/api/source-files/%d/content", id), flagSFOutput, flagSFOverwrite)
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

func init() {
	sfListCmd.Flags().IntVarP(&sfPage, "page", "p", 1, "页码")
	sfListCmd.Flags().IntVarP(&sfPageSize, "page-size", "", 20, "每页条数（最大 100）")
	sfListCmd.Flags().BoolVarP(&sfAll, "all", "a", false, "列出全部分页数据")
	sfListCmd.Flags().Int64VarP(&flagSFCollID, "collection-id", "", 0, "只列该名录的源文件")

	sfUploadCmd.Flags().Int64VarP(&flagSFCollID, "collection-id", "", 0, "归属名录 ID（必填）")

	sfDownloadCmd.Flags().StringVarP(&flagSFOutput, "output", "o", "", "输出路径（缺省用服务器声明的原始文件名）")
	sfDownloadCmd.Flags().BoolVarP(&flagSFOverwrite, "force", "f", false, "覆盖已存在的目标文件")

	sourceFilesCmd.AddCommand(sfUploadCmd)
	sourceFilesCmd.AddCommand(sfListCmd)
	sourceFilesCmd.AddCommand(sfDownloadCmd)
	rootCmd.AddCommand(sourceFilesCmd)
}
