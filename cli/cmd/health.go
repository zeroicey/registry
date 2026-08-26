package cmd

import (
	"fmt"
	"time"

	"github.com/spf13/cobra"
)

// healthData mirrors GET /api/health's data payload.
type healthData struct {
	Status    string `json:"status"`
	Database  string `json:"database"`
	Uptime    int    `json:"uptime"`
	Timestamp string `json:"timestamp"`
}

// healthCmd checks API connectivity and database availability.
var healthCmd = &cobra.Command{
	Use:   "health",
	Short: "健康检查（API 连通性自检）",
	Long: `检查 Registry API 服务是否可达、数据库是否可用。

适合作为脚本/AI 操作前的连通性预检：HTTP 非 2xx 或网络失败都会
以非零退出码结束。`,
	Args: cobra.NoArgs,
	RunE: func(cmd *cobra.Command, args []string) error {
		var data healthData
		if err := apiClient.Get(commandContext(cmd), "/api/health", nil, &data); err != nil {
			return fmt.Errorf("健康检查失败: %w", err)
		}

		if useJSON {
			printer.PrintSuccess("服务正常", data)
			return nil
		}
		printer.PrintKeyValue(map[string]string{
			"状态":    data.Status,
			"数据库":   data.Database,
			"运行时长":  fmt.Sprintf("%ds", data.Uptime),
			"服务器时间": formatTimestamp(data.Timestamp),
		})
		return nil
	},
}

// formatTimestamp shortens an ISO timestamp to seconds precision for table
// display; unparseable input passes through unchanged.
func formatTimestamp(iso string) string {
	t, err := time.Parse(time.RFC3339Nano, iso)
	if err != nil {
		return iso
	}
	return t.Format("2006-01-02 15:04:05")
}

func init() {
	rootCmd.AddCommand(healthCmd)
}
