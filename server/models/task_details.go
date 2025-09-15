package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"

	"gitlab.com/magnetite1/av-pipeline/server/config"
)

// JSONMap represents a JSON object stored in PostgreSQL
type JSONMap map[string]interface{}

// Scan implements the Scanner interface for database/sql
func (jm *JSONMap) Scan(value interface{}) error {
	if value == nil {
		*jm = JSONMap{}
		return nil
	}

	switch v := value.(type) {
	case []byte:
		return json.Unmarshal(v, jm)
	case string:
		return json.Unmarshal([]byte(v), jm)
	default:
		return errors.New("cannot scan into JSONMap")
	}
}

// Value implements the driver Valuer interface
func (jm JSONMap) Value() (driver.Value, error) {
	if len(jm) == 0 {
		return "{}", nil
	}
	return json.Marshal(jm)
}

type TaskDetails struct {
	ID                        uint    `json:"id" gorm:"primaryKey"`
	TaskID                    string  `json:"task_id" gorm:"not null"`
	AVID                      *uint   `json:"av_id"`
	CurrentWorkingStage       *uint   `json:"current_working_stage"`
	TimeTaken                 int     `json:"time_taken" gorm:"not null"`
	TimeTakenStages           JSONMap `json:"time_taken_stages" gorm:"type:jsonb;default:'{}'"`
	CountMap                  JSONMap `json:"count_map" gorm:"type:jsonb;default:'{}'"`
	ConversionsMap            JSONMap `json:"conversions_map" gorm:"type:jsonb;default:'{}'"`
	ErrorMap                  JSONMap `json:"error_map" gorm:"type:jsonb;default:'{}'"`
	RemovedFilesCount         JSONMap `json:"removed_files_count" gorm:"type:jsonb;default:'{}'"`
	VerifiedFiles             JSONMap `json:"verified_files" gorm:"type:jsonb;default:'{}'"`
	VerifiedBy                uint    `json:"verified_by" gorm:"not null"`
	VerifiedRemovedFilesCount JSONMap `json:"verified_removed_files_count" gorm:"type:jsonb;default:'{}'"`

	// Relationships
	CurrentAV *AV `json:"current_av,omitempty" gorm:"foreignKey:AVID"`
}

func (t *TaskDetails) Create() error {
	return config.DB.Create(t).Error
}

func (t *TaskDetails) Update() error {
	return config.DB.Save(t).Error
}

func (t *TaskDetails) Delete() error {
	return config.DB.Delete(t).Error
}

func (t *TaskDetails) GetByID(id uint) error {
	return config.DB.First(t, id).Error
}

func GetAllTaskDetails() ([]TaskDetails, error) {
	var taskDetails []TaskDetails
	err := config.DB.Preload("Task").Preload("Verifier").Preload("CurrentAV").Find(&taskDetails).Error
	return taskDetails, err
}

func GetTaskDetailsByID(id uint) (*TaskDetails, error) {
	var taskDetails TaskDetails
	err := config.DB.Preload("Task").Preload("Verifier").Preload("CurrentAV").First(&taskDetails, id).Error
	if err != nil {
		return nil, err
	}
	return &taskDetails, nil
}

func GetTaskDetailsByTaskID(taskID string) (*TaskDetails, error) {
	var taskDetails TaskDetails
	err := config.DB.Preload("Task").Preload("Verifier").Preload("CurrentAV").Where("task_id = ?", taskID).First(&taskDetails).Error
	if err != nil {
		return nil, err
	}
	return &taskDetails, nil
}
