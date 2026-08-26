package cmd

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/spf13/cobra"
	"github.com/zeroicey/registry-cli/internal/client"
)

// userSummaryDto mirrors the backend UserSummaryDto.
type userSummaryDto struct {
	ID        int64   `json:"id"`
	RealName  string  `json:"realName"`
	Code      *string `json:"code"`
	CreatedAt string  `json:"createdAt"`
	UpdatedAt string  `json:"updatedAt"`
}

// collectionRef mirrors the backend CollectionRef.
type collectionRef struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

// userDto mirrors the backend UserDto (summary + profile + collections).
// The embedded struct flattens correctly in JSON encoding/decoding.
type userDto struct {
	userSummaryDto
	Profile     map[string]any  `json:"profile"`
	Collections []collectionRef `json:"collections"`
}

const usersPath = "/api/users"

var (
	usersPage     = 1
	usersPageSize = 20
	usersAll      bool

	flagUsersSearch       string
	flagUsersHasCode      string
	flagUsersCollectionID int64

	flagUserRealName     string
	flagUserCode         string
	flagUserCollectionID int64
	flagUserProfile      string
	flagGetCollectionID  int64
	flagProfileCollID    int64
	flagForceUsers       bool
)

// usersCmd is the users management entry.
var usersCmd = &cobra.Command{
	Use:   "users",
	Short: "人员管理",
	Long: `管理人员记录：创建、查看（含属性档案 profile）、更新、删除。

list 支持模糊搜索、编码有无过滤、名录成员过滤，以及任意属性值过滤
（以 key=value 位置参数追加，如 registry users list gender=男）。`,
}

// usersListCmd lists users with pagination and filters.
//
// Attribute filters arrive as positional key=value args appended to the query,
// mirroring the backend's catchall query validation. Because of the positional
// args this command cannot use the shared paginatedListCommand (NoArgs), so it
// runs its own pagination walk with identical output contracts.
var usersListCmd = &cobra.Command{
	Use:   "list [key=value ...]",
	Short: "列出人员",
	Long: `分页列出人员，支持多种过滤：

  --search               模糊匹配姓名 / 编码
  --has-code true|false  按有无编码过滤
  --collection-id        只列某名录的成员
  key=value ...          属性精确过滤（如 gender=男）

示例:
  registry users list
  registry users list --search 张
  registry users list --collection-id 1 gender=男`,
	Args: cobra.ArbitraryArgs,
	RunE: func(cmd *cobra.Command, args []string) error {
		attrFilters, err := parseKeyValueArgs(args)
		if err != nil {
			return err
		}
		if flagUsersHasCode != "" && flagUsersHasCode != "true" && flagUsersHasCode != "false" {
			return fmt.Errorf("无效的 --has-code 值: %s（仅接受 true/false）", flagUsersHasCode)
		}
		if !usersAll {
			if err := validatePageParams(usersPage, usersPageSize); err != nil {
				return err
			}
		}

		baseQuery := func(q url.Values) {
			if flagUsersSearch != "" {
				q.Set("search", flagUsersSearch)
			}
			if flagUsersHasCode != "" {
				q.Set("hasCode", flagUsersHasCode)
			}
			if flagUsersCollectionID > 0 {
				q.Set("collectionId", fmt.Sprintf("%d", flagUsersCollectionID))
			}
			for k, v := range attrFilters {
				q.Set(k, v)
			}
		}
		ctx := commandContext(cmd)

		var items []userSummaryDto
		var total int
		if usersAll {
			// --all overrides page/pageSize entirely; overflow errors loudly.
			items, total, err = walkAllPages[userSummaryDto](apiClient, ctx, usersPath, baseQuery)
		} else {
			q := url.Values{}
			q.Set("page", fmt.Sprintf("%d", usersPage))
			q.Set("pageSize", fmt.Sprintf("%d", usersPageSize))
			baseQuery(q)
			items, total, err = client.List[userSummaryDto](apiClient, ctx, usersPath, q)
		}
		if err != nil {
			return err
		}

		if useJSON {
			printer.PrintSuccess("查询成功", map[string]any{"items": items, "total": total})
			return nil
		}
		if total == 0 {
			printer.PrintMessage("(未找到人员)")
			return nil
		}
		if len(items) == 0 {
			printer.PrintMessage(fmt.Sprintf("本页无数据，共 %d 条记录", total))
			return nil
		}
		rows := make([]map[string]string, len(items))
		for i, u := range items {
			rows[i] = map[string]string{
				"ID":   fmt.Sprintf("%d", u.ID),
				"姓名":   u.RealName,
				"编码":   orDash(u.Code),
				"更新时间": formatTimestamp(u.UpdatedAt),
			}
		}
		printer.PrintTable([]string{"ID", "姓名", "编码", "更新时间"}, rows)
		fmt.Printf("\n共 %d 条记录\n", total)
		return nil
	},
}

