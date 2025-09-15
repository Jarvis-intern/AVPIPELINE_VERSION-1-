package utils

import (
	"fmt"
	"time"

	"gitlab.com/magnetite1/av-pipeline/server/config"
	"gitlab.com/magnetite1/av-pipeline/server/models"
	"gorm.io/gorm"
)

// GenerateUniqueID generates a unique ID in the format PREFIX-YYYYMM-XXX
// This matches the Python implementation's generate_unique_id function
//
// Parameters:
//   - prefix: The prefix for the ID (e.g., "TASK", "USER", etc.)
//
// Returns:
//   - string: The generated unique ID in format PREFIX-YYYYMM-XXX
//   - error: Any error that occurred during generation
//
// Example:
//   - GenerateUniqueID("TASK") -> "TASK-202401-001"
//   - GenerateUniqueID("USER") -> "USER-202401-042"
func GenerateUniqueID(prefix string) (string, error) {
	now := time.Now()
	yearMonth := now.Format("200601") // YYYYMM format

	// Count entries with the same prefix and year_month
	likePattern := fmt.Sprintf("%s-%s-%%", prefix, yearMonth)

	var count int64
	err := config.DB.Model(&models.Task{}).Where("unique_id LIKE ?", likePattern).Count(&count).Error
	if err != nil {
		return "", fmt.Errorf("failed to count existing tasks: %w", err)
	}

	// Increment and format to 3-digit number
	newID := fmt.Sprintf("%s-%s-%03d", prefix, yearMonth, count+1)

	// Verify the generated ID doesn't already exist (race condition protection)
	var existingTask models.Task
	err = config.DB.Where("unique_id = ?", newID).First(&existingTask).Error
	if err == nil {
		// ID already exists, try with next number
		newID = fmt.Sprintf("%s-%s-%03d", prefix, yearMonth, count+2)
	} else if err != gorm.ErrRecordNotFound {
		return "", fmt.Errorf("failed to verify unique ID: %w", err)
	}

	return newID, nil
}

// GenerateTaskUniqueID is a convenience function specifically for generating task unique IDs
func GenerateTaskUniqueID() (string, error) {
	return GenerateUniqueID("TASK")
}

// FormatFileSize converts bytes to a human-readable format (e.g., KB, MB)
func FormatFileSize(sizeInBytes int64) string {
	const unit = 1024
	if sizeInBytes < unit {
		return fmt.Sprintf("%d B", sizeInBytes)
	}

	div, exp := int64(unit), 0
	for n := sizeInBytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}

	units := []string{"KB", "MB", "GB", "TB", "PB"}
	return fmt.Sprintf("%.2f %s", float64(sizeInBytes)/float64(div), units[exp])
}

// SanitizeFilename replaces invalid filename characters with underscores
func SanitizeFilename(filename string) string {
	// This is a placeholder - implement based on your needs
	// You might want to use regex to replace invalid characters
	return filename
}

// GetUniqueFilename generates a unique filename by appending a counter if necessary
func GetUniqueFilename(directory, filename string) (string, error) {
	// This is a placeholder - implement based on your needs
	// Similar to Python's get_unique_filename function
	return filename, nil
}
