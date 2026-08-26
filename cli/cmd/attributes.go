package cmd

import (
	"encoding/json"
	"fmt"
	"net/url"

	"github.com/spf13/cobra"
)

// attributeDto mirrors the backend AttributeDto. Config is kept as
// json.RawMessage so create passes the caller's JSON through verbatim and get
// echoes the server's config without re-encoding artifacts.
type attributeDto struct {
	ID           int64           `json:"id"`
	Key          string          `json:"key"`
	Label        string          `json:"label"`
	Type         string          `json:"type"`
	Config       json.RawMessage `json:"config"`
	CollectionID *int64          `json:"collectionId"`
	CreatedAt    string          `json:"createdAt"`
	UpdatedAt    string          `json:"updatedAt"`
}

const attributesPath = "/api/attributes"

var (
	attrPage     = 1
	attrPageSize = 20
	attrAll      bool

	// list filters
	flagAttrScope          string
	flagAttrListCollection int64

	// create / update fields
	flagAttrKey          string
	flagAttrLabel        string
	flagAttrType         string
	flagAttrConfig       string
	flagAttrCreateCollID int64 // 0 = global attribute
	flagForceAttributes  bool
)

// attributeScopeQuery validates the --scope/--collection-id pair and maps it
// into query values. Shared by list (--all walk included) so pagination and
// filters cannot drift.
func attributeScopeQuery() (func(url.Values), error) {
	switch flagAttrScope {
	case "", "all":
		return func(q url.Values) { q.Set("scope", "all") }, nil
	case "global":
		return func(q url.Values) { q.Set("scope", "global") }, nil
	case "collection":
		if flagAttrListCollection <= 0 {
			return nil, fmt.Errorf("scope=collection 时必须提供 --collection-id")
		}
		id := fmt.Sprintf("%d", flagAttrListCollection)
		return func(q url.Values) {
			q.Set("scope", "collection")
			q.Set("collectionId", id)
		}, nil
	default:
		return nil, fmt.Errorf("无效的 scope: %s（可选 all/global/collection）", flagAttrScope)
	}
}

// attributesCmd is the attributes management entry.
var attributesCmd = &cobra.Command{
	Use:     "attributes",
	Aliases: []string{"attribute", "attr"},
	Short:   "属性管理",
	Long: `管理人员属性定义（string/number/bool/date/select 五种类型）。

属性分全局共享与名录专属两种归属：创建时用 --collection-id 指定名录，
缺省为全局。有值属性的 type 变更会被后端以 ATTRIBUTE_TYPE_LOCKED 拒绝。`,
}

// attributesListCmd lists attribute definitions.
var attributesListCmd = paginatedListCommand[attributeDto](
	listSpec[attributeDto]{
		use:   "list",
		short: "列出属性定义",
		long: `分页列出属性定义。

--scope 控制范围：all=全部；global=仅全局；collection=全局 ∪ 指定名录
（后者需配合 --collection-id）。

示例:
  registry attributes list
  registry attributes list --scope global
  registry attributes list --scope collection --collection-id 1`,
		path:     attributesPath,
		emptyMsg: "(暂无属性定义)",
		headers:  []string{"ID", "Key", "名称", "类型", "归属", "更新时间"},
		row: func(a attributeDto) map[string]string {
			scope := "全局"
			if a.CollectionID != nil {
				scope = fmt.Sprintf("名录 %d", *a.CollectionID)
			}
			return map[string]string{
				"ID":   fmt.Sprintf("%d", a.ID),
				"Key":  a.Key,
				"名称":   a.Label,
				"类型":   a.Type,
				"归属":   scope,
				"更新时间": formatTimestamp(a.UpdatedAt),
			}
		},
		validate: func() error {
			_, err := attributeScopeQuery()
			return err
		},
		extraQuery: func(q url.Values) {
			if apply, err := attributeScopeQuery(); err == nil && apply != nil {
				apply(q)
			}
		},
	},
	&attrPage, &attrPageSize, &attrAll,
)