// usersGetCmd shows one user including profile and collections.
var usersGetCmd = &cobra.Command{
	Use:   "get <id>",
	Short: "查看人员详情（含档案）",
	Long: `按 ID 查看人员：基本信息、属性档案（profile）与所属名录。

--collection-id 扩大档案解析范围为「全局 ∪ 该名录」（名录专属属性可见）。

示例:
  registry users get 4
  registry users get 4 --collection-id 1`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		id, err := parseID(args[0])
		if err != nil {
			return err
		}
		q := url.Values{}
		if flagGetCollectionID > 0 {
			q.Set("collectionId", fmt.Sprintf("%d", flagGetCollectionID))
		}
		var dto userDto
		path := fmt.Sprintf("%s/%d", usersPath, id)
		if err := apiClient.Get(commandContext(cmd), path, q, &dto); err != nil {
			return err
		}
		renderUserDetail(dto)
		return nil
	},
}

// usersCreateCmd creates a user.
var usersCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "创建人员",
	Long: `创建一条人员记录。

  --real-name/-n   姓名（必填）
  --code           编码如身份证号（可省略；传空字符串表示显式无编码）
  --collection-id  初始所属名录（可选）
  --profile        初始档案 JSON，key 为属性业务 key（可选）

示例:
  registry users create -n 张三 --collection-id 1 \
    --profile '{"gender":"男"}'`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if flagUserRealName == "" {
			return fmt.Errorf("必须通过 --real-name/-n 指定姓名")
		}
		body := map[string]any{"realName": flagUserRealName}
		// Use the cmd parameter (not the package var): a package-level var
		// whose initializer closure reads the var is an initialization cycle.
		if cmd.Flags().Changed("code") {
			body["code"] = nullableString(flagUserCode)
		}
		if flagUserCollectionID > 0 {
			body["collectionId"] = flagUserCollectionID
		}
		profiles, err := parseJSONObject(flagUserProfile, "--profile")
		if err != nil {
			return err
		}
		if profiles != nil {
			body["profiles"] = profiles
		}

		var dto userDto
		if err := apiClient.Post(commandContext(cmd), usersPath, body, &dto); err != nil {
			return err
		}
		printCreateResult("人员已创建", dto,
			fmt.Sprintf("人员「%s」已创建 (ID %d)", dto.RealName, dto.ID),
			map[string]string{"ID": fmt.Sprintf("%d", dto.ID), "姓名": dto.RealName})
		return nil
	},
}

