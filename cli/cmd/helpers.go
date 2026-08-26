package cmd

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/spf13/cobra"
	"github.com/zeroicey/registry-cli/internal/client"
)

// commandContext returns the context attached to a cobra command, which the root
// command derives from os signals (see Execute) so an interrupt cancels
// in-flight requests. When the command was not run through ExecuteContext (unit
// tests invoking RunE directly), cobra leaves the context nil; fall back to
// context.Background() so those callers keep working.
func commandContext(cmd *cobra.Command) context.Context {
	if ctx := cmd.Context(); ctx != nil {
		return ctx
	}
	return context.Background()
}

// confirm asks the user to confirm a destructive action.
//
// The prompt is written to stderr — never stdout — so stdout stays a clean
// channel for the actual result (and a single parseable JSON document in
// --json mode). It returns nil when confirmed or when force is true; otherwise
// it returns an error so the command exits non-zero. A missing or declined
// confirmation is therefore never mistaken for success by scripts and CI:
// reading from a non-interactive stdin (pipe, CI, AI agent) hits EOF
// immediately, which is treated as "not confirmed".
func confirm(prompt string, force bool) error {
	if force {
		return nil
	}
	fmt.Fprintf(os.Stderr, "%s (y/N): ", prompt)
	var resp string
	if _, err := fmt.Fscanln(os.Stdin, &resp); err != nil {
		// EOF or read error — there is no confirmation.
		return errors.New("操作已取消")
	}
	switch strings.ToLower(resp) {
	case "y", "yes":
		return nil
	}
	return errors.New("操作已取消")
}

// truncateRunes truncates s to at most n runes, appending "..." when it was
// cut. Truncating by rune count (not byte offset) guarantees a multi-byte UTF-8
// character is never split mid-rune, which would otherwise emit invalid UTF-8
// for CJK names and comments.
func truncateRunes(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n]) + "..."
}

// renderedError marks an error whose message the command already printed
// inline (e.g. per-file failures in a batch upload). Execute() still exits
// non-zero — the batch did fail — but does not render the message a second
// time, preserving the "errors render exactly once" contract.
type renderedError struct {
	message string
}

func (e *renderedError) Error() string { return e.message }

// printDeleteResult renders a destructive-action success. Table mode keeps the
// "✓ " prefix; JSON mode emits the same {message, data} envelope as create/get
// so AI/script consumers do not have to special-case deletes.
func printDeleteResult(message, idKey string, id any) {
	if useJSON {
		printer.PrintSuccess(message, map[string]any{idKey: id})
		return
	}
	printer.PrintMessage("✓ " + message)
}

// validatePageParams rejects out-of-range list pagination up front with an
// actionable Chinese message, instead of letting the server return a generic
// validation error (the API enforces page>=1 and pageSize<=100).
func validatePageParams(page, pageSize int) error {
	if page < 1 {
		return fmt.Errorf("页码必须大于等于 1")
	}
	if pageSize < 1 {
		return fmt.Errorf("每页条数必须大于等于 1")
	}
	if pageSize > 100 {
		return fmt.Errorf("每页条数不能超过 100")
	}
	return nil
}

// printCreateResult renders a create-style success in both modes: JSON mode
// emits the {message, data} envelope; table mode prints a ✓ line, a blank line,
// and the key-value detail block. Shared by create/update commands so their
// success tails cannot drift apart.
func printCreateResult(jsonMessage string, jsonData any, tableMessage string, kv map[string]string) {
	if useJSON {
		printer.PrintSuccess(jsonMessage, jsonData)
		return
	}
	printer.PrintSuccess(tableMessage, nil)
	fmt.Println()
	printer.PrintKeyValue(kv)
}

// listSpec parameterizes the shared paginated-list command. T is the API entry
// type; row maps one entry to its table row.
type listSpec[T any] struct {
	use   string
	short string
	long  string
	path  string

	emptyMsg string
	headers  []string
	row      func(T) map[string]string

	// extraQuery mutates the query values beyond page/pageSize (e.g. search).
	extraQuery func(q url.Values)

	// validate runs before any request is issued so module-specific flag
	// combinations (e.g. scope=collection requires --collection-id) fail fast
	// with an actionable message instead of a round-trip.
	validate func() error
}