// attributesGetCmd shows one attribute definition.
var attributesGetCmd = &cobra.Command{
	Use:   "get <id>",
	Short: "查看属性定义",
	Long:  "按 ID 查看属性定义详情。\n\n示例:\n  registry attributes get 3",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		id, err := parseID(args[0])
		if err != nil {
			return err
		}
		var dto attributeDto
		path := fmt.Sprintf("%s/%d", attributesPath, id)
		if err := apiClient.Get(commandContext(cmd), path, nil, &dto); err != nil {
			return err
		}
		printer.PrintKeyValue(attributeKV(dto))
		return nil
	},
}

// attributesCreateCmd creates an attribute definition.
var attributesCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "创建属性定义",
	Long: `创建一个属性定义。--config 接收 JSON 对象字符串，透传给后端校验：
  select 类型必须提供 options；
  string 类型可用 min/max（长度）、regex（ECMA 正则）；
  number 类型可用 min/max（数值边界）；均可加 sortOrder/help/default。

示例:
  registry attributes create -k gender -l "性别" -t select \
    --config '{"options":["男","女"]}'
  registry attributes create -k phone -l "联系电话" -t string \
    --config '{"regex":"^1[0-9]{10}$"}'`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if flagAttrKey == "" || flagAttrLabel == "" || flagAttrType == "" {
			return fmt.Errorf("必须提供 --key/-k、--label/-l、--type/-t")
		}
		body := map[string]any{
			"key":   flagAttrKey,
			"label": flagAttrLabel,
			"type":  flagAttrType,
		}
		cfg, err := parseJSONObject(flagAttrConfig, "--config")
		if err != nil {
			return err
		}
		if cfg != nil {
			body["config"] = cfg
		} else {
			body["config"] = map[string]any{}
		}
		if flagAttrCreateCollID > 0 {
			body["collectionId"] = flagAttrCreateCollID
		}

		var dto attributeDto
		if err := apiClient.Post(commandContext(cmd), attributesPath, body, &dto); err != nil {
			return err
		}
		printCreateResult("属性已创建", dto, fmt.Sprintf("属性「%s」已创建 (ID %d)", dto.Label, dto.ID),
			attributeKV(dto))
		return nil
	},
}

// attributesUpdateCmd updates label/type/config of an attribute.
var attributesUpdateCmd = &cobra.Command{
	Use:   "update <id>",
	Short: "更新属性定义",
	Long: `更新属性定义的 label / type / config（至少提供一个字段）。

注意：属性已有值时变更 type 会被后端拒绝（ATTRIBUTE_TYPE_LOCKED）。

示例:
  registry attributes update 3 --config '{"options":["男","女","其他"]}'`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		id, err := parseID(args[0])
		if err != nil {
			return err
		}
		// Use the cmd parameter (not the package var) so the initializer does
		// not reference itself — a package-level var whose closure reads the
		// var is an initialization cycle in Go.
		labelChanged := cmd.Flags().Changed("label")
		typeChanged := cmd.Flags().Changed("type")
		configChanged := cmd.Flags().Changed("config")
		if !labelChanged && !typeChanged && !configChanged {
			return fmt.Errorf("至少提供 --label、--type 或 --config 之一")
		}
		body := map[string]any{}
		if labelChanged {
			body["label"] = flagAttrLabel
		}
		if typeChanged {
			body["type"] = flagAttrType
		}
		if configChanged {
			cfg, err := parseJSONObject(flagAttrConfig, "--config")
			if err != nil {
				return err
			}
			if cfg == nil {
				return fmt.Errorf("--config 需要一个 JSON 对象，例如 '{\"help\":\"...\"}'")
			}
			body["config"] = cfg
		}

		var dto attributeDto
		path := fmt.Sprintf("%s/%d", attributesPath, id)
		if err := apiClient.Patch(commandContext(cmd), path, body, &dto); err != nil {
			return err
		}
		printCreateResult("属性已更新", dto, fmt.Sprintf("属性「%s」已更新", dto.Label),
			attributeKV(dto))
		return nil
	},
}

