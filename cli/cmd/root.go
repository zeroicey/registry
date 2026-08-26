// Package cmd contains all CLI commands for the Registry CLI tool.
//
// Global flags (--baseurl, --token, --json, --config) are registered on the
// root command and inherited by all subcommands. The effective config and
// client are resolved in the PersistentPreRunE hook.
package cmd

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	"github.com/zeroicey/registry-cli/internal/client"
	"github.com/zeroicey/registry-cli/internal/config"
	"github.com/zeroicey/registry-cli/internal/output"
)

// Shared state set by the root command's PersistentPreRunE.
var (
	apiClient *client.Client
	printer   output.Printer
	useJSON   bool
)

// flag overrides
var (
	flagBaseURL string
	flagToken   string
	flagConfig  string
)

// SetVersion wires the ldflags-injected build metadata into the root command
// so `registry --version` reports it. Called from main before Execute. main
// (main.go) is the SINGLE canonical source of these values — the Makefile's
// ldflags target main.version / main.commit / main.date — so the cmd package
// declares no copies of its own; empty values fall back to dev defaults here.
func SetVersion(v, c, d string) {
	if v == "" {
		v = "dev"
	}
	if c == "" {
		c = "unknown"
	}

	display := v
	if c != "" && c != "unknown" {
		display = fmt.Sprintf("%s (commit %s)", display, c)
	}
	if d != "" {
		display = fmt.Sprintf("%s, built %s", display, d)
	}
	rootCmd.Version = display
}

// rootCmd is the base command.
var rootCmd = &cobra.Command{
	Use:   "registry",
	Short: "Registry CLI — 人员信息登记系统命令行工具",
	Long: `Registry CLI 是一个命令行工具，用于与 Registry API 服务交互。

通过该工具，你可以：
  - 管理名录（collections）与属性（attributes）
  - 管理人员（users）及其档案（profile）、留言（comments）
  - 上传人员附件（files）与数据源文件（source-files）

专为 AI 与脚本设计：加 --json 后每个命令在 stdout 输出单个合法 JSON 文档，
错误、进度与确认提示一律走 stderr，失败时退出码非 0。

使用 "registry [command] --help" 查看各命令的详细用法。`,
	// Errors are rendered exactly once by Execute() (via the printer, or a
	// plain-text fallback for errors that occur before the printer exists), so
	// cobra must not print its own "Error:" line on top.
	SilenceUsage:  true,
	SilenceErrors: true,
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		// Honor --config/-c before loading config. This runs for every command
		// (including init) so `registry init --config ...` writes to the target.
		if flagConfig != "" {
			config.SetPath(flagConfig)
		}

		// The printer is set up before anything that can fail so every error
		// path (including a config load failure below) renders consistently.
		// useJSON was already pre-scanned in Execute() (see flagJSONRequested),
		// so this assignment is safe even for early-failure paths.
		printer = output.NewPrinter(useJSON)

		// init creates the config itself — skip loading for it.
		if cmd.Name() == "init" {
			return nil
		}

		// Load config
		cfg, err := config.Load()
		if err != nil {
			return err
		}

		// Local-only commands (config management, bare root help) never touch the
		// network, so they must not require a usable client. Building it here
		// would fail fast on a malformed configured baseurl and lock out the very
		// commands that repair it — `registry config set baseurl <good>` is the
		// documented repair path for a bad value written by init or a stale env
		// var.
		if isLocalOnlyCommand(cmd) {
			return nil
		}

		// Resolve effective config (flags > env > file) and build the client
		// directly from the result — no intermediate global. NewClient validates
		// the resolved base URL so a config typo surfaces here with an actionable
		// message instead of a cryptic request-time error.
		resolved := cfg.Resolve(flagBaseURL, flagToken)
		if apiClient, err = client.NewClient(resolved.BaseURL, resolved.Token); err != nil {
			return err
		}

		return nil
	},
	Run: func(cmd *cobra.Command, args []string) {
		if useJSON {
			// Bare root under --json must still honor the single-JSON-document
			// stdout contract; human help goes to the pager only in table mode.
			printer.PrintMessage("请指定子命令；使用 registry --help 查看完整帮助（table 模式）")
			return
		}
		cmd.Help()
	},
}

