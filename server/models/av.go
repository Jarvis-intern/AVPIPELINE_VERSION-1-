package models

import (
	"time"

	"gitlab.com/magnetite1/av-pipeline/server/config"
)

type AV struct {
	ID               uint       `json:"id" gorm:"primaryKey"`
	Name             string     `json:"name" gorm:"size:100;not null"`
	IPAddress        string     `json:"ip_address" gorm:"size:15;not null"`
	Username         string     `json:"username" gorm:"size:100;not null"`
	Password         string     `json:"password" gorm:"size:128;not null"`
	Status           bool       `json:"status" gorm:"default:false"`
	Description      *string    `json:"description" gorm:"size:256"`
	Active           bool       `json:"active" gorm:"default:false"`
	Version          *string    `json:"version" gorm:"size:50"`
	SignatureVersion *string    `json:"signature_version" gorm:"size:50"`
	LastUpdate       *time.Time `json:"last_update"`
	ScanCommand      string     `json:"scan_command" gorm:"size:512;not null"`
	CheckCommand     string     `json:"check_command" gorm:"size:512;not null"`
	InfoCommand      string     `json:"info_command" gorm:"size:512;not null"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`

	// Relationships
	Scans []ScanDetails `json:"scans,omitempty" gorm:"foreignKey:AVID"`
}

func (a *AV) Create() error {
	return config.DB.Create(a).Error
}

func (a *AV) Update() error {
	return config.DB.Save(a).Error
}

func (a *AV) Delete() error {
	return config.DB.Delete(a).Error
}

func (a *AV) GetByID(id uint) error {
	return config.DB.First(a, id).Error
}

func (a *AV) GetByName(name string) error {
	return config.DB.Where("name = ?", name).First(a).Error
}

func (a *AV) GetAll() ([]AV, error) {
	var avs []AV
	return avs, config.DB.Find(&avs).Error
}
