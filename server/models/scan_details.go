package models

import (
	"time"

	"gitlab.com/magnetite1/av-pipeline/server/config"
)

type ScanDetails struct {
	ID                    uint        `json:"id" gorm:"primaryKey"`
	TaskID                string      `json:"task_id" gorm:"not null"`
	AVID                  uint        `json:"av_id" gorm:"not null"`
	TimeOfInitialisation  time.Time   `json:"time_of_initialisation" gorm:"not null"`
	TimeOfScanCompletion  time.Time   `json:"time_of_scan_completion" gorm:"not null"`
	FilesScannedCount     int         `json:"files_scanned_count" gorm:"not null"`
	QuarantinedFilesCount int         `json:"quarantined_files_count" gorm:"not null"`
	ThreatsFilesCount     int         `json:"threats_files_count" gorm:"not null"`
	WarningFilesCount     int         `json:"warning_files_count" gorm:"not null"`
	ThreadType            *string     `json:"thread_type" gorm:"size:20"`
	InfectedFileList      StringArray `json:"infected_file_list" gorm:"type:text[]"`
	QuarantinedFileList   StringArray `json:"quarantined_file_list" gorm:"type:text[]"`
	WarningFileList       StringArray `json:"warning_file_list" gorm:"type:text[]"`
	ScanDuration          *string     `json:"scan_duration" gorm:"size:20"`
	ScanType              *string     `json:"scan_type" gorm:"size:20"`
	ScanStartTime         time.Time   `json:"scan_start_time" gorm:"not null"`
	ScanEndTime           time.Time   `json:"scan_end_time" gorm:"not null"`

	// Relationships
	AV   AV   `json:"av" gorm:"foreignKey:AVID"`
	Task Task `json:"task" gorm:"foreignKey:TaskID;references:UniqueID"`
}

func (s *ScanDetails) Create() error {
	return config.DB.Create(s).Error
}

func (s *ScanDetails) Update() error {
	return config.DB.Save(s).Error
}

func (s *ScanDetails) Delete() error {
	return config.DB.Delete(s).Error
}

func (s *ScanDetails) GetByID(id uint) error {
	return config.DB.First(s, id).Error
}

func GetAllScanDetails() ([]ScanDetails, error) {
	var scanDetails []ScanDetails
	err := config.DB.Preload("AV").Preload("Task").Find(&scanDetails).Error
	return scanDetails, err
}

func GetScanDetailsByID(id uint) (*ScanDetails, error) {
	var scanDetails ScanDetails
	err := config.DB.Preload("AV").Preload("Task").First(&scanDetails, id).Error
	if err != nil {
		return nil, err
	}
	return &scanDetails, nil
}

func GetScanDetailsByTaskID(taskID string) ([]ScanDetails, error) {
	var scanDetails []ScanDetails
	err := config.DB.Preload("AV").Where("task_id = ?", taskID).Find(&scanDetails).Error
	return scanDetails, err
}

func GetScanDetailsByAVID(avID uint) ([]ScanDetails, error) {
	var scanDetails []ScanDetails
	err := config.DB.Preload("Task").Where("av_id = ?", avID).Find(&scanDetails).Error
	return scanDetails, err
}