// attributesDeleteCmd deletes an attribute definition (confirm unless --force).
var attributesDeleteCmd = &cobra.Command{
	Use:   "delete <id>",
	Short: "删除属性定义",
	Long: `删除指定属性定义及其全部属性值。

默认交互确认；--force/-f 跳过确认（供脚本使用）。`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		id, err := parseID(args[0])
		if err != nil {
			return err
		}
		if err := confirm(fmt.Sprintf("确认删除属性 %d？其全部属性值将一并删除", id), flagForceAttributes); err != nil {
			return err
		}
		path := fmt.Sprintf("%s/%d", attributesPath, id)
		if err := apiClient.Delete(commandContext(cmd), path); err != nil {
			return err
		}
		printDeleteResult("属性已删除", "id", id)
		return nil
	},
}

// attributeKV renders one attribute as display key-value pairs.
func attributeKV(a attributeDto) map[string]string {
	scope := "全局"
	if a.CollectionID != nil {
		scope = fmt.Sprintf("名录 %d", *a.CollectionID)
	}
	config := string(a.Config)
	if config == "" || config == "null" {
		config = "{}"
	}
	return map[string]string{
		"ID":   fmt.Sprintf("%d", a.ID),
		"Key":  a.Key,
		"名称":   a.Label,
		"类型":   a.Type,
		"归属":   scope,
		"配置":   truncateRunes(config, 80),
		"更新时间": formatTimestamp(a.UpdatedAt),
	}
}

// parseJSONObject parses a JSON object from a CLI flag value. Empty input
// yields nil (field omitted); anything that is not a JSON object is an error.
func parseJSONObject(raw, flagName string) (map[string]any, error) {
	if raw == "" {
		return nil, nil
	}
	var m map[string]any
	if err := json.Unmarshal([]byte(raw), &m); err != nil {
		return nil, fmt.Errorf("%s 不是合法的 JSON 对象: %w", flagName, err)
	}
	return m, nil
}

func init() {
	attributesListCmd.Flags().IntVarP(&attrPage, "page", "p", 1, "页码")
	attributesListCmd.Flags().IntVarP(&attrPageSize, "page-size", "", 20, "每页条数（最大 100）")
	attributesListCmd.Flags().BoolVarP(&attrAll, "all", "a", false, "列出全部分页数据")
	attributesListCmd.Flags().StringVarP(&flagAttrScope, "scope", "s", "all", "范围: all/global/collection")
	attributesListCmd.Flags().Int64VarP(&flagAttrListCollection, "collection-id", "", 0, "名录 ID（scope=collection 时必填）")

	attributesCreateCmd.Flags().StringVarP(&flagAttrKey, "key", "k", "", "业务 key（小写字母开头，仅小写字母/数字/下划线）")
	attributesCreateCmd.Flags().StringVarP(&flagAttrLabel, "label", "l", "", "显示名称")
	attributesCreateCmd.Flags().StringVar(&flagAttrType, "type", "", "类型: string/number/bool/date/select")
	attributesCreateCmd.Flags().StringVar(&flagAttrConfig, "config", "", "配置 JSON，如 '{\"options\":[\"男\",\"女\"]}'")
	attributesCreateCmd.Flags().Int64Var(&flagAttrCreateCollID, "collection-id", 0, "归属名录 ID（缺省为全局属性）")

	attributesUpdateCmd.Flags().StringVarP(&flagAttrLabel, "label", "l", "", "新的显示名称")
	attributesUpdateCmd.Flags().StringVar(&flagAttrType, "type", "", "新类型: string/number/bool/date/select")
	attributesUpdateCmd.Flags().StringVar(&flagAttrConfig, "config", "", "新的配置 JSON（整体替换）")

	attributesDeleteCmd.Flags().BoolVarP(&flagForceAttributes, "force", "f", false, "跳过删除确认")

	attributesCmd.AddCommand(attributesListCmd)
	attributesCmd.AddCommand(attributesGetCmd)
	attributesCmd.AddCommand(attributesCreateCmd)
	attributesCmd.AddCommand(attributesUpdateCmd)
	attributesCmd.AddCommand(attributesDeleteCmd)
	rootCmd.AddCommand(attributesCmd)
}
