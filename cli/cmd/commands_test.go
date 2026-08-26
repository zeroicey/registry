package cmd

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/zeroicey/registry-cli/internal/client"
)

func TestFlagJSONRequestedFromData(t *testing.T) {
	d := &flagScanData{
		valueLong:  map[string]bool{"baseurl": true, "config": true, "search": true},
		valueShort: map[string]bool{"b": true, "c": true, "s": true},
		boolShort:  map[string]bool{"f": true, "j": true, "a": true},
	}
	cases := []struct {
		args []string
		want bool
	}{
		{[]string{"users", "list"}, false},
		{[]string{"--json", "users", "list"}, true},
		{[]string{"-j", "users", "list"}, true},
		{[]string{"--json=false", "users", "list"}, false},
		{[]string{"users", "-s", "--json"}, false},
		// A value-taking flag consumes the next argument: --json here is the
		// value of --search, not the global flag.
		{[]string{"users", "--search", "--json"}, false},
		{[]string{"users", "-s", "--json"}, false},
		// Attached values.
		{[]string{"users", "-s=--json"}, false},
		{[]string{"users", "-j=true"}, true},
		// JSON flag before a value-taking flag still counts.
		{[]string{"users", "list", "--json", "--search", "张"}, true},
		// Combined shorthands.
		{[]string{"users", "delete", "-fj"}, true},
		{[]string{"users", "-jf", "4"}, true},
		// Terminator: everything after -- is positional.
		{[]string{"--", "--json"}, false},
	}
	for _, c := range cases {
		if got := flagJSONRequestedFromData(c.args, d); got != c.want {
			t.Errorf("flagJSONRequestedFromData(%q) = %v, want %v", c.args, got, c.want)
		}
	}
}

func TestConfirmNonInteractiveStdinIsRefused(t *testing.T) {
	// `go test` runs with stdin on /dev/null: Fscanln hits EOF immediately and
	// confirm must treat that as refusal so scripts never mistake
	// skip-for-success.
	if err := confirm("确认删除？", false); err == nil {
		t.Error("confirm() with EOF stdin should return an error")
	}
	if err := confirm("确认删除？", true); err != nil {
		t.Errorf("confirm(force=true) = %v, want nil", err)
	}
}

func TestParseID(t *testing.T) {
	if id, err := parseID("42"); err != nil || id != 42 {
		t.Errorf("parseID(\"42\") = %d, %v", id, err)
	}
	for _, bad := range []string{"0", "-3", "abc", ""} {
		if _, err := parseID(bad); err == nil {
			t.Errorf("parseID(%q) should fail", bad)
		}
	}
}

func TestTruncateRunesKeepsUTF8Valid(t *testing.T) {
	s := "名单名册记录"
	got := truncateRunes(s, 3)
	if !strings.HasSuffix(got, "...") {
		t.Errorf("truncated string missing ellipsis: %q", got)
	}
	if got != "名单名..." {
		t.Errorf("truncateRunes = %q, want 名单名...", got)
	}
	if full := truncateRunes("短", 10); full != "短" {
		t.Errorf("short input changed: %q", full)
	}
}

func TestMaskToken(t *testing.T) {
	cases := map[string]string{
		"":             "",
		"short":        "*****",
		"abcd12345678": "abcd****5678",
	}
	for in, want := range cases {
		if got := maskToken(in); got != want {
			t.Errorf("maskToken(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestWalkAllPagesErrorsAtMaxAllPages(t *testing.T) {
	// A server that always returns a full page must trip the maxAllPages guard
	// with an explicit error — never a silently truncated exit-0 result.
	var calls int
	srv := newFullPageServer(t, &calls)
	defer srv.Close()

	apiClient = newTestClient(t, srv.URL)
	defer func() { apiClient = nil }()

	_, _, err := walkAllPages[userSummaryDto](apiClient, context.Background(), "/api/users", nil)
	if err == nil {
		t.Fatal("maxAllPages overflow should return an error")
	}
	if !strings.Contains(err.Error(), "数据量过大") {
		t.Errorf("error = %v, want 数据量过大 hint", err)
	}
}

// newFullPageServer always answers with a full page of pageSize=100 items and
// a growing total, so pagination never terminates on its own.
func newFullPageServer(t *testing.T, calls *int) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		*calls++
		const n = 100
		type item struct {
			ID int64 `json:"id"`
		}
		items := make([]item, n)
		for i := range items {
			items[i].ID = int64(i + 1)
		}
		// Wrap in the unified response envelope: client.List unwraps
		// {success, message, data:{items,total}}.
		body, _ := json.Marshal(map[string]any{
			"success": true,
			"message": "ok",
			"data":    map[string]any{"items": items, "total": 10_000_000},
		})
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(body)
	}))
}

// newTestClient builds a client against the test server.
func newTestClient(t *testing.T, baseURL string) *client.Client {
	t.Helper()
	c, err := client.NewClient(baseURL, "")
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}
	return c
}

func TestMaskTokenBoundaries(t *testing.T) {
	// Exactly 8 chars: fully masked. 9 chars: first4+1star+last4.
	if got := maskToken("12345678"); got != "********" {
		t.Errorf("maskToken(8) = %q", got)
	}
	if got := maskToken("123456789"); got != "1234*6789" {
		t.Errorf("maskToken(9) = %q, want 1234*6789", got)
	}
}

func TestRootRegistersEveryModuleOnce(t *testing.T) {
	want := map[string]bool{
		"init": false, "config": false, "health": false,
		"collections": false, "attributes": false, "users": false,
		"comments": false, "files": false, "source-files": false,
	}
	for _, sub := range rootCmd.Commands() {
		name := sub.Name()
		if _, ok := want[name]; ok {
			if want[name] {
				t.Errorf("command %q registered more than once", name)
			}
			want[name] = true
		}
	}
	for name, seen := range want {
		if !seen {
			t.Errorf("command %q not registered on root", name)
		}
	}
}
