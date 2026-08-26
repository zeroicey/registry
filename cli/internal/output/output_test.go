package output

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
)

func TestDisplayWidthCJK(t *testing.T) {
	cases := map[string]int{
		"abc":    3,
		"名单":     4, // 2 CJK chars = 2 columns each
		"ID":     2,
		"姓名Name": 8, // 姓名(2×2) + Name(1×4)
	}
	for s, want := range cases {
		if got := displayWidth(s); got != want {
			t.Errorf("displayWidth(%q) = %d, want %d", s, got, want)
		}
	}
}

// withStreams swaps the package-level output streams for the duration of a test.
func withStreams(t *testing.T) (*bytes.Buffer, *bytes.Buffer) {
	t.Helper()
	var outBuf, errBuf bytes.Buffer
	stdout, stderr = &outBuf, &errBuf
	t.Cleanup(func() { stdout, stderr = nil, nil })
	return &outBuf, &errBuf
}

func TestTablePrinterAlignsCJKColumns(t *testing.T) {
	out, _ := withStreams(t)

	p := NewPrinter(false)
	p.PrintTable([]string{"ID", "名称"}, []map[string]string{
		{"ID": "1", "名称": "名单A"},
		{"ID": "12", "名称": "B"},
	})

	lines := strings.Split(strings.TrimRight(out.String(), "\n"), "\n")
	if len(lines) != 4 {
		t.Fatalf("got %d lines, want 4: %q", len(lines), out.String())
	}
	// Every fully-padded line (header, separator, body) must share the same
	// display width — CJK-aware alignment: tabwriter-style byte padding would
	// misalign these.
	widths := make([]int, len(lines))
	for i, l := range lines {
		widths[i] = displayWidth(l)
	}
	for i := 1; i < len(widths); i++ {
		if widths[i] != widths[0] {
			t.Errorf("line %d display width %d != header width %d\nlines=%q", i, widths[i], widths[0], lines)
		}
	}
}

func TestJSONPrinterSingleDocumentOnStdout(t *testing.T) {
	out, errOut := withStreams(t)

	p := NewPrinter(true)
	p.PrintSuccess("查询成功", map[string]any{"items": []int{1, 2}, "total": 2})

	var v struct {
		Message string `json:"message"`
		Data    struct {
			Items []int `json:"items"`
			Total int   `json:"total"`
		} `json:"data"`
	}
	if err := json.Unmarshal(out.Bytes(), &v); err != nil {
		t.Fatalf("stdout is not a single JSON document: %v\n%s", err, out.String())
	}
	if v.Message != "查询成功" || v.Data.Total != 2 || len(v.Data.Items) != 2 {
		t.Errorf("unexpected payload: %+v", v)
	}
	if errOut.Len() != 0 {
		t.Errorf("stderr should be empty on success, got %q", errOut.String())
	}
}

func TestJSONPrinterErrorGoesToStderr(t *testing.T) {
	out, errOut := withStreams(t)

	p := NewPrinter(true)
	p.PrintError("人员不存在")

	if out.Len() != 0 {
		t.Errorf("stdout must stay clean in JSON error mode, got %q", out.String())
	}
	var v struct {
		Error string `json:"error"`
	}
	if err := json.Unmarshal(errOut.Bytes(), &v); err != nil {
		t.Fatalf("stderr is not JSON: %v\n%s", err, errOut.String())
	}
	if v.Error != "人员不存在" {
		t.Errorf("error message = %q", v.Error)
	}
}

func TestTableEmptyRows(t *testing.T) {
	out, _ := withStreams(t)
	p := NewPrinter(false)
	p.PrintTable([]string{"ID"}, nil)
	if !strings.Contains(out.String(), "(无数据)") {
		t.Errorf("empty table output = %q", out.String())
	}
}
