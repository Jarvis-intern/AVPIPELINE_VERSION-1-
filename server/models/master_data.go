package models

import (
	"errors"

	"gitlab.com/magnetite1/av-pipeline/server/config"
	"gorm.io/gorm"
)

// MasterData represents the workflow configuration options - matches Python model exactly
type MasterData struct {
	ID            uint        `json:"id" gorm:"primaryKey"`
	Zip           StringArray `json:"zip" gorm:"type:text[];default:'{}'"`
	Conversion    StringArray `json:"conversion" gorm:"type:text[];default:'{}'"`
	Removal       StringArray `json:"removal" gorm:"type:text[];default:'{}'"`
	VerifyRemoval StringArray `json:"verify_removal" gorm:"type:text[];default:'{}'"`
}

// MasterData methods - matching Python model functionality
func (m *MasterData) Create() error {
	return config.DB.Create(m).Error
}

func (m *MasterData) Save() error {
	return config.DB.Save(m).Error
}

func (m *MasterData) Update() error {
	return config.DB.Save(m).Error
}

func (m *MasterData) Delete() error {
	return config.DB.Delete(m).Error
}

// Get the singleton master data row (first) - matches Python behavior

type MasterDataResponse struct {
	Zip           StringArray `json:"zip"`
	Conversion    StringArray `json:"conversion"`
	Removal       StringArray `json:"removal"`
	VerifyRemoval StringArray `json:"verify_removal"`
	AVS           StringArray `json:"avs"`
}

func GetMasterDataWithAvs() (*MasterDataResponse, error) {
	var data MasterData
	err := config.DB.First(&data).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// Create default master data if not found
		data = MasterData{
			Zip:           StringArray{},
			Conversion:    StringArray{},
			Removal:       StringArray{},
			VerifyRemoval: StringArray{},
		}
		if err := config.DB.Create(&data).Error; err != nil {
			return nil, err
		}
	}

	var avs []AV
	if err := config.DB.Find(&avs).Error; err != nil {
		return nil, err
	}
	// map av with name to string array
	avNames := make(StringArray, len(avs))
	for i, av := range avs {
		avNames[i] = av.Name
	}
	return &MasterDataResponse{
		Zip:           data.Zip,
		Conversion:    data.Conversion,
		Removal:       data.Removal,
		VerifyRemoval: data.VerifyRemoval,
		AVS:           avNames,
	}, err
}

func GetMasterData() (*MasterData, error) {
	var data MasterData
	err := config.DB.First(&data).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// Create default master data if not found
		data = MasterData{
			Zip:           StringArray{},
			Conversion:    StringArray{},
			Removal:       StringArray{},
			VerifyRemoval: StringArray{},
		}
		if err := config.DB.Create(&data).Error; err != nil {
			return nil, err
		}
	}
	return &data, err
}

func GetAllMasterData() ([]MasterData, error) {
	var masterData []MasterData
	err := config.DB.Find(&masterData).Error
	return masterData, err
}

func GetMasterDataByID(id uint) (*MasterData, error) {
	var masterData MasterData
	err := config.DB.First(&masterData, id).Error
	if err != nil {
		return nil, err
	}
	return &masterData, nil
}

// Add unique options to a column
func (m *MasterData) AddOptions(column string, values []string) error {
	switch column {
	case "zip":
		m.Zip = appendUniqueStringArray(m.Zip, values)
	case "conversion":
		m.Conversion = appendUniqueStringArray(m.Conversion, values)
	case "removal":
		m.Removal = appendUniqueStringArray(m.Removal, values)
	case "verify_removal":
		m.VerifyRemoval = appendUniqueStringArray(m.VerifyRemoval, values)
	default:
		return errors.New("invalid column name")
	}
	return config.DB.Save(m).Error
}

// Remove values from a column
func (m *MasterData) RemoveOptions(column string, values []string) error {
	switch column {
	case "zip":
		m.Zip = removeValuesStringArray(m.Zip, values)
	case "conversion":
		m.Conversion = removeValuesStringArray(m.Conversion, values)
	case "removal":
		m.Removal = removeValuesStringArray(m.Removal, values)
	case "verify_removal":
		m.VerifyRemoval = removeValuesStringArray(m.VerifyRemoval, values)
	default:
		return errors.New("invalid column name")
	}
	return config.DB.Save(m).Error
}

// Helpers for StringArray
func appendUniqueStringArray(existing StringArray, newValues []string) StringArray {
	existingMap := make(map[string]bool)
	for _, v := range existing {
		existingMap[v] = true
	}
	result := existing
	for _, v := range newValues {
		if !existingMap[v] {
			result = append(result, v)
		}
	}
	return result
}

func removeValuesStringArray(existing StringArray, toRemove []string) StringArray {
	removeMap := make(map[string]bool)
	for _, v := range toRemove {
		removeMap[v] = true
	}
	var result StringArray
	for _, v := range existing {
		if !removeMap[v] {
			result = append(result, v)
		}
	}
	return result
}
