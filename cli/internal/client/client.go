// Package client provides a typed HTTP client for the Registry API.
//
// It handles the unified response format ({success, message, code?, data?,
// error?}), the reserved Bearer token header, multipart file upload, and
// file download streaming.
//
// Note on 204 handling: every Registry delete endpoint returns a true,
// bodyless HTTP 204 (`new Response(null)` — unlike Serenique's Hono build
// that sent a body with 204), so no connection-close workaround is needed.
package client

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// DefaultTimeout is the HTTP client timeout for all JSON requests.
const DefaultTimeout = 60 * time.Second

// Client wraps the Registry API HTTP client.
type Client struct {
	BaseURL    string
	Token      string
	HTTPClient *http.Client
}

// APIResponse is the unified response envelope from the server.
type APIResponse struct {
	Success bool            `json:"success"`
	Message string          `json:"message"`
	Code    string          `json:"code,omitempty"`
	Data    json.RawMessage `json:"data,omitempty"`
	Error   json.RawMessage `json:"error,omitempty"`
}

// APIError wraps an error returned by the API. Code carries the backend's
// business error code (e.g. ATTRIBUTE_TYPE_LOCKED) so AI/script consumers can
// branch on it programmatically.
type APIError struct {
	Message    string
	Code       string
	HTTPStatus int
	Details    json.RawMessage
}

func (e *APIError) Error() string {
	msg := e.Message
	if msg == "" {
		msg = "请求失败"
	}
	if len(e.Details) > 0 {
		return fmt.Sprintf("%s (HTTP %d, details: %s)", msg, e.HTTPStatus, string(e.Details))
	}
	return fmt.Sprintf("%s (HTTP %d)", msg, e.HTTPStatus)
}

// NewClient creates a new API client.
func NewClient(baseURL, token string) (*Client, error) {
	// Strip trailing slash for consistent URL building.
	baseURL = strings.TrimRight(baseURL, "/")
	if err := ValidateBaseURL(baseURL); err != nil {
		return nil, err
	}

	return &Client{
		BaseURL: baseURL,
		Token:   token,
		HTTPClient: &http.Client{
			Timeout: DefaultTimeout,
		},
	}, nil
}

// ValidateBaseURL rejects a base URL that cannot produce well-formed requests —
// an empty scheme or host, or a non-HTTP(S) scheme — with an actionable message.
// Failing here (at client construction, right after config resolution) surfaces
// a config typo like `http://` or a bare host immediately instead of as a
// cryptic "http: no Host in request URL" wrapped in a generic network hint at
// request time. The audience includes AI agents setting config via env vars.
func ValidateBaseURL(raw string) error {
	baseURL := strings.TrimRight(raw, "/")
	u, err := url.Parse(baseURL)
	if err != nil {
		return fmt.Errorf("无效的 baseurl %q: %v", baseURL, err)
	}
	if u.Scheme == "" || u.Host == "" {
		return fmt.Errorf("无效的 baseurl %q: 必须包含协议和主机名，例如 http://localhost:3000", baseURL)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("无效的 baseurl %q: 仅支持 http 或 https 协议", baseURL)
	}
	return nil
}

// =============================================================================
// Generic request methods
// =============================================================================

// Get sends a GET request and unmarshals the response data into result.
func (c *Client) Get(ctx context.Context, path string, query url.Values, result any) error {
	fullURL := c.url(path)
	if len(query) > 0 {
		fullURL += "?" + query.Encode()
	}

	req, err := http.NewRequestWithContext(ctx, "GET", fullURL, nil)
	if err != nil {
		return fmt.Errorf("创建请求失败: %w", err)
	}
	c.setHeaders(req)

	return c.do(req, result)
}

// Post sends a POST request with a JSON body and unmarshals the response data into result.
func (c *Client) Post(ctx context.Context, path string, body any, result any) error {
	var bodyReader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("序列化请求体失败: %w", err)
		}
		bodyReader = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.url(path), bodyReader)
	if err != nil {
		return fmt.Errorf("创建请求失败: %w", err)
	}
	c.setHeaders(req)
	req.Header.Set("Content-Type", "application/json")

	return c.do(req, result)
}

