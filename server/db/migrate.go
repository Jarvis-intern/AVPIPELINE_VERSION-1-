package db

import (
	"gitlab.com/magnetite1/av-pipeline/server/config"
	"gitlab.com/magnetite1/av-pipeline/server/models"
	"gorm.io/gorm"
)

// Migrate runs database migrations for all models
func Migrate() error {
	return config.DB.AutoMigrate(
		&models.User{},
		&models.Stage{},
		&models.AV{},
		&models.Task{},
		&models.TaskDetails{},
		&models.ScanDetails{},
		&models.MasterData{},
		&models.TaskProgress{},
		&models.Conversion{},
	)
}

// SetupForeignKeys sets up foreign key constraints
func SetupForeignKeys() error {
	db := config.DB

	// Helper function to check if constraint exists
	constraintExists := func(tableName, constraintName string) bool {
		var count int64
		db.Raw("SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_name = ? AND constraint_name = ?", tableName, constraintName).Scan(&count)
		return count > 0
	}

	// Task foreign keys
	if !constraintExists("tasks", "fk_task_user") {
		db.Exec("ALTER TABLE tasks ADD CONSTRAINT fk_task_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE")
	}

	// TaskDetails foreign keys
	if !constraintExists("task_details", "fk_task_details_task") {
		db.Exec("ALTER TABLE task_details ADD CONSTRAINT fk_task_details_task FOREIGN KEY (task_id) REFERENCES tasks(unique_id) ON DELETE CASCADE")
	}
	if !constraintExists("task_details", "fk_task_details_verifier") {
		db.Exec("ALTER TABLE task_details ADD CONSTRAINT fk_task_details_verifier FOREIGN KEY (verified_by) REFERENCES users(id)")
	}
	if !constraintExists("task_details", "fk_task_details_av") {
		db.Exec("ALTER TABLE task_details ADD CONSTRAINT fk_task_details_av FOREIGN KEY (av_id) REFERENCES avs(id)")
	}

	// ScanDetails foreign keys
	if !constraintExists("scan_details", "fk_scan_details_task") {
		db.Exec("ALTER TABLE scan_details ADD CONSTRAINT fk_scan_details_task FOREIGN KEY (task_id) REFERENCES tasks(unique_id) ON DELETE CASCADE")
	}
	if !constraintExists("scan_details", "fk_scan_details_av") {
		db.Exec("ALTER TABLE scan_details ADD CONSTRAINT fk_scan_details_av FOREIGN KEY (av_id) REFERENCES avs(id)")
	}

	return nil
}

// CreateIndexes creates database indexes for better performance
func CreateIndexes() error {
	db := config.DB

	// Task indexes
	db.Exec("CREATE INDEX IF NOT EXISTS idx_task_unique_id ON tasks(unique_id)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_task_user_id ON tasks(user_id)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_task_system_ip ON tasks(system_ip)")

	// TaskDetails indexes
	db.Exec("CREATE INDEX IF NOT EXISTS idx_task_details_task_id ON task_details(task_id)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_task_details_verified_by ON task_details(verified_by)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_task_details_av_id ON task_details(av_id)")

	// ScanDetails indexes
	db.Exec("CREATE INDEX IF NOT EXISTS idx_scan_details_task_id ON scan_details(task_id)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_scan_details_av_id ON scan_details(av_id)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_scan_details_time_init ON scan_details(time_of_initialisation)")

	// AV indexes
	db.Exec("CREATE INDEX IF NOT EXISTS idx_av_name ON avs(name)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_av_ip_address ON avs(ip_address)")
	db.Exec("CREATE INDEX IF NOT EXISTS idx_av_active ON avs(active)")

	// User indexes
	db.Exec("CREATE INDEX IF NOT EXISTS idx_user_name ON \"users\"(name)")

	return nil
}

// InitializeDatabase sets up the database with migrations, foreign keys, and indexes
func InitializeDatabase() error {
	// Run migrations
	if err := Migrate(); err != nil {
		return err
	}

	// Clean up any malformed array data
	if err := CleanupMasterDataArrays(); err != nil {
		return err
	}

	// Set up foreign keys
	if err := SetupForeignKeys(); err != nil {
		return err
	}

	// Create indexes
	if err := CreateIndexes(); err != nil {
		return err
	}

	return nil
}