// isLocalOnlyCommand reports whether cmd performs no network access: the config
// management subtree (config, config set, config get, config path) and the bare
// root help. These must not require a usable API client — otherwise a malformed
// configured baseurl would prevent `registry config set baseurl <good>` (the
// repair command for exactly that condition) from running at all.
func isLocalOnlyCommand(cmd *cobra.Command) bool {
	if cmd == nil {
		return false
	}
	path := cmd.CommandPath()
	if path == "registry" {
		return true
	}
	return strings.HasPrefix(path, "registry config")
}

// Execute runs the root command and owns error rendering: the returned error is
// printed exactly once (via the printer when available, so --json mode gets a
// structured error object on stderr; plain-text otherwise). Command handlers
// must not print errors themselves; the sole exception is a batch command that
// returns a *renderedError to signal failure without re-rendering the already
// printed per-file messages.
//
// Cobra validates args and required flags before PersistentPreRunE runs, so
// errors like `users get` with a missing id occur before the printer is
// constructed. To keep --json mode a reliable contract for AI/scripts, --json/-j
// is detected from os.Args up front (flagJSONRequested below) and such early
// errors fall back to a JSON error object on stderr instead of a plain-text
// line.
func Execute() {
	// Derive the root context from OS signals so an interrupt (Ctrl-C) cancels
	// the in-flight request and lets deferred cleanup run. Commands use
	// commandContext(cmd) so transfers are never bound to an uncancellable
	// context.Background().
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)

	jsonRequested := flagJSONRequested()
	if jsonRequested {
		useJSON = true
	}

	err := rootCmd.ExecuteContext(ctx)
	if err == nil {
		stop()
		return
	}
	renderExecutionError(err, jsonRequested)
	stop()
	os.Exit(1)
}

// renderExecutionError prints a command error exactly once. A *renderedError
// (already printed inline by a batch command) is silenced — the exit code alone
// signals failure. Otherwise the error goes through the printer, or falls back
// to a JSON object on stderr in --json mode, or a plain-text line.
func renderExecutionError(err error, jsonRequested bool) {
	var rendered *renderedError
	if errors.As(err, &rendered) {
		return
	}
	if printer != nil {
		printer.PrintError(err.Error())
	} else if jsonRequested {
		// Pre-printer JSON fallback: mirror the JSONPrinter's error shape but
		// write to os.Stderr directly — this branch runs before any printer
		// exists. MarshalIndent with a single-key map yields the identical
		// {"error": ...} document.
		b, _ := json.MarshalIndent(map[string]string{"error": err.Error()}, "", "  ")
		fmt.Fprintln(os.Stderr, string(b))
	} else {
		fmt.Fprintf(os.Stderr, "✗ 错误: %s\n", err.Error())
	}
}

// flagJSONRequested reports whether --json or -j (with or without an explicit
// =true/=false value) appears on the command line as an actual flag, without
// requiring cobra to have parsed flags yet (Execute runs before flag parsing).
//
// The scan mirrors pflag's arity rules so it neither reports a false positive
// (a literal "--json" consumed as the value of a preceding flag, e.g. `users
// create -m --json`) nor misses a false negative (combined boolean shorthands
// like `users delete -fj`). Values are parsed with strconv.ParseBool to mirror
// pflag's accepted boolean spellings (1, t, true, 0, f, false...). An
// unparseable value is treated as JSON-requested: cobra will reject it with an
// error, and rendering that error as JSON matches the user's intent. Scanning
// stops at a "--" terminator (everything after it is positional).
func flagJSONRequested() bool {
	return flagJSONRequestedFrom(os.Args[1:])
}

