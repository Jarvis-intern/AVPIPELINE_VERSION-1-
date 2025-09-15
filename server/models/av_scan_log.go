package models

import (
	"gitlab.com/magnetite1/av-pipeline/server/config"
)

type AVScanLog struct {
	ID        uint   `json:"id" gorm:"primaryKey"`
	TaskID    string `json:"task_id" gorm:"not null"`
	AVName    string `json:"av_name" gorm:"size:100"`
	ScanID    string `json:"scan_id" gorm:"not null"`
	Content   string `json:"content" gorm:"type:text"`
	Timestamp string `json:"timestamp" gorm:"size:50"`
	Level     int    `json:"level"`
	FilePath  string `json:"file_path" gorm:"size:512"`
	Progress  int    `json:"progress"`
}

func (l *AVScanLog) Create() error {
	return config.DB.Create(l).Error
}

func BatchCreateAVScanLogs(logs []AVScanLog) error {
	if len(logs) == 0 {
		return nil
	}
	return config.DB.Create(&logs).Error
}