// Patch sends a PATCH request with a JSON body and unmarshals the response
// data into result.
func (c *Client) Patch(ctx context.Context, path string, body any, result any) error {
	b, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("序列化请求体失败: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "PATCH", c.url(path), bytes.NewReader(b))
	if err != nil {
		return fmt.Errorf("创建请求失败: %w", err)
	}
	c.setHeaders(req)
	req.Header.Set("Content-Type", "application/json")

	return c.do(req, result)
}

// Delete sends a DELETE request. Registry's delete endpoints return a true
// bodyless 204, which do() treats as plain success.
func (c *Client) Delete(ctx context.Context, path string) error {
	req, err := http.NewRequestWithContext(ctx, "DELETE", c.url(path), nil)
	if err != nil {
		return fmt.Errorf("创建请求失败: %w", err)
	}
	c.setHeaders(req)

	return c.do(req, nil)
}

// UploadFile uploads a file via multipart/form-data under the field name
// "file". extraFields are appended as regular form fields (e.g. collectionId
// for source-files). The result is unmarshalled from the API response data
// field. The whole body is buffered through multipart.Writer because Registry
// uploads are bounded in size; streaming via io.Pipe adds hang modes that a
// bounded buffer does not have.
func (c *Client) UploadFile(ctx context.Context, apiPath, filePath string, extraFields map[string]string, result any) error {
	file, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("无法打开文件 %s: %w", filePath, err)
	}
	defer file.Close()

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	part, err := writer.CreateFormFile("file", filepath.Base(filePath))
	if err != nil {
		return fmt.Errorf("创建表单字段失败: %w", err)
	}
	if _, err := io.Copy(part, file); err != nil {
		return fmt.Errorf("读取文件失败: %w", err)
	}
	for k, v := range extraFields {
		if err := writer.WriteField(k, v); err != nil {
			return fmt.Errorf("写入表单字段 %s 失败: %w", k, err)
		}
	}
	if err := writer.Close(); err != nil {
		return fmt.Errorf("完成表单编码失败: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.url(apiPath), &buf)
	if err != nil {
		return fmt.Errorf("创建上传请求失败: %w", err)
	}
	c.setHeaders(req)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	return c.do(req, result)
}

// DownloadFile downloads raw binary content from apiPath and saves it.
// When outputPath is empty, the filename is derived from the response's
// Content-Disposition header (RFC 5987 filename*, falling back to filename=),
// sanitized with filepath.Base against path traversal; if neither yields a
// usable name, "download.bin" is used (relative to the process cwd).
// Returns the final saved path and the received byte count. The endpoint
// serves a bare binary stream (Content-Disposition: attachment), not the
// unified envelope, so non-2xx bodies are surfaced as best-effort parsed errors.
//
// The body is written to a temp file in the destination directory and atomically
// renamed onto outputPath only after a fully-received copy, so an interrupted
// run never leaves a partial file at the final path, and the overwrite check
// happens immediately before the rename (closing the TOCTOU window).
func (c *Client) DownloadFile(ctx context.Context, apiPath, outputPath string, overwrite bool) (string, int64, error) {
	fullURL := c.url(apiPath)
	req, err := http.NewRequestWithContext(ctx, "GET", fullURL, nil)
	if err != nil {
		return "", 0, fmt.Errorf("创建下载请求失败: %w", err)
	}
	c.setHeaders(req)

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", 0, fmt.Errorf("下载请求失败: %w\n提示: 请检查 baseurl 配置和网络连接 (当前: %s)", err, c.BaseURL)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		var apiResp APIResponse
		if json.Unmarshal(body, &apiResp) == nil && !apiResp.Success {
			return "", 0, &APIError{Message: apiResp.Message, Code: apiResp.Code, HTTPStatus: resp.StatusCode, Details: apiResp.Error}
		}
		return "", 0, fmt.Errorf("下载失败 (HTTP %d): %s", resp.StatusCode, snippet(body))
	}

	// Derive the target path before opening the temp file: an empty outputPath
	// takes the server-declared filename, sanitized to a bare base name so a
	// malicious Content-Disposition cannot escape the destination directory.
	if outputPath == "" {
		name := fileNameFromDisposition(resp.Header.Get("Content-Disposition"))
		if name != "" {
			outputPath = filepath.Base(name)
		}
		if outputPath == "" || outputPath == "." || outputPath == ".." {
			outputPath = "download.bin"
		}
	}

	// Write to a temp file in the destination directory (so the final rename is
	// atomic on the same filesystem) rather than directly to outputPath.
	dir := filepath.Dir(outputPath)
	tmp, err := os.CreateTemp(dir, ".registry-dl-*")
	if err != nil {
		return "", 0, fmt.Errorf("无法创建临时文件（目标目录: %s）: %w", dir, err)
	}
	tmpName := tmp.Name()
	discardTmp := func() {
		tmp.Close()
		os.Remove(tmpName) // no-op once the rename succeeds
	}

	n, err := io.Copy(tmp, resp.Body)
	if err != nil {
		if errors.Is(err, io.ErrUnexpectedEOF) {
			err = fmt.Errorf("下载中断：服务器提前关闭了连接（%d 字节已写入）", n)
		}
		discardTmp()
		return "", 0, fmt.Errorf("写入文件失败: %w", err)
	}
	// Verify the byte count when the server declared one: a truncated body over
	// a Content-Length response would otherwise be renamed over the target as if
	// complete.
	if resp.ContentLength >= 0 && n != resp.ContentLength {
		discardTmp()
		return "", 0, fmt.Errorf("下载不完整（收到 %d 字节，预期 %d 字节）", n, resp.ContentLength)
	}

	// os.CreateTemp creates the file with 0600; downloaded files are not
	// secrets, so relax to 0644. The config layer intentionally stays 0600.
	if err := tmp.Chmod(0o644); err != nil {
		discardTmp()
		return "", 0, fmt.Errorf("设置文件权限失败: %w", err)
	}

	if err := tmp.Close(); err != nil {
		os.Remove(tmpName)
		return "", 0, fmt.Errorf("关闭文件失败: %w", err)
	}

	// Refuse to silently replace an existing file. The check runs immediately
	// before the atomic rename, minimizing the TOCTOU window.
	if !overwrite {
		if _, err := os.Lstat(outputPath); err == nil {
			os.Remove(tmpName)
			return "", 0, fmt.Errorf("目标文件已存在: %s（如需覆盖请使用 --force）", outputPath)
		}
	}

	if err := os.Rename(tmpName, outputPath); err != nil {
		os.Remove(tmpName)
		return "", 0, fmt.Errorf("保存文件失败 (%s): %w", outputPath, err)
	}

	return outputPath, n, nil
}

// fileNameFromDisposition extracts the filename from a Content-Disposition
// header value such as `attachment; filename*=UTF-8”%E5%90%8D%E5%8D%95.csv`
// or `attachment; filename="report.pdf"`. RFC 5987 filename* wins because it
// carries non-ASCII names intact (Registry always emits it); the plain
// filename parameter is the ASCII-only fallback. Returns "" when absent.
func fileNameFromDisposition(header string) string {
	parts := strings.Split(header, ";")
	// First pass: filename* (RFC 5987 charset'lang'percent-encoded-value).
	for _, part := range parts {
		v, ok := strings.CutPrefix(strings.TrimSpace(part), "filename*=")
		if !ok {
			continue
		}
		segments := strings.SplitN(v, "'", 3)
		if len(segments) == 3 {
			if name, err := url.QueryUnescape(segments[2]); err == nil && strings.TrimSpace(name) != "" {
				return strings.TrimSpace(name)
			}
		}
	}
	// Second pass: quoted (or bare) ASCII filename.
	for _, part := range parts {
		v, ok := strings.CutPrefix(strings.TrimSpace(part), "filename=")
		if !ok {
			continue
		}
		name := strings.Trim(v, `"`)
		if strings.TrimSpace(name) != "" {
			return strings.TrimSpace(name)
		}
	}
	return ""
}

// List sends a GET request to a paginated endpoint and unpacks the
// PaginatedResult envelope {items, total, page, pageSize}. Stays a free
// function rather than a method because Go does not allow generic methods on
// a non-generic receiver type.
func List[T any](c *Client, ctx context.Context, path string, query url.Values) ([]T, int, error) {
	var result struct {
		Items []T `json:"items"`
		Total int `json:"total"`
	}
	if err := c.Get(ctx, path, query, &result); err != nil {
		return nil, 0, err
	}
	return result.Items, result.Total, nil
}

// =============================================================================
// Internal helpers
// =============================================================================

func (c *Client) url(apiPath string) string {
	return c.BaseURL + apiPath
}

func (c *Client) setHeaders(req *http.Request) {
	req.Header.Set("Accept", "application/json")
	if c.Token != "" {
		// Reserved for future authentication; the backend currently ignores it.
		req.Header.Set("Authorization", "Bearer "+c.Token)
	}
}

// do executes the request, parses the unified response, and unmarshals data
// into result.
func (c *Client) do(req *http.Request, result any) error {
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("请求失败: %w\n提示: 请检查 baseurl 配置和网络连接 (当前: %s)", err, c.BaseURL)
	}
	defer resp.Body.Close()

	// Buffer at most maxResponseBody+1 so an oversized body is detectable and
	// rejected instead of being read fully into memory.
	body, err := io.ReadAll(io.LimitReader(resp.Body, int64(maxResponseBody+1)))
	if err != nil {
		return fmt.Errorf("读取响应失败: %w", err)
	}

	// 204 No Content — success with no body, nothing to unmarshal. Every
	// Registry delete endpoint responds this way (true empty body).
	if resp.StatusCode == 204 {
		return nil
	}

	if len(body) > maxResponseBody {
		return &APIError{
			Message:    fmt.Sprintf("响应体过大（超过 %d 字节），请求被拒绝", maxResponseBody),
			HTTPStatus: resp.StatusCode,
		}
	}

	var apiResp APIResponse
	parseErr := json.Unmarshal(body, &apiResp)

	// Non-2xx status is always an error, even for a success:true envelope or a
	// non-envelope body.
	if resp.StatusCode >= 400 {
		if parseErr == nil {
			return &APIError{Message: apiResp.Message, Code: apiResp.Code, HTTPStatus: resp.StatusCode, Details: apiResp.Error}
		}
		return &APIError{Message: fmt.Sprintf("HTTP %d: %s", resp.StatusCode, snippet(body)), HTTPStatus: resp.StatusCode}
	}

	if parseErr != nil {
		return fmt.Errorf("服务器返回了意外的响应格式 (HTTP %d): %s", resp.StatusCode, snippet(body))
	}

	if !apiResp.Success {
		return &APIError{Message: apiResp.Message, Code: apiResp.Code, HTTPStatus: resp.StatusCode, Details: apiResp.Error}
	}

	// Unmarshal data into the caller's result
	if result != nil && len(apiResp.Data) > 0 {
		if err := json.Unmarshal(apiResp.Data, result); err != nil {
			return fmt.Errorf("解析响应数据失败: %w", err)
		}
	}

	return nil
}

// maxResponseBody caps how much of a response body the client buffers for JSON
// endpoints. A legitimate unified envelope is small (list pages are bounded by
// pageSize<=100); an unbounded read would let a misbehaving server (or a proxy
// error page) balloon memory or produce a giant error string. A variable so
// tests can shrink it.
var maxResponseBody = 4 << 20 // 4 MiB

// snippet renders a raw response body for an error message, trimmed to a
// bounded length so a huge body cannot produce a giant error string.
// Truncation is rune-safe: byte slicing could split a multi-byte CJK rune
// and emit invalid UTF-8 into stderr.
func snippet(body []byte) string {
	s := strings.TrimSpace(string(body))
	if len([]rune(s)) > 300 {
		s = string([]rune(s)[:300]) + "..."
	}
	if s == "" {
		s = "(空响应体)"
	}
	return s
}