// flagScanData records which registered long and short flags consume the
// following argument, so the pre-scan knows `-m --json` treats --json as a
// value. A flag takes a value when its pflag NoOptDefVal is empty (string/int
// flags); boolean flags set NoOptDefVal to "true" and never consume the next
// argument. The sets are built from the command tree (all init()s have already
// registered every flag by the time Execute runs).
type flagScanData struct {
	valueLong  map[string]bool
	valueShort map[string]bool
	boolShort  map[string]bool
}

func buildFlagScanData() *flagScanData {
	d := &flagScanData{
		valueLong:  map[string]bool{},
		valueShort: map[string]bool{},
		boolShort:  map[string]bool{},
	}
	record := func(f *pflag.Flag) {
		takesValue := f.NoOptDefVal == ""
		d.valueLong[f.Name] = takesValue
		if f.Shorthand != "" {
			if takesValue {
				d.valueShort[f.Shorthand] = true
			} else {
				d.boolShort[f.Shorthand] = true
			}
		}
	}
	var visit func(c *cobra.Command)
	visit = func(c *cobra.Command) {
		c.Flags().VisitAll(record)
		c.PersistentFlags().VisitAll(record)
		for _, sub := range c.Commands() {
			visit(sub)
		}
	}
	visit(rootCmd)
	return d
}

// flagJSONRequestedFrom is the pure argument scan used by flagJSONRequested;
// extracted for testability.
func flagJSONRequestedFrom(args []string) bool {
	return flagJSONRequestedFromData(args, buildFlagScanData())
}

// flagJSONRequestedFromData scans args given known flag arities. It is the pure
// core of flagJSONRequestedFrom, factored out so tests can exercise the scanner
// without depending on the registered command tree.
func flagJSONRequestedFromData(args []string, d *flagScanData) bool {
	jsonValue := false
	for i := 0; i < len(args); i++ {
		a := args[i]
		switch {
		case a == "--":
			// Everything after the terminator is positional, never a flag.
			return jsonValue
		case strings.HasPrefix(a, "--"):
			name, val, hasVal := strings.Cut(a[2:], "=")
			if name == "json" {
				jsonValue = true
				if hasVal {
					if v, err := strconv.ParseBool(val); err == nil {
						jsonValue = v
					}
				}
				continue
			}
			// A value-taking long flag consumes the next argument (unless the
			// value was attached with =).
			if !hasVal && d.valueLong[name] {
				i++
			}
		case len(a) > 1 && a[0] == '-':
			body := a[1:]
			// Short flag with attached value: -j=true or -m=value.
			if eq := strings.IndexByte(body, '='); eq >= 0 {
				if body[:eq] == "j" {
					jsonValue = true
					if v, err := strconv.ParseBool(body[eq+1:]); err == nil {
						jsonValue = v
					}
				}
				continue
			}
			// Combined shorthand group: -fj (force+json), -jf, -mvalue, -mj.
			for pos := 0; pos < len(body); pos++ {
				ch := string(body[pos])
				if ch == "j" {
					jsonValue = true
					continue
				}
				if d.boolShort[ch] {
					continue
				}
				// First value-taking (or unknown) shorthand: the rest of the body
				// is its value (-mvalue), or the next argument is (-m value).
				if d.valueShort[ch] && pos == len(body)-1 {
					i++
				}
				break
			}
		}
	}
	return jsonValue
}

func init() {
	rootCmd.PersistentFlags().StringVarP(&flagBaseURL, "baseurl", "b", "", "API 服务地址（覆盖配置文件）")
	rootCmd.PersistentFlags().StringVarP(&flagToken, "token", "t", "", "API 令牌（覆盖配置文件，预留）")
	rootCmd.PersistentFlags().BoolVarP(&useJSON, "json", "j", false, "以 JSON 格式输出（供 AI 和脚本使用）")
	rootCmd.PersistentFlags().StringVarP(&flagConfig, "config", "c", "", "配置文件路径（默认 ~/.registry/config.yaml）")

	// Subcommands self-register: every cmd/<module>.go init() adds its own
	// command tree to rootCmd (the documented "new module in three steps"
	// pattern). Do NOT re-register them here — double AddCommand makes each
	// command appear twice in help.
}