// usersUpdateCmd updates realName/code of a user.
var usersUpdateCmd = &cobra.Command{
	Use:   "update <id>",
	Short: "更新人员基本信息",
	Long: `更新人员的姓名或编码（至少提供一个字段）。

--code 传空字符串表示清除编码。`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		id, err := parseID(args[0])
		if err != nil {
			return err
		}
		nameChanged := cmd.Flags().Changed("real-name")
		codeChanged := cmd.Flags().Changed("code")
		if !nameChanged && !codeChanged {
			return fmt.Errorf("至少提供 --real-name 或 --code 之一")
		}
		body := map[string]any{}
		if nameChanged {
			if flagUserRealName == "" {
				return fmt.Errorf("--real-name 不能为空字符串")
			}
			body["realName"] = flagUserRealName
		}
		if codeChanged {
			body["code"] = nullableString(flagUserCode)
		}

		var dto userDto
		path := fmt.Sprintf("%s/%d", usersPath, id)
		if err := apiClient.Patch(commandContext(cmd), path, body, &dto); err != nil {
			return err
		}
		printCreateResult("人员已更新", dto,
			fmt.Sprintf("人员「%s」已更新", dto.RealName),
			map[string]string{"ID": fmt.Sprintf("%d", dto.ID), "姓名": dto.RealName})
		return nil
	},
}

// usersProfileCmd is the profile management entry (update only; reading goes
// through users get, whose response already contains the profile).
var usersProfileCmd = &cobra.Command{
	Use:   "profile",
	Short: "人员档案管理",
	Long: `维护人员的属性档案（profile）。

查看档案请用 registry users get <id> —— 详情响应已含 profile；
本组只提供写入操作（merge-patch：只改动出现的 key，其余保持不变）。`,
}

// usersProfileUpdateCmd merge-patches a user's profile.
var usersProfileUpdateCmd = &cobra.Command{
	Use:   "update <id>",
	Short: "更新人员档案",
	Long: `以 merge-patch 方式更新人员档案：JSON 中出现的 key 被写入或覆盖，
未出现的 key 保持不变。key 解析作用域默认仅全局属性，
--collection-id 可扩大为「全局 ∪ 该名录」。

示例:
  registry users profile update 4 --profiles '{"gender":"男","age":20}'
  registry users profile update 4 --profiles '{"gender":null}' --collection-id 1`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		id, err := parseID(args[0])
		if err != nil {
			return err
		}
		profiles, err := parseJSONObject(flagUserProfile, "--profiles")
		if err != nil {
			return err
		}
		if profiles == nil {
			return fmt.Errorf("必须提供 --profiles（JSON 对象）")
		}
		body := map[string]any{"profiles": profiles}
		if flagProfileCollID > 0 {
			body["collectionId"] = flagProfileCollID
		}

		var dto userDto
		path := fmt.Sprintf("%s/%d/profile", usersPath, id)
		if err := apiClient.Patch(commandContext(cmd), path, body, &dto); err != nil {
			return err
		}
		printCreateResult("档案已更新", dto,
			fmt.Sprintf("人员「%s」的档案已更新 (%d 个字段)", dto.RealName, len(dto.Profile)),
			map[string]string{"ID": fmt.Sprintf("%d", dto.ID), "姓名": dto.RealName})
		return nil
	},
}

// usersDeleteCmd deletes a user (confirm unless --force).
var usersDeleteCmd = &cobra.Command{
	Use:   "delete <id>",
	Short: "删除人员",
	Long: `删除指定人员（软删除）。

默认交互确认；--force/-f 跳过确认（供脚本使用）。`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		id, err := parseID(args[0])
		if err != nil {
			return err
		}
		if err := confirm(fmt.Sprintf("确认删除人员 %d？", id), flagForceUsers); err != nil {
			return err
		}
		path := fmt.Sprintf("%s/%d", usersPath, id)
		if err := apiClient.Delete(commandContext(cmd), path); err != nil {
			return err
		}
		printDeleteResult("人员已删除", "id", id)
		return nil
	},
}