// DropAllTables drops all tables (use with caution!)
func DropAllTables() error {
	db := config.DB

	// Drop tables in reverse order to avoid foreign key constraints
	tables := []string{
		"scan_details",
		"task_details",
		"tasks",
		"master_data",
		"avs",
		"stages",
	}

	for _, table := range tables {
		if err := db.Exec("DROP TABLE IF EXISTS " + table + " CASCADE").Error; err != nil {
			return err
		}
	}

	return nil
}

// SeedData inserts initial data into the database
func SeedData() error {
	db := config.DB

	// Seed default user
	var userCount int64
	db.Model(&models.User{}).Count(&userCount)
	if userCount == 0 {
		db.Create(&models.User{Name: "admin"})
	}

	// Seed stages
	stages := []models.Stage{
		{ID: 1, Name: "Extraction"},
		{ID: 2, Name: "Conversion"},
		{ID: 3, Name: "Removal"},
		{ID: 4, Name: "Verification"},
		{ID: 5, Name: "Verify Removal"},
		{ID: 6, Name: "AV Scan"},
	}

	for _, stage := range stages {
		var existingStage models.Stage
		if err := db.Where("id = ?", stage.ID).First(&existingStage).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				if err := db.Create(&stage).Error; err != nil {
					return err
				}
			}
		}
	}

	// Seed default master data - matches Python model structure
	var masterData models.MasterData
	if err := db.First(&masterData).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			// Create master data using raw SQL to ensure proper array format
			err := db.Exec(`
				INSERT INTO master_data (zip, conversion, removal, verify_removal)
				VALUES (
					ARRAY['rar', 'zip', '7zip', 'tgz', 'gz', 'ace', 'r00', 'tar', 'lzh', 'z', 'arj', 'veracrypt'],
					ARRAY['eml', 'msg', 'mbox', 'pst'],
					ARRAY['exe', 'emp', 'bat', 'dat', 'jar', 'apk', 'iso', 'zdat', 'meta', 'xlsm', 'xltm', 'pptm', 'vb', 'msi', 'dll', 'db', 'err', 'bak', 'docm', 'p7s', 'bin', 'cmd', 'ini', 'js', 'ps1', 'pyc', 'run', 'scr', 'nxe', 'ps', 'sct', 'cpp', 'c', 'css', 'obj', 'php', 'r', 'rb', 'rpy', 'cc', 'hh', 'psd1', 'class', 'lnk', 'lcxz', 'vbs', 'cab', 'chm', 'tgs', 'tmp'],
					ARRAY['eml', 'msg', 'mbox', 'pst']
				)
			`).Error
			if err != nil {
				return err
			}
		}
	}

	return nil
}

// CleanupMasterDataArrays fixes any malformed array data in master_data table
func CleanupMasterDataArrays() error {
	db := config.DB

	// Check if master_data table exists
	var count int64
	db.Raw("SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'master_data'").Scan(&count)
	if count == 0 {
		return nil // Table doesn't exist, nothing to clean
	}

	// Get all master_data records
	var masterDataRecords []models.MasterData
	if err := db.Find(&masterDataRecords).Error; err != nil {
		return err
	}

	// If no records exist, create default one
	if len(masterDataRecords) == 0 {
		return SeedData()
	}

	// Clean up each record
	for _, record := range masterDataRecords {
		// Try to read the record again to trigger the new parsing logic
		var cleanRecord models.MasterData
		if err := db.First(&cleanRecord, record.ID).Error; err != nil {
			// If reading fails, recreate with default values
			cleanRecord = models.MasterData{
				ID:            record.ID,
				Zip:           models.StringArray{"rar", "zip", "7zip", "tgz", "gz", "ace", "r00", "tar", "lzh", "z", "arj", "veracrypt"},
				Conversion:    models.StringArray{"eml", "msg", "mbox", "pst", "word"},
				Removal:       models.StringArray{"exe", "emp", "bat", "dat", "jar", "apk", "iso", "zdat", "meta", "xlsm", "xltm", "pptm", "vb", "msi", "dll", "db", "err", "bak", "docm", "p7s", "bin", "cmd", "ini", "js", "ps1", "pyc", "run", "scr", "nxe", "ps", "sct", "cpp", "c", "css", "obj", "php", "r", "rb", "rpy", "cc", "hh", "psd1", "class", "lnk", "lcxz", "vbs", "cab", "chm", "tgs"},
				VerifyRemoval: models.StringArray{"eml", "msg", "mbox", "pst", "word"},
			}
			if err := db.Save(&cleanRecord).Error; err != nil {
				return err
			}
		}
	}

	return nil
}
