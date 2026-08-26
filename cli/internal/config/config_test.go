package config

import (
	"os"
	"path/filepath"
	"testing"
)

// setTestConfigDir pins the config location to a fresh temp dir for the
// duration of one test.
func setTestConfigDir(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	t.Setenv("REGISTRY_CONFIG_DIR", dir)
	return dir
}

func TestLoadReturnsDefaultsWhenFileMissing(t *testing.T) {
	setTestConfigDir(t)

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.BaseURL != "http://localhost:3000" {
		t.Errorf("BaseURL default = %q, want http://localhost:3000", cfg.BaseURL)
	}
	if cfg.Token != "" {
		t.Errorf("Token default = %q, want empty", cfg.Token)
	}
}

func TestSaveLoadRoundTripAndPermissions(t *testing.T) {
	dir := setTestConfigDir(t)

	cfg := &Config{BaseURL: "http://10.0.0.8:9000", Token: "secret-token-value"}
	if err := Save(cfg); err != nil {
		t.Fatalf("Save() error = %v", err)
	}

	path := filepath.Join(dir, "config.yaml")
	fi, err := os.Stat(path)
	if err != nil {
		t.Fatalf("config file missing: %v", err)
	}
	if perm := fi.Mode().Perm(); perm != 0o600 {
		t.Errorf("config file perm = %o, want 600", perm)
	}

	got, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if got.BaseURL != cfg.BaseURL || got.Token != cfg.Token {
		t.Errorf("round trip mismatch: got %+v, want %+v", got, cfg)
	}
}

func TestSetPathOverridesEverything(t *testing.T) {
	dir := t.TempDir()
	custom := filepath.Join(dir, "custom.yaml")
	SetPath(custom)
	defer SetPath("")

	if err := Save(&Config{BaseURL: "http://custom:1"}); err != nil {
		t.Fatalf("Save() error = %v", err)
	}
	if _, err := os.Stat(filepath.Join(dir, ".registry")); !os.IsNotExist(err) {
		t.Errorf("default dir should not have been created")
	}
	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.BaseURL != "http://custom:1" {
		t.Errorf("BaseURL = %q, want http://custom:1", cfg.BaseURL)
	}
}

func TestResolvePrecedence(t *testing.T) {
	setTestConfigDir(t)

	base := &Config{BaseURL: "http://file:1", Token: "file-token"}

	// Env beats file.
	t.Setenv("REGISTRY_BASEURL", "http://env:2")
	got := base.Resolve("", "")
	if got.BaseURL != "http://env:2" || got.Token != "file-token" {
		t.Errorf("env precedence failed: %+v", got)
	}

	// Flag beats env and file.
	got = base.Resolve("http://flag:3", "flag-token")
	if got.BaseURL != "http://flag:3" || got.Token != "flag-token" {
		t.Errorf("flag precedence failed: %+v", got)
	}
}