// renderUserDetail prints a user detail in both modes: table mode as
// key-value blocks (profile entries flattened as profile.<key> rows); JSON
// mode emits the raw DTO so AI consumers get full fidelity.
func renderUserDetail(u userDto) {
	if useJSON {
		printer.PrintSuccess("查询成功", u)
		return
	}
	kv := map[string]string{
		"ID":   fmt.Sprintf("%d", u.ID),
		"姓名":   u.RealName,
		"编码":   orDash(u.Code),
		"创建时间": formatTimestamp(u.CreatedAt),
		"更新时间": formatTimestamp(u.UpdatedAt),
	}
	colls := "-"
	for i, c := range u.Collections {
		if i == 0 {
			colls = ""
		} else {
			colls += ", "
		}
		colls += fmt.Sprintf("%s(%d)", c.Name, c.ID)
	}
	kv["所属名录"] = colls
	for k, v := range u.Profile {
		kv["profile."+k] = fmt.Sprintf("%v", v)
	}
	printer.PrintKeyValue(kv)
}

// parseKeyValueArgs parses positional args of the form key=value into a map.
func parseKeyValueArgs(args []string) (map[string]string, error) {
	filters := make(map[string]string, len(args))
	for _, a := range args {
		k, v, ok := strings.Cut(a, "=")
		if !ok || k == "" || v == "" {
			return nil, fmt.Errorf("无效的属性过滤参数 %q（格式应为 key=value）", a)
		}
		filters[k] = v
	}
	return filters, nil
}

// orDash renders a nullable field for display: "-" when unset or empty.
func orDash(v *string) string {
	if v == nil || *v == "" {
		return "-"
	}
	return *v
}

func init() {
	usersListCmd.Flags().IntVarP(&usersPage, "page", "p", 1, "页码")
	usersListCmd.Flags().IntVarP(&usersPageSize, "page-size", "", 20, "每页条数（最大 100）")
	usersListCmd.Flags().BoolVarP(&usersAll, "all", "a", false, "列出全部分页数据")
	usersListCmd.Flags().StringVarP(&flagUsersSearch, "search", "s", "", "按姓名/编码模糊搜索")
	usersListCmd.Flags().StringVar(&flagUsersHasCode, "has-code", "", "按有无编码过滤: true/false")
	usersListCmd.Flags().Int64Var(&flagUsersCollectionID, "collection-id", 0, "只列该名录成员")

	usersGetCmd.Flags().Int64Var(&flagGetCollectionID, "collection-id", 0, "扩大档案解析范围到全局∪该名录")

	usersCreateCmd.Flags().StringVarP(&flagUserRealName, "real-name", "n", "", "姓名（必填）")
	usersCreateCmd.Flags().StringVar(&flagUserCode, "code", "", "编码（如身份证号；传空字符串=显式无编码）")
	usersCreateCmd.Flags().Int64Var(&flagUserCollectionID, "collection-id", 0, "初始所属名录 ID")
	usersCreateCmd.Flags().StringVar(&flagUserProfile, "profile", "", "初始档案 JSON")

	usersUpdateCmd.Flags().StringVarP(&flagUserRealName, "real-name", "n", "", "新姓名")
	usersUpdateCmd.Flags().StringVar(&flagUserCode, "code", "", "新编码（传空字符串清除）")

	usersProfileUpdateCmd.Flags().StringVar(&flagUserProfile, "profiles", "", "档案 JSON（merge-patch，必填）")
	usersProfileUpdateCmd.Flags().Int64Var(&flagProfileCollID, "collection-id", 0, "key 解析作用域扩展到全局∪该名录")

	usersDeleteCmd.Flags().BoolVarP(&flagForceUsers, "force", "f", false, "跳过删除确认")

	usersProfileCmd.AddCommand(usersProfileUpdateCmd)

	usersCmd.AddCommand(usersListCmd)
	usersCmd.AddCommand(usersGetCmd)
	usersCmd.AddCommand(usersCreateCmd)
	usersCmd.AddCommand(usersUpdateCmd)
	usersCmd.AddCommand(usersProfileCmd)
	usersCmd.AddCommand(usersDeleteCmd)
	rootCmd.AddCommand(usersCmd)
}
