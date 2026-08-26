package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

// collectionDto mirrors the backend CollectionDto.
type collectionDto struct {
	ID          int64   `json:"id"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	MemberCount int     `json:"memberCount"`
	CreatedAt   string  `json:"createdAt"`
	UpdatedAt   string  `json:"updatedAt"`
}

func (c collectionDto) descriptionOrDash() string {
	if c.Description == nil || *c.Description == "" {
		return "-"
	}
	return truncateRunes(*c.Description, 30)
}

const collectionsPath = "/api/collections"

// collectionsCmd is the collections management entry.
var collectionsCmd = &cobra.Command{
	Use:     "collections",
	Aliases: []string{"collection"},
	Short:   "名录管理",
	Long: `管理名录（人员分组）：创建、查看、更新、删除，以及成员的添加与移除。

成员列举没有独立端点：请用 registry users list --collection-id <id> 查询
某个名录下的全部成员。`,
}

var (
	collectionPage     = 1
	collectionPageSize = 20
	collectionAll      bool

	flagCollectionName        string
	flagCollectionDescription string
	flagForceCollections      bool
)

// collectionsListCmd lists collections with pagination.
var collectionsListCmd = paginatedListCommand[collectionDto](
	listSpec[collectionDto]{
		use:      "list",
		short:    "列出名录",
		long:     "分页列出名录，含每个名录的成员数量。\n\n示例:\n  registry collections list --page 1 --page-size 20\n  registry collections list --all",
		path:     collectionsPath,
		emptyMsg: "(暂无名录)",
		headers:  []string{"ID", "名称", "描述", "成员数", "更新时间"},
		row: func(c collectionDto) map[string]string {
			return map[string]string{
				"ID":   fmt.Sprintf("%d", c.ID),
				"名称":   c.Name,
				"描述":   c.descriptionOrDash(),
				"成员数":  fmt.Sprintf("%d", c.MemberCount),
				"更新时间": formatTimestamp(c.UpdatedAt),
			}
		},
	},
	&collectionPage, &collectionPageSize, &collectionAll,
)

// collectionsGetCmd shows one collection as key-value pairs.
var collectionsGetCmd = &cobra.Command{
	Use:   "get <id>",
	Short: "查看单个名录",
	Long:  "按 ID 查看名录详情（含描述与成员数量）。\n\n示例:\n  registry collections get 1",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		id, err := parseID(args[0])
		if err != nil {
			return err
		}
		var dto collectionDto
		path := fmt.Sprintf("%s/%d", collectionsPath, id)
		if err := apiClient.Get(commandContext(cmd), path, nil, &dto); err != nil {
			return err
		}

		kv := map[string]string{
			"ID":   fmt.Sprintf("%d", dto.ID),
			"名称":   dto.Name,
			"描述":   dto.descriptionOrDash(),
			"成员数":  fmt.Sprintf("%d", dto.MemberCount),
			"创建时间": formatTimestamp(dto.CreatedAt),
			"更新时间": formatTimestamp(dto.UpdatedAt),
		}
		printer.PrintKeyValue(kv)
		return nil
	},
}

// collectionsCreateCmd creates a new collection.
var collectionsCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "创建名录",
	Long: `创建一个新名录。

示例:
  registry collections create -n "2024级计算机一班"
  registry collections create -n "教职工名录" -d "全校在职教职工"`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if flagCollectionName == "" {
			return fmt.Errorf("必须通过 --name/-n 指定名录名称")
		}
		body := map[string]any{"name": flagCollectionName}
		if flagCollectionDescription != "" {
			body["description"] = flagCollectionDescription
		}

		var dto collectionDto
		if err := apiClient.Post(commandContext(cmd), collectionsPath, body, &dto); err != nil {
			return err
		}

		printCreateResult("名录已创建", dto, fmt.Sprintf("名录「%s」已创建 (ID %d)", dto.Name, dto.ID),
			map[string]string{"ID": fmt.Sprintf("%d", dto.ID), "名称": dto.Name})
		return nil
	},
}

// collectionsUpdateCmd updates name/description of a collection.
var collectionsUpdateCmd = &cobra.Command{
	Use:   "update <id>",
	Short: "更新名录",
	Long: `更新名录的名称或描述（至少提供一个字段；未提供的字段保持不变）。

示例:
  registry collections update 1 -n "2024级计科1班"
  registry collections update 1 -d ""`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		id, err := parseID(args[0])
		if err != nil {
			return err
		}
		// Use the cmd parameter (not the package var) so the initializer does
		// not reference itself — a package-level var whose closure reads the
		// var is an initialization cycle in Go.
		nameChanged := cmd.Flags().Changed("name")
		descChanged := cmd.Flags().Changed("description")
		if !nameChanged && !descChanged {
			return fmt.Errorf("至少提供 --name/-n 或 --description/-d 之一")
		}
		body := map[string]any{}
		if nameChanged {
			body["name"] = flagCollectionName
		}
		if descChanged {
			body["description"] = nullableString(flagCollectionDescription)
		}

		var dto collectionDto
		path := fmt.Sprintf("%s/%d", collectionsPath, id)
		if err := apiClient.Patch(commandContext(cmd), path, body, &dto); err != nil {
			return err
		}

		printCreateResult("名录已更新", dto, fmt.Sprintf("名录「%s」已更新", dto.Name),
			map[string]string{"ID": fmt.Sprintf("%d", dto.ID), "名称": dto.Name})
		return nil
	},
}

// collectionsDeleteCmd deletes a collection (confirm unless --force).
var collectionsDeleteCmd = &cobra.Command{
	Use:   "delete <id>",
	Short: "删除名录",
	Long: `删除指定名录（不影响其中的人员记录本身）。

默认交互确认；--force/-f 跳过确认（供脚本使用）。`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		id, err := parseID(args[0])
		if err != nil {
			return err
		}
		if err := confirm(fmt.Sprintf("确认删除名录 %d？", id), flagForceCollections); err != nil {
			return err
		}
		path := fmt.Sprintf("%s/%d", collectionsPath, id)
		if err := apiClient.Delete(commandContext(cmd), path); err != nil {
			return err
		}
		printDeleteResult("名录已删除", "id", id)
		return nil
	},
}

// collectionMembersCmd groups member management (add/remove).
// There is no member-list endpoint by design: enumerate members via
// `registry users list --collection-id <id>`.
var collectionMembersCmd = &cobra.Command{
	Use:   "members",
	Short: "名录成员管理（增删；列举走 users list）",
	Long: `管理名录成员。

成员列举没有独立端点：请用 registry users list --collection-id <id> 查询。`,
}

// membersAddCmd bulk-adds users to a collection (idempotent on the backend).
var membersAddCmd = &cobra.Command{
	Use:   "add <collectionId> <userId...>",
	Short: "批量添加成员（幂等）",
	Long: `把一个或多个人员加入名录。后端幂等：重复添加不报错。

示例:
  registry collections members add 1 4 5 6`,
	Args: cobra.MinimumNArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		cid, err := parseID(args[0])
		if err != nil {
			return err
		}
		userIDs := make([]int64, 0, len(args)-1)
		for _, a := range args[1:] {
			uid, err := parseID(a)
			if err != nil {
				return err
			}
			userIDs = append(userIDs, uid)
		}
		path := fmt.Sprintf("/api/collections/%d/members", cid)
		body := map[string]any{"userIds": userIDs}
		if err := apiClient.Post(commandContext(cmd), path, body, nil); err != nil {
			return err
		}
		printDeleteResult(fmt.Sprintf("已添加 %d 个成员到名录 %d", len(userIDs), cid), "collectionId", cid)
		return nil
	},
}

// membersRemoveCmd removes one member from a collection.
var membersRemoveCmd = &cobra.Command{
	Use:   "remove <collectionId> <userId>",
	Short: "移除成员",
	Long: `把一个人员移出名录（不影响人员记录本身）。

默认交互确认；--force/-f 跳过确认（供脚本使用）。`,
	Args: cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		cid, err := parseID(args[0])
		if err != nil {
			return err
		}
		uid, err := parseID(args[1])
		if err != nil {
			return err
		}
		if err := confirm(fmt.Sprintf("确认把人员 %d 移出名录 %d？", uid, cid), flagForceCollections); err != nil {
			return err
		}
		path := fmt.Sprintf("/api/collections/%d/members/%d", cid, uid)
		if err := apiClient.Delete(commandContext(cmd), path); err != nil {
			return err
		}
		printDeleteResult(fmt.Sprintf("人员 %d 已移出名录 %d", uid, cid), "userId", uid)
		return nil
	},
}

func init() {
	// Shared flags for create/update.
	collectionsCreateCmd.Flags().StringVarP(&flagCollectionName, "name", "n", "", "名录名称（必填）")
	collectionsCreateCmd.Flags().StringVarP(&flagCollectionDescription, "description", "d", "", "名录描述（可选）")
	collectionsCreateCmd.MarkFlagRequired("name")

	collectionsUpdateCmd.Flags().StringVarP(&flagCollectionName, "name", "n", "", "新的名录名称")
	collectionsUpdateCmd.Flags().StringVarP(&flagCollectionDescription, "description", "d", "", "新的名录描述（传空字符串清除描述）")

	collectionsListCmd.Flags().IntVarP(&collectionPage, "page", "p", 1, "页码")
	collectionsListCmd.Flags().IntVarP(&collectionPageSize, "page-size", "", 20, "每页条数（最大 100）")
	collectionsListCmd.Flags().BoolVarP(&collectionAll, "all", "a", false, "列出全部分页数据")

	collectionsDeleteCmd.Flags().BoolVarP(&flagForceCollections, "force", "f", false, "跳过删除确认")
	membersRemoveCmd.Flags().BoolVarP(&flagForceCollections, "force", "f", false, "跳过移除确认")

	collectionsCmd.AddCommand(collectionsListCmd)
	collectionsCmd.AddCommand(collectionsGetCmd)
	collectionsCmd.AddCommand(collectionsCreateCmd)
	collectionsCmd.AddCommand(collectionsUpdateCmd)
	collectionsCmd.AddCommand(collectionsDeleteCmd)
	collectionMembersCmd.AddCommand(membersAddCmd)
	collectionMembersCmd.AddCommand(membersRemoveCmd)
	collectionsCmd.AddCommand(collectionMembersCmd)
	rootCmd.AddCommand(collectionsCmd)
}
