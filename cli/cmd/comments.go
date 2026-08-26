package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

// commentDto mirrors the backend CommentDto.
type commentDto struct {
	ID        int64  `json:"id"`
	UserID    int64  `json:"userId"`
	Content   string `json:"content"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

var (
	commentsPage     = 1
	commentsPageSize = 20
	commentsAll      bool

	flagCommentContent string
	flagForceComments  bool
)

// commentsCmd is the comments management entry.
//
// Endpoints: GET·POST /api/users/:userId/comments (list/create under a user),
// PATCH·DELETE /api/comments/:id.
var commentsCmd = &cobra.Command{
	Use:   "comments",
	Short: "留言管理",
	Long:  "管理人员的留言：按人员列出/新增，按留言 ID 修改/删除。",
}

// userCommentsPath builds /api/users/:userId/comments.
func userCommentsPath(userID int64) string {
	return fmt.Sprintf("/api/users/%d/comments", userID)
}

const commentsItemPathFmt = "/api/comments/%d"

// commentsListCmd lists a user's comments.
var commentsListCmd = &cobra.Command{
	Use:   "list <userId>",
	Short: "列出某人员的留言",
	Long: `分页列出指定人员的全部留言。

示例:
  registry comments list 4
  registry comments list 4 --all`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		userID, err := parseID(args[0])
		if err != nil {
			return err
		}
		path := userCommentsPath(userID)
		ctx := commandContext(cmd)

		var items []commentDto
		var total int
		if commentsAll {
			var err error
			items, total, err = walkAllPages[commentDto](apiClient, ctx, path, nil)
			if err != nil {
				return err
			}
		} else {
			if err := validatePageParams(commentsPage, commentsPageSize); err != nil {
				return err
			}
			q := urlValuesFor(commentsPage, commentsPageSize)
			items, total, err = fetchComments(ctx, path, q)
			if err != nil {
				return err
			}
		}

		renderCommentTable(items, total, "(该人员暂无留言)")
		return nil
	},
}

// commentsCreateCmd adds a comment to a user.
var commentsCreateCmd = &cobra.Command{
	Use:   "create <userId>",
	Short: "为人员添加留言",
	Long: `为指定人员新增一条留言（内容 1–2000 字）。

示例:
  registry comments create 4 -m "已核实身份信息"`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		userID, err := parseID(args[0])
		if err != nil {
			return err
		}
		if flagCommentContent == "" {
			return fmt.Errorf("必须通过 --content/-m 提供留言内容")
		}
		var dto commentDto
		body := map[string]any{"content": flagCommentContent}
		if err := apiClient.Post(commandContext(cmd), userCommentsPath(userID), body, &dto); err != nil {
			return err
		}
		printCreateResult("留言已创建", dto,
			fmt.Sprintf("留言已创建 (ID %d)", dto.ID),
			commentKV(dto))
		return nil
	},
}

// commentsUpdateCmd edits one comment by its own id.
var commentsUpdateCmd = &cobra.Command{
	Use:   "update <commentId>",
	Short: "修改留言",
	Long: `按留言 ID 修改内容。

示例:
  registry comments update 12 -m "更正：联系电话已核实"`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		id, err := parseID(args[0])
		if err != nil {
			return err
		}
		if flagCommentContent == "" {
			return fmt.Errorf("必须通过 --content/-m 提供新的留言内容")
		}
		var dto commentDto
		body := map[string]any{"content": flagCommentContent}
		if err := apiClient.Patch(commandContext(cmd), fmt.Sprintf(commentsItemPathFmt, id), body, &dto); err != nil {
			return err
		}
		printCreateResult("留言已更新", dto,
			fmt.Sprintf("留言 %d 已更新", dto.ID),
			commentKV(dto))
		return nil
	},
}

// commentsDeleteCmd deletes one comment by its own id.
var commentsDeleteCmd = &cobra.Command{
	Use:   "delete <commentId>",
	Short: "删除留言",
	Long: `按留言 ID 删除。

默认交互确认；--force/-f 跳过确认（供脚本使用）。`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		id, err := parseID(args[0])
		if err != nil {
			return err
		}
		if err := confirm(fmt.Sprintf("确认删除留言 %d？", id), flagForceComments); err != nil {
			return err
		}
		if err := apiClient.Delete(commandContext(cmd), fmt.Sprintf(commentsItemPathFmt, id)); err != nil {
			return err
		}
		printDeleteResult("留言已删除", "id", id)
		return nil
	},
}

// commentKV renders one comment as display key-value pairs.
func commentKV(c commentDto) map[string]string {
	return map[string]string{
		"ID":   fmt.Sprintf("%d", c.ID),
		"人员ID": fmt.Sprintf("%d", c.UserID),
		"内容":   truncateRunes(c.Content, 60),
		"更新时间": formatTimestamp(c.UpdatedAt),
	}
}

// renderCommentTable renders the shared comment table in both output modes.
func renderCommentTable(items []commentDto, total int, emptyMsg string) {
	if useJSON {
		printer.PrintSuccess("查询成功", map[string]any{"items": items, "total": total})
		return
	}
	if total == 0 {
		printer.PrintMessage(emptyMsg)
		return
	}
	if len(items) == 0 {
		printer.PrintMessage(fmt.Sprintf("本页无数据，共 %d 条记录", total))
		return
	}
	rows := make([]map[string]string, len(items))
	for i, c := range items {
		rows[i] = map[string]string{
			"ID":   fmt.Sprintf("%d", c.ID),
			"内容":   truncateRunes(c.Content, 40),
			"更新时间": formatTimestamp(c.UpdatedAt),
		}
	}
	printer.PrintTable([]string{"ID", "内容", "更新时间"}, rows)
	fmt.Printf("\n共 %d 条记录\n", total)
}

func init() {
	commentsListCmd.Flags().IntVarP(&commentsPage, "page", "p", 1, "页码")
	commentsListCmd.Flags().IntVarP(&commentsPageSize, "page-size", "", 20, "每页条数（最大 100）")
	commentsListCmd.Flags().BoolVarP(&commentsAll, "all", "a", false, "列出全部分页数据")

	commentsCreateCmd.Flags().StringVarP(&flagCommentContent, "content", "m", "", "留言内容（必填）")
	commentsUpdateCmd.Flags().StringVarP(&flagCommentContent, "content", "m", "", "新的留言内容（必填）")

	commentsDeleteCmd.Flags().BoolVarP(&flagForceComments, "force", "f", false, "跳过删除确认")

	commentsCmd.AddCommand(commentsListCmd)
	commentsCmd.AddCommand(commentsCreateCmd)
	commentsCmd.AddCommand(commentsUpdateCmd)
	commentsCmd.AddCommand(commentsDeleteCmd)
	rootCmd.AddCommand(commentsCmd)
}
