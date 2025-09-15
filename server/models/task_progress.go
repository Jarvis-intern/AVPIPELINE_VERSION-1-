package models

import (
	"time"

	"gorm.io/gorm"
)

// You can use a JSONB field for the full progress state if the structure is complex and dynamic.
type TaskProgress struct {
	ID        uint   `gorm:"primaryKey"`
	SystemIP  string `json:"system_ip" gorm:"size:15;not null"`
	TaskID    string `gorm:"not null;index"`      // Foreign key to Task.UniqueID
	Progress  string `gorm:"type:jsonb;not null"` // Store the full StageProgress as JSON
	UpdatedAt time.Time
	CreatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}

// Create a new progress entry
func (tp *TaskProgress) Create(db *gorm.DB) error {
	return db.Create(tp).Error
}

// Update progress for a task
func UpdateTaskProgress(db *gorm.DB, taskID string, progress string) error {
	return db.Model(&TaskProgress{}).
		Where("task_id = ?", taskID).
		Update("progress", progress).Error
}

// Get progress for a task
func GetTaskProgress(db *gorm.DB, taskID string) (*TaskProgress, error) {
	var tp TaskProgress
	err := db.Where("task_id = ?", taskID).First(&tp).Error
	return &tp, err
}
