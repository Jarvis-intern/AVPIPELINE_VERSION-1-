package helper

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// sanitizeFilename removes potentially unsafe characters from filenames.
func SanitizeFilename(filename string) string {
	// Remove any path separators and other unsafe characters
	return regexp.MustCompile(`[<>:"/\\|?*]`).ReplaceAllString(filename, "_")
}

// getUniqueFilename ensures the filename is unique within the directory.
func GetUniqueFilename(dir, filename string) (string, error) {
	path := filepath.Join(dir, filename)
	ext := filepath.Ext(filename)
	name := strings.TrimSuffix(filename, ext)
	counter := 1

	for {
		if _, err := os.Stat(path); os.IsNotExist(err) {
			return path, nil
		}
		path = filepath.Join(dir, fmt.Sprintf("%s_%d%s", name, counter, ext))
		counter++
	}
}
