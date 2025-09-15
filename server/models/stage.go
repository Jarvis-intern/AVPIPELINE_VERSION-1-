package models

import (
	"errors"

	"gitlab.com/magnetite1/av-pipeline/server/config"
	"gorm.io/gorm"
)

type Stage struct {
	ID   uint   `json:"id" gorm:"primaryKey"`
	Name string `json:"name" gorm:"size:20;not null;unique"`
}

// Create a new stage entry
func (s *Stage) Create() error {
	return config.DB.Create(s).Error
}

// Get all stages
func GetAllStages() ([]Stage, error) {
	var stages []Stage
	err := config.DB.Find(&stages).Error
	return stages, err
}

// Find stage by name
func FindStageByName(name string) (*Stage, error) {
	var stage Stage
	err := config.DB.Where("name = ?", name).First(&stage).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil // not found is not an error
	}
	return &stage, err
}
