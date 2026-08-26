package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
	"github.com/zeroicey/registry-cli/internal/client"
	"github.com/zeroicey/registry-cli/internal/config"
)

// configCmd represents the registry config command (bare form shows config info).
var configCmd = &cobra.Command{
	Use:   "config",
	Short: "管理 CLI 配置",
	Long:  "查看或修改 Registry CLI 的配置文件 (~/.registry/config.yaml)。",
	Args:  cobra.NoArgs,
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Load()
		if err != nil {
			return err
		}

		configPath, err := config.Path()
		if err != nil {
			return err
		}
		if useJSON {
			// Never echo the raw token to stdout (captured/logged by AI/scripts);
			// mirror the masking used in table mode.
			printer.PrintSuccess("配置信息", map[string]any{
				"configPath": configPath,
				"baseurl":    cfg.BaseURL,
				"token":      maskToken(cfg.Token),
			})
			return nil
		}

		printer.PrintMessage(fmt.Sprintf("配置文件: %s", configPath))
		printer.PrintMessage("")
		kv := map[string]string{"baseurl": cfg.BaseURL}
		if cfg.Token != "" {
			kv["token"] = maskToken(cfg.Token)
		} else {
			kv["token"] = "(未设置)"
		}
		printer.PrintKeyValue(kv)

		return nil
	},
}

// configSetCmd represents the registry config set command.
var configSetCmd = &cobra.Command{
	Use:   "set <key> <value>",
	Short: "修改配置项",
	Long: `修改配置文件中的指定配置项。

支持的 key:
  baseurl  - API 服务地址
  token    - API 令牌（预留，后端加鉴权后启用）

示例:
  registry config set baseurl http://localhost:3000`,
	Args: cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		key := args[0]
		value := args[1]

		cfg, err := config.Load()
		if err != nil {
			return err
		}

		switch key {
		case "baseurl":
			// Fail fast on a malformed base URL when it is written, so a config
			// typo never surfaces later as a cryptic request-time network error.
			if err := client.ValidateBaseURL(value); err != nil {
				return err
			}
			cfg.BaseURL = value
		case "token":
			cfg.Token = value
		default:
			return fmt.Errorf("未知的配置项: %s（支持的配置项: baseurl, token）", key)
		}

		if err := config.Save(cfg); err != nil {
			return err
		}

		if useJSON {
			// Mask the echoed value when it is a secret so --json output (captured
			// and logged by AI/scripts) never contains the raw token.
			echoValue := value
			if key == "token" {
				echoValue = maskToken(value)
			}
			printer.PrintSuccess("配置已更新", map[string]any{"key": key, "value": echoValue})
			return nil
		}

		printer.PrintMessage("✓ " + key + " 已更新")
		return nil
	},
}

// configGetCmd represents the registry config get command.
var configGetCmd = &cobra.Command{
	Use:   "get <key>",
	Short: "查看单个配置项",
	Long: `查看指定配置项的当前值。

支持的 key: baseurl, token（token 输出打码）`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		key := args[0]

		cfg, err := config.Load()
		if err != nil {
			return err
		}

		var value string
		switch key {
		case "baseurl":
			value = cfg.BaseURL
		case "token":
			value = cfg.Token
		default:
			return fmt.Errorf("未知的配置项: %s（支持的配置项: baseurl, token）", key)
		}

		display := value
		if key == "token" {
			if display == "" {
				display = "(未设置)"
			} else {
				display = maskToken(display)
			}
		}
		if useJSON {
			printer.PrintKeyValue(map[string]string{key: display})
			return nil
		}
		printer.PrintMessage(fmt.Sprintf("%s: %s", key, display))
		return nil
	},
}

// configPathCmd represents the registry config path command.
var configPathCmd = &cobra.Command{
	Use:   "path",
	Short: "显示配置文件路径",
	Long:  "显示 Registry CLI 配置文件的完整路径。",
	Args:  cobra.NoArgs,
	RunE: func(cmd *cobra.Command, args []string) error {
		configPath, err := config.Path()
		if err != nil {
			return err
		}
		if useJSON {
			printer.PrintSuccess("配置文件路径", map[string]any{"configPath": configPath})
			return nil
		}
		printer.PrintMessage(configPath)
		return nil
	},
}

func init() {
	configCmd.AddCommand(configSetCmd)
	configCmd.AddCommand(configGetCmd)
	configCmd.AddCommand(configPathCmd)
	rootCmd.AddCommand(configCmd)
}
