package models

import (
	"time"

	"gitlab.com/magnetite1/av-pipeline/server/config"
	"gorm.io/gorm"
)

type Conversion struct {
	ID                 uint           `json:"id" gorm:"primaryKey"`
	ConversionID       string         `json:"conversion_id" gorm:"unique;not null"`
	SystemIP           string         `json:"system_ip" gorm:"size:15;not null"`
	SelectedFormat     string         `json:"selected_format" gorm:"size:32;not null"`
	IsConverting       bool           `json:"is_converting" gorm:"not null;default:false"`
	CurrentPhase       int            `json:"current_phase" gorm:"not null;default:1"`
	InputPath          string         `json:"input_path" gorm:"size:512;not null"`
	SocketUserID       string         `json:"socket_user_id" gorm:"size:128"`
	ConversionProgress string         `json:"conversion_progress" gorm:"type:jsonb;not null"` // JSON
	Phases             string         `json:"phases" gorm:"type:jsonb;not null"`              // JSON
	ConversionError    string         `json:"conversion_error" gorm:"size:512"`
	ApiResponse        string         `json:"api_response" gorm:"type:jsonb"` // JSON
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
	DeletedAt          gorm.DeletedAt `json:"-" gorm:"index"`
}

func (c *Conversion) Create() error {
	return config.DB.Create(c).Error
}

func (c *Conversion) Update() error {
	return config.DB.Save(c).Error
}

func (c *Conversion) Delete() error {
	return config.DB.Delete(c).Error
}

func (c *Conversion) GetByConversionID(conversionID string) error {
	return config.DB.Where("conversion_id = ?", conversionID).First(c).Error
}

func GetAllConversions() ([]Conversion, error) {
	var conversions []Conversion
	err := config.DB.Find(&conversions).Error
	return conversions, err
}