// paginatedListCommand builds a "list" subcommand that fetches {items, total},
// renders a table with a "共 N 条记录" footer in table mode, and the same
// {items, total} envelope in JSON mode. page/pageSize are bound to the provided
// vars so each module keeps its own flag state; allVar backs a --all flag that
// walks every page so scripts and AI agents get the full dataset in one call.
// A page past the end (total>0 but no items) prints an explicit "本页无数据"
// message instead of an empty "(无数据)" table followed by the total footer.
func paginatedListCommand[T any](spec listSpec[T], pageVar, sizeVar *int, allVar *bool) *cobra.Command {
	return &cobra.Command{
		Use:   spec.use,
		Short: spec.short,
		Long:  spec.long,
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			ctx := commandContext(cmd)

			var items []T
			var total int
			var err error
			if spec.validate != nil {
				if err = spec.validate(); err != nil {
					return err
				}
			}
			if allVar != nil && *allVar {
				// --all overrides page/pageSize entirely.
				items, total, err = walkAllPages[T](apiClient, ctx, spec.path, spec.extraQuery)
			} else {
				if err = validatePageParams(*pageVar, *sizeVar); err != nil {
					return err
				}
				query := url.Values{}
				query.Set("page", strconv.Itoa(*pageVar))
				query.Set("pageSize", strconv.Itoa(*sizeVar))
				if spec.extraQuery != nil {
					spec.extraQuery(query)
				}
				items, total, err = client.List[T](apiClient, ctx, spec.path, query)
			}
			if err != nil {
				return err
			}

			if useJSON {
				printer.PrintSuccess("查询成功", map[string]any{"items": items, "total": total})
				return nil
			}

			if total == 0 {
				printer.PrintMessage(spec.emptyMsg)
				return nil
			}
			if len(items) == 0 {
				printer.PrintMessage(fmt.Sprintf("本页无数据，共 %d 条记录", total))
				return nil
			}

			rows := make([]map[string]string, len(items))
			for i, it := range items {
				rows[i] = spec.row(it)
			}
			printer.PrintTable(spec.headers, rows)
			fmt.Printf("\n共 %d 条记录\n", total)
			return nil
		},
	}
}

// nullableString converts a CLI string flag value to the backend's nullable
// JSON shape: an empty string becomes JSON null (clears the field), anything
// else passes through.
func nullableString(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// maxAllPages bounds --all pagination so a misbehaving server that keeps
// returning full pages (or an unbounded dataset) cannot make the loop run
// forever. At pageSize 100 this allows up to 1,000,000 records.
const maxAllPages = 10000

// walkAllPages walks every page of a paginated list endpoint at the API's
// maximum page size (100) and returns the combined result. baseQuery adds
// module-specific filters to every page request. Reaching maxAllPages is an
// explicit error — a silently truncated "full" listing must never exit 0.
func walkAllPages[T any](c *client.Client, ctx context.Context, path string, baseQuery func(q url.Values)) ([]T, int, error) {
	const pageSize = 100 // every list endpoint caps pageSize at 100

	var items []T
	total := 0
	for page := 1; ; page++ {
		q := urlValuesFor(page, pageSize)
		if baseQuery != nil {
			baseQuery(q)
		}
		pageItems, pageTotal, err := client.List[T](c, ctx, path, q)
		if err != nil {
			return nil, 0, err
		}
		total = pageTotal
		items = append(items, pageItems...)

		if len(pageItems) < pageSize || len(items) >= total {
			break
		}
		if page >= maxAllPages {
			return nil, 0, fmt.Errorf("数据量过大：已超过 %d 页（每页 %d 条），请改用分页查询", maxAllPages, pageSize)
		}
	}
	return items, total, nil
}

// fetchAll 已并入 walkAllPages：共享列表命令与各模块自定义 --all 循环
// 统一走同一个翻页器，保证 maxAllPages 溢出行为一致（显式报错而非静默截断）。

// parseID parses a positive-integer resource ID from a positional argument.
// Registry IDs are JS numbers coerced by z.coerce.number().int().positive(),
// so int64 covers the whole domain; anything else fails fast with an
// actionable Chinese message.
func parseID(s string) (int64, error) {
	id, err := strconv.ParseInt(s, 10, 64)
	if err != nil || id <= 0 {
		return 0, fmt.Errorf("无效的 ID: %q（必须是正整数）", s)
	}
	return id, nil
}

// urlValuesFor builds the page/pageSize query values shared by custom
// pagination walks.
func urlValuesFor(page, pageSize int) url.Values {
	q := url.Values{}
	q.Set("page", strconv.Itoa(page))
	q.Set("pageSize", strconv.Itoa(pageSize))
	return q
}

// fetchComments fetches one page of a user's comments via the generic list
// envelope.
func fetchComments(ctx context.Context, path string, q url.Values) ([]commentDto, int, error) {
	return client.List[commentDto](apiClient, ctx, path, q)
}
