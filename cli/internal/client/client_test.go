package client

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"testing"
)

func TestValidateBaseURL(t *testing.T) {
	valid := []string{"http://localhost:3000", "https://api.example.com/", "http://127.0.0.1:8080"}
	for _, v := range valid {
		if err := ValidateBaseURL(v); err != nil {
			t.Errorf("ValidateBaseURL(%q) = %v, want nil", v, err)
		}
	}
	invalid := []string{"", "localhost:3000", "ftp://x", "http://"}
	for _, v := range invalid {
		if err := ValidateBaseURL(v); err == nil {
			t.Errorf("ValidateBaseURL(%q) = nil, want error", v)
		}
	}
}

func TestGetParsesEnvelopeAndCode(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"message":"ok","data":{"name":"名单A","memberCount":3}}`))
	}))
	defer srv.Close()

	c, err := NewClient(srv.URL, "")
	if err != nil {
		t.Fatalf("NewClient() error = %v", err)
	}
	var out struct {
		Name        string `json:"name"`
		MemberCount int    `json:"memberCount"`
	}
	if err := c.Get(context.Background(), "/api/collections/1", nil, &out); err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	if out.Name != "名单A" || out.MemberCount != 3 {
		t.Errorf("parsed data = %+v", out)
	}
}

func TestErrorEnvelopeCarriesBusinessCode(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusConflict)
		_, _ = w.Write([]byte(`{"success":false,"message":"属性类型被锁定","code":"ATTRIBUTE_TYPE_LOCKED"}`))
	}))
	defer srv.Close()

	c, _ := NewClient(srv.URL, "")
	err := c.Post(context.Background(), "/api/attributes/3", map[string]any{"type": "number"}, nil)
	apiErr, ok := err.(*APIError)
	if !ok {
		t.Fatalf("want *APIError, got %T: %v", err, err)
	}
	if apiErr.Code != "ATTRIBUTE_TYPE_LOCKED" || apiErr.HTTPStatus != 409 {
		t.Errorf("APIError = {code:%s status:%d}", apiErr.Code, apiErr.HTTPStatus)
	}
}

func TestDelete204IsSuccess(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			t.Errorf("method = %s, want DELETE", r.Method)
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer srv.Close()

	c, _ := NewClient(srv.URL, "")
	if err := c.Delete(context.Background(), "/api/users/1"); err != nil {
		t.Fatalf("Delete() error = %v", err)
	}
}

func TestUploadFileWithExtraFields(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseMultipartForm(1 << 20); err != nil {
			t.Errorf("ParseMultipartForm() error = %v", err)
		}
		if r.FormValue("collectionId") != "7" {
			t.Errorf("collectionId = %q, want 7", r.FormValue("collectionId"))
		}
		file, header, err := r.FormFile("file")
		if err != nil {
			t.Fatalf("FormFile(file) error = %v", err)
		}
		defer file.Close()
		if header.Filename != "data.csv" {
			t.Errorf("filename = %q, want data.csv", header.Filename)
		}
		buf := make([]byte, 5)
		n, _ := file.Read(buf)
		if string(buf[:n]) != "hello" {
			t.Errorf("file content = %q", string(buf[:n]))
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"message":"created","data":{"id":9,"originalName":"data.csv"}}`))
	}))
	defer srv.Close()

	dir := t.TempDir()
	src := filepath.Join(dir, "data.csv")
	if err := os.WriteFile(src, []byte("hello"), 0o644); err != nil {
		t.Fatal(err)
	}

	c, _ := NewClient(srv.URL, "")
	var out struct {
		ID           int64  `json:"id"`
		OriginalName string `json:"originalName"`
	}
	extra := map[string]string{"collectionId": "7"}
	if err := c.UploadFile(context.Background(), "/api/source-files", src, extra, &out); err != nil {
		t.Fatalf("UploadFile() error = %v", err)
	}
	if out.ID != 9 || out.OriginalName != "data.csv" {
		t.Errorf("out = %+v", out)
	}
}

func TestDownloadFileNamesFromDispositionAndRefusesOverwrite(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Disposition", `attachment; filename*=UTF-8''%E5%90%8D%E5%8D%95.xlsx`)
		w.Header().Set("Content-Length", "5")
		_, _ = w.Write([]byte("hello"))
	}))
	defer srv.Close()

	dir := t.TempDir()
	wd, _ := os.Getwd()
	defer os.Chdir(wd)
	os.Chdir(dir)

	c, _ := NewClient(srv.URL, "")

	saved, n, err := c.DownloadFile(context.Background(), "/api/files/1/content", "", false)
	if err != nil {
		t.Fatalf("DownloadFile() error = %v", err)
	}
	if saved != "名单.xlsx" {
		t.Errorf("saved path = %q, want 名单.xlsx (RFC5987 name)", saved)
	}
	if n != 5 {
		t.Errorf("bytes = %d, want 5", n)
	}

	// Second download must refuse to overwrite an existing target.
	if _, _, err := c.DownloadFile(context.Background(), "/api/files/1/content", "", false); err == nil {
		t.Error("overwrite without --force should fail")
	} else {
		apiErr, ok := err.(*APIError)
		_ = apiErr
		if ok {
			t.Errorf("non-2xx expected plain error, got APIError: %v", err)
		}
	}
}

func TestSnippetTruncatesByRune(t *testing.T) {
	long := ""
	for i := 0; i < 200; i++ {
		long += "名册"
	}
	out := snippet([]byte(long))
	runes := len([]rune(out))
	if runes > 310 {
		t.Errorf("snippet len = %d runes, too long", runes)
	}
	// Must remain valid UTF-8: json.Marshal fails on invalid sequences.
	if _, err := json.Marshal(out); err != nil {
		t.Errorf("snippet produced invalid UTF-8: %v", err)
	}
}

func TestDownloadFileDetectsTruncatedBody(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Declare more bytes than written: the client must reject the short
		// body instead of renaming it over the target as if complete.
		w.Header().Set("Content-Disposition", `attachment; filename="trunc.csv"`)
		w.Header().Set("Content-Length", "100")
		_, _ = w.Write([]byte("hello"))
	}))
	defer srv.Close()

	dir := t.TempDir()
	wd, _ := os.Getwd()
	defer os.Chdir(wd)
	os.Chdir(dir)

	c, _ := NewClient(srv.URL, "")
	if _, _, err := c.DownloadFile(context.Background(), "/api/files/1/content", "out.csv", false); err == nil {
		t.Fatal("truncated body should fail")
	}
	if _, err := os.Stat("out.csv"); !os.IsNotExist(err) {
		t.Error("no partial file should remain at the final path")
	}
}

func TestListUnwrapsPaginationEnvelope(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("page") != "2" || r.URL.Query().Get("pageSize") != "20" {
			t.Errorf("query = %q", r.URL.RawQuery)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"message":"ok","data":{"items":[{"id":7,"realName":"李四"}],"total":42,"page":2,"pageSize":20}}`))
	}))
	defer srv.Close()

	c, _ := NewClient(srv.URL, "")
	type row struct {
		ID       int64  `json:"id"`
		RealName string `json:"realName"`
	}
	q := url.Values{}
	q.Set("page", "2")
	q.Set("pageSize", "20")
	items, total, err := List[row](c, context.Background(), "/api/users", q)
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if total != 42 || len(items) != 1 || items[0].ID != 7 || items[0].RealName != "李四" {
		t.Errorf("items=%+v total=%d", items, total)
	}
}
