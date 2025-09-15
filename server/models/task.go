package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"strings"

	"gitlab.com/magnetite1/av-pipeline/server/config"
)

// StringArray represents a PostgreSQL text array
type StringArray []string

// Scan implements the Scanner interface for database/sql
func (sa *StringArray) Scan(value interface{}) error {
	if value == nil {
		*sa = StringArray{}
		return nil
	}

	switch v := value.(type) {
	case []byte:
		return sa.parsePostgreSQLArray(string(v))
	case string:
		return sa.parsePostgreSQLArray(v)
	default:
		return errors.New("cannot scan into StringArray")
	}
}

// parsePostgreSQLArray parses PostgreSQL text array format: {value1,value2,"quoted value"}
func (sa *StringArray) parsePostgreSQLArray(s string) error {
	// Handle empty array
	if s == "{}" || s == "" {
		*sa = StringArray{}
		return nil
	}

	// Handle NULL values
	if s == "NULL" || s == "null" {
		*sa = StringArray{}
		return nil
	}

	// Remove outer braces
	if len(s) < 2 || s[0] != '{' || s[len(s)-1] != '}' {
		// Try parsing as JSON fallback for compatibility
		if err := json.Unmarshal([]byte(s), sa); err != nil {
			// If JSON parsing fails, treat as single value
			*sa = StringArray{s}
		}
		return nil
	}

	content := s[1 : len(s)-1]
	if content == "" {
		*sa = StringArray{}
		return nil
	}

	var result []string
	var current strings.Builder
	inQuotes := false
	escaped := false

	for _, char := range content {
		switch {
		case escaped:
			current.WriteRune(char)
			escaped = false
		case char == '\\':
			escaped = true
		case char == '"':
			inQuotes = !inQuotes
		case char == ',' && !inQuotes:
			result = append(result, current.String())
			current.Reset()
		default:
			current.WriteRune(char)
		}
	}

	// Add the last element
	if current.Len() > 0 || len(result) == 0 {
		result = append(result, current.String())
	}

	*sa = StringArray(result)
	return nil
}

// Value implements the driver Valuer interface for PostgreSQL arrays
func (sa StringArray) Value() (driver.Value, error) {
	if len(sa) == 0 {
		return "{}", nil
	}

	// Format as PostgreSQL array: {"value1","value2","value3"}
	result := "{"
	for i, v := range sa {
		if i > 0 {
			result += ","
		}
		// Escape quotes, backslashes, and wrap in quotes if needed
		if needsQuoting(v) {
			escaped := strings.ReplaceAll(v, `\`, `\\`)
			escaped = strings.ReplaceAll(escaped, `"`, `\"`)
			result += `"` + escaped + `"`
		} else {
			result += v
		}
	}
	result += "}"

	return result, nil
}

// needsQuoting determines if a string needs to be quoted in PostgreSQL array format
func needsQuoting(s string) bool {
	if s == "" {
		return true
	}
	// Quote if contains special characters
	return strings.ContainsAny(s, `,{}"\\ `)
}

type Task struct {
	ID            uint        `json:"id" gorm:"primaryKey"`
	UniqueID      string      `json:"unique_id" gorm:"unique;not null"`
	Name          string      `json:"name" gorm:"size:30;not null"`
	Description   string      `json:"description" gorm:"size:256"`
	FilePath      string      `json:"file_path" gorm:"size:512;not null"`
	AvFilePath    string      `json:"av_file_path" gorm:"size:512;not null"`
	Stage1        *uint       `json:"stage1"`
	Stage2        *uint       `json:"stage2"`
	Stage3        *uint       `json:"stage3"`
	Stage4        *uint       `json:"stage4"`
	Stage5        *uint       `json:"stage5"`
	Stage6        *uint       `json:"stage6"`
	Zip           string      `json:"zip" gorm:"size:20;not null"`
	Conversion    StringArray `json:"conversion" gorm:"type:text[]"`
	Removal       StringArray `json:"removal" gorm:"type:text[]"`
	VerifyRemoval StringArray `json:"verify_removal" gorm:"type:text[]"`
	AutoProceed   bool        `json:"auto_proceed" gorm:"default:false"`
	IsOrganized   bool        `json:"isOrganized" gorm:"default:false"`
	AVs           StringArray `json:"avs" gorm:"type:text[]"`
	Assignee      string      `json:"assignee" gorm:"not null"`
	SystemIP      string      `json:"system_ip" gorm:"size:15;not null"`
	UserID        *uint       `json:"user_id" gorm:"index"`
	User          *User       `json:"user,omitempty" gorm:"foreignKey:UserID"`

	TaskDetails *TaskDetails  `json:"task_details,omitempty" gorm:"foreignKey:TaskID;references:UniqueID"`
	ScanDetails []ScanDetails `json:"scan_details,omitempty" gorm:"foreignKey:TaskID;references:UniqueID"`
}

func (t *Task) Create() error {
	return config.DB.Create(t).Error
}

func (t *Task) Update() error {
	return config.DB.Save(t).Error
}

func (t *Task) Delete() error {
	return config.DB.Delete(t).Error
}

func (t *Task) GetByID(id uint) error {
	return config.DB.First(t, id).Error
}

func GetAllTasks() ([]Task, error) {
	var tasks []Task
	err := config.DB.Find(&tasks).Error
	return tasks, err
}

func GetTaskByID(id uint) (*Task, error) {
	var task Task
	err := config.DB.Preload("TaskDetails").Preload("ScanDetails").First(&task, id).Error
	if err != nil {
		return nil, err
	}
	return &task, nil
}

func GetTaskByUniqueID(uniqueID string) (*Task, error) {
	var task Task
	err := config.DB.Preload("TaskDetails").Preload("ScanDetails").Where("unique_id = ?", uniqueID).First(&task).Error
	if err != nil {
		return nil, err
	}
	return &task, nil
}
