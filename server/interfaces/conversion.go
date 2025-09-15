package interfaces

import (
	"time"
)

// ConversionTask represents a conversion task
type ConversionTask struct {
	Path           string `json:"path"`
	ConversionType string `json:"conversion_type"`
	OutputPath     string `json:"output_path,omitempty"`
	TaskID         string `json:"task_id,omitempty"`
}

// ConversionResult represents the result of a conversion
type ConversionResult struct {
	Status         string    `json:"status"`
	ConversionType string    `json:"conversion_type"`
	Path           string    `json:"path"`
	StartTime      time.Time `json:"start_time"`
	EndTime        time.Time `json:"end_time,omitempty"`
	TotalFiles     int       `json:"total_files"`
	TotalSize      int64     `json:"total_size"`
	TotalConverted int       `json:"total_converted"`
	TotalFailed    int       `json:"total_failed"`
	ConvertedFiles []string  `json:"converted_files"`
	FailedFiles    []string  `json:"failed_files"`
	Error          string    `json:"error,omitempty"`
	TaskID         string    `json:"task_id,omitempty"`
}

// ActiveConversion represents an ongoing conversion
type ActiveConversion struct {
	StartTime time.Time      `json:"start_time"`
	Task      ConversionTask `json:"task"`
	Status    string         `json:"status"`
}
