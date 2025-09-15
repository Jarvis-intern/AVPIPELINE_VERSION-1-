package handlers

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"gitlab.com/magnetite1/av-pipeline/server/sockets"
)

// ExtractionTask represents an extraction task
type ExtractionTask struct {
	FolderPath     string            `json:"folder_path"`
	CurrentArchive string            `json:"current_archive,omitempty"`
	Password       string            `json:"password,omitempty"`
	Passwords      map[string]string `json:"passwords,omitempty"`
	TaskID         string            `json:"task_id,omitempty"`
	OutputPath     string            `json:"output_path,omitempty"`
}

// ExtractionResult represents the result of an extraction operation
type ExtractionResult struct {
	Success          bool     `json:"success"`
	Message          string   `json:"message"`
	TotalFiles       int      `json:"total_files"`
	ProcessedFiles   int      `json:"processed_files"`
	TotalSize        int64    `json:"total_size"`
	ProcessedSize    int64    `json:"processed_size"`
	ExtractedFiles   []string `json:"extracted_files"`
	FailedFiles      []string `json:"failed_files"`
	PasswordRequired bool     `json:"password_required,omitempty"`
	RequiredArchive  string   `json:"required_archive,omitempty"`
}

// ExtractionService handles archive extraction operations
type ExtractionService struct {
	activeExtractions map[string]*ExtractionSession
	mutex             sync.RWMutex
}

// ExtractionSession represents an active extraction session
type ExtractionSession struct {
	TaskID         string
	FolderPath     string
	Archives       []string
	CurrentIndex   int
	ProcessedFiles int
	ProcessedSize  int64
	TotalFiles     int
	TotalSize      int64
	StartTime      time.Time
	UserID         string
}

// NewExtractionService creates a new extraction service
func NewExtractionService() *ExtractionService {
	return &ExtractionService{
		activeExtractions: make(map[string]*ExtractionSession),
	}
}

// Supported archive formats and their extensions
var SupportedArchiveFormats = map[string]bool{
	".zip":     true,
	".rar":     true,
	".7z":      true,
	".tar":     true,
	".tar.gz":  true,
	".tgz":     true,
	".tar.bz2": true,
	".tar.xz":  true,
	".txz":     true,
	".gz":      true,
	".ace":     true,
	".arj":     true,
	".lzh":     true,
	".z":       true,
	".r00":     true,
	".arc":     true,
}

// ArchiveHandler represents a function that can extract an archive
type ArchiveHandler func(archivePath, password, extractTo string) (bool, string)

// GetArchiveHandler returns the appropriate handler for an archive extension
func GetArchiveHandler(ext string) ArchiveHandler {
	switch strings.ToLower(ext) {
	case ".zip":
		return handleZip
	case ".tar", ".tar.gz", ".tgz", ".tar.bz2", ".tar.xz", ".txz":
		return handleTar
	case ".gz":
		return handleGz
	case ".rar":
		return handleRar
	case ".7z":
		return handle7z
	case ".ace":
		return handleAce
	case ".arj":
		return handleArj
	case ".lzh":
		return handleLzh
	case ".z":
		return handleCompress
	case ".r00":
		return handleRarMultipart
	case ".arc":
		return handleArc
	default:
		return nil
	}
}

// StartExtractionWithWebSocket starts extraction with WebSocket integration
func (es *ExtractionService) StartExtractionWithWebSocket(task ExtractionTask, userID string) {
	// Create extraction session
	session := &ExtractionSession{
		TaskID:     task.TaskID,
		FolderPath: task.FolderPath,
		StartTime:  time.Now(),
		UserID:     userID,
	}

	// Store session
	es.mutex.Lock()
	es.activeExtractions[userID] = session
	es.mutex.Unlock()

	// First, discover archive files
	archives, err := es.findArchiveFiles(task.FolderPath)
	if err != nil {
		es.emitError(session.UserID, task.TaskID, fmt.Sprintf("Error scanning folder: %v", err))
		SignalStageComplete(task.TaskID, "EXTRACTION")
		return
	}

	if len(archives) == 0 {
		// Emit extraction_complete as a normal completion (not error)
		sockets.EmitToUser(session.UserID, "extraction_complete", map[string]any{
			"task_id":         task.TaskID,
			"message":         "No supported archive files found",
			"total_files":     0,
			"processed_files": 0,
			"total_size":      0,
			"processed_size":  0,
			"extracted_files": []string{},
			"failed_files":    []string{},
			"end_time":        time.Now().Format(time.RFC3339),
		})
		// Update progress in DB for completion (array-based)
		finalProgress := map[string]interface{}{
			"type":           "EXTRACTION",
			"status":         "DONE",
			"progress":       100,
			"currentFile":    nil,
			"currFileNumber": 0,
			"filesCount":     0,
			"message":        "No supported archive files found",
			"end_time":       time.Now().Format(time.RFC3339),
		}
		UpdateStageProgressArray(task.TaskID, "EXTRACTION", finalProgress)
		SignalStageComplete(task.TaskID, "EXTRACTION")
		return
	}

	// Prepare file information for frontend
	var files []map[string]interface{}
	for _, archive := range archives {
		// Since findArchiveFiles now returns full paths, we just need the base name for the UI
		archiveName := filepath.Base(archive)
		info, err := os.Stat(archive)
		if err != nil {
			continue
		}

		// Don't assume password requirement - let user decide
		files = append(files, map[string]interface{}{
			"name": archiveName,
			"size": info.Size(),
		})
	}

	// Emit files discovered event
	sockets.EmitToUser(session.UserID, "extraction_files_discovered", map[string]interface{}{
		"task_id": task.TaskID,
		"files":   files,
	})

	// Update progress in DB (waiting for passwords)
	progress := map[string]interface{}{
		"type":           "EXTRACTION",
		"status":         "PENDING",
		"progress":       0,
		"currentFile":    nil,
		"currFileNumber": 0,
		"filesCount":     len(files),
		"message":        "Waiting for passwords",
	}
	UpdateStageProgressArray(task.TaskID, "EXTRACTION", progress)
}

// StartExtractionWithPasswords starts extraction with provided passwords
func (es *ExtractionService) StartExtractionWithPasswords(task ExtractionTask, userID string) {
	session := &ExtractionSession{
		TaskID:     task.TaskID,
		FolderPath: task.FolderPath,
		StartTime:  time.Now(),
		UserID:     userID,
	}

	es.mutex.Lock()
	es.activeExtractions[userID] = session
	es.mutex.Unlock()

	archives, err := es.findArchiveFiles(task.FolderPath)
	if err != nil {
		es.emitError(session.UserID, task.TaskID, fmt.Sprintf("Error scanning folder: %v", err))
		SignalStageComplete(task.TaskID, "EXTRACTION")
		return
	}

	if len(archives) == 0 {
		sockets.EmitToUser(session.UserID, "extraction_complete", map[string]any{
			"task_id":         task.TaskID,
			"message":         "No supported archive files found",
			"total_files":     0,
			"processed_files": 0,
			"extracted_files": []string{},
			"failed_files":    []string{},
			"end_time":        time.Now().Format(time.RFC3339),
		})
		finalProgress := map[string]interface{}{
			"type":    "EXTRACTION",
			"status":  "DONE",
			"message": "No supported archive files found",
		}
		UpdateStageProgressArray(task.TaskID, "EXTRACTION", finalProgress)
		SignalStageComplete(task.TaskID, "EXTRACTION")
		return
	}

	es.processExtractionRecursively(task, session, archives)

	es.mutex.Lock()
	delete(es.activeExtractions, userID)
	es.mutex.Unlock()
}

// processExtractionRecursively processes archives and scans for nested archives to extract.
func (es *ExtractionService) processExtractionRecursively(task ExtractionTask, session *ExtractionSession, initialArchives []string) *ExtractionResult {
	// The initialArchives list already contains full paths from our new findArchiveFiles function.
	workQueue := initialArchives

	var allExtractedFiles []string
	var allFailedFiles []string
	// Track if any archive still requires a password so we don't mark the stage complete prematurely
	needsPasswords := false
	var requiredArchives []string
	totalDiscovered := len(workQueue)
	processedCount := 0

	for len(workQueue) > 0 {
		archivePath := workQueue[0]
		workQueue = workQueue[1:]

		archiveName := filepath.Base(archivePath)
		currentDirectory := filepath.Dir(archivePath)

		log.Printf("Processing archive: %s", archivePath)

		baseName := strings.TrimSuffix(archiveName, filepath.Ext(archiveName))
		extractTo := filepath.Join(currentDirectory, baseName+"_extracted")

		if err := os.MkdirAll(extractTo, 0755); err != nil {
			log.Printf("Error: Failed to create extraction directory '%s': %v", extractTo, err)
			allFailedFiles = append(allFailedFiles, archiveName)
			continue
		}

		ext := strings.ToLower(filepath.Ext(archiveName))
		if strings.HasSuffix(strings.ToLower(archiveName), ".tar.gz") {
			ext = ".tar.gz"
		} else if strings.HasSuffix(strings.ToLower(archiveName), ".tar.xz") {
			ext = ".tar.xz"
		}

		handler := GetArchiveHandler(ext)
		if handler == nil {
			log.Printf("Error: Unsupported archive format: %s", archiveName)
			allFailedFiles = append(allFailedFiles, archiveName)
			continue
		}

		// Normalize lookup keys: exact base, lowercase base
		lowerBase := strings.ToLower(archiveName)
		password := ""
		if pw, ok := task.Passwords[archiveName]; ok {
			password = strings.TrimSpace(pw)
		} else if pw, ok := task.Passwords[lowerBase]; ok {
			password = strings.TrimSpace(pw)
		}
		if password == "" {
			log.Printf("Archive %s: no password supplied from UI", archiveName)
		} else {
			log.Printf("Archive %s: using password supplied from UI (masked)", archiveName)
		}
		sockets.EmitToUser(session.UserID, "extraction_progress", map[string]any{
			"task_id":          task.TaskID,
			"current_archive":  archiveName,
			"message":          fmt.Sprintf("Starting extraction for %s", archiveName),
			"processed_count":  processedCount,
			"total_discovered": totalDiscovered,
			"status":           "RUNNING",
		})

		success, message := handler(archivePath, password, extractTo)
		processedCount++

		// Check if extraction produced any files (empty folder = likely failure)
		extractedFiles, _ := os.ReadDir(extractTo)
		if success && len(extractedFiles) == 0 {
			success = false
			message = "Extraction produced no files. Possibly wrong password or corrupted archive."
		}

		if success {
			log.Printf("Successfully extracted: %s", archiveName)
			allExtractedFiles = append(allExtractedFiles, archiveName)

			log.Printf("Scanning for nested archives in: %s", extractTo)
			nestedArchives, err := es.findArchiveFiles(extractTo)
			if err != nil {
				log.Printf("Error scanning nested directory %s: %v", extractTo, err)
			} else if len(nestedArchives) > 0 {
				log.Printf("Found %d nested archives, adding to queue.", len(nestedArchives))
				for _, nestedArchive := range nestedArchives {
					workQueue = append(workQueue, nestedArchive)
				}
				totalDiscovered += len(nestedArchives)
			}
		} else {
			log.Printf("Failed to extract: %s. Reason: %s", archiveName, message)
			allFailedFiles = append(allFailedFiles, archiveName)
			// Always emit password required if message indicates password issue or empty output
			if message == "password_required" ||
				strings.Contains(strings.ToLower(message), "password") ||
				strings.Contains(strings.ToLower(message), "encrypted") {
				es.emitPasswordRequired(session.UserID, task.TaskID, archiveName)
				needsPasswords = true
				requiredArchives = append(requiredArchives, archiveName)
			}
		}

		sockets.EmitToUser(session.UserID, "extraction_progress", map[string]any{
			"task_id":          task.TaskID,
			"current_archive":  archiveName,
			"success":          success,
			"message":          message,
			"processed_count":  processedCount,
			"total_discovered": totalDiscovered,
			"status":           "RUNNING",
		})
	}

	// If any archives still require passwords, don't mark the stage as complete.
	if needsPasswords {
		waitMsg := fmt.Sprintf("Waiting for passwords for %d archive(s)", len(requiredArchives))
		sockets.EmitToUser(session.UserID, "extraction_waiting_for_passwords", map[string]any{
			"task_id":           task.TaskID,
			"message":           waitMsg,
			"required_archives": requiredArchives,
			"total_files":       totalDiscovered,
			"processed_files":   processedCount,
			"extracted_files":   allExtractedFiles,
			"failed_files":      allFailedFiles,
			"time":              time.Now().Format(time.RFC3339),
		})
		pendingProgress := map[string]interface{}{
			"type":           "EXTRACTION",
			"status":         "PENDING",
			"progress":       0,
			"currentFile":    nil,
			"currFileNumber": processedCount,
			"filesCount":     totalDiscovered,
			"message":        waitMsg,
		}
		UpdateStageProgressArray(task.TaskID, "EXTRACTION", pendingProgress)
		// Do not SignalStageComplete here; wait for the user to provide passwords and re-trigger extraction
	} else {
		completionMessage := fmt.Sprintf("Recursive extraction complete. Extracted: %d, Failed: %d.", len(allExtractedFiles), len(allFailedFiles))
		log.Println(completionMessage)

		sockets.EmitToUser(session.UserID, "extraction_complete", map[string]any{
			"task_id":         task.TaskID,
			"message":         completionMessage,
			"total_files":     totalDiscovered,
			"processed_files": processedCount,
			"extracted_files": allExtractedFiles,
			"failed_files":    allFailedFiles,
			"end_time":        time.Now().Format(time.RFC3339),
		})

		finalProgress := map[string]interface{}{
			"type":     "EXTRACTION",
			"status":   "DONE",
			"progress": 100,
			"message":  completionMessage,
			"end_time": time.Now().Format(time.RFC3339),
		}
		UpdateStageProgressArray(task.TaskID, "EXTRACTION", finalProgress)
		SignalStageComplete(task.TaskID, "EXTRACTION")
	}

	// Return a summary. Success only if everything extracted and no passwords pending.
	summaryMsg := fmt.Sprintf("Recursive extraction complete. Extracted: %d, Failed: %d.", len(allExtractedFiles), len(allFailedFiles))
	if needsPasswords {
		summaryMsg = fmt.Sprintf("%s Waiting for passwords for %d archive(s).", summaryMsg, len(requiredArchives))
	}
	return &ExtractionResult{
		Success:        !needsPasswords && len(allFailedFiles) == 0,
		Message:        summaryMsg,
		TotalFiles:     totalDiscovered,
		ProcessedFiles: processedCount,
		ExtractedFiles: allExtractedFiles,
		FailedFiles:    allFailedFiles,
	}
}

// processExtractionWithPasswords is the original non-recursive version. It is kept for reference.
func (es *ExtractionService) processExtractionWithPasswords(task ExtractionTask, session *ExtractionSession, archives []string) *ExtractionResult {
	// ... (original non-recursive code is unchanged) ...
	totalSize := int64(0)
	for _, archive := range archives {
		if info, err := os.Stat(filepath.Join(task.FolderPath, archive)); err == nil {
			totalSize += info.Size()
		}
	}
	session.Archives = archives
	session.TotalFiles = len(archives)
	session.TotalSize = totalSize
	result := &ExtractionResult{
		Success:        true,
		TotalFiles:     len(archives),
		TotalSize:      totalSize,
		ExtractedFiles: []string{},
		FailedFiles:    []string{},
	}
	for i, archive := range archives {
		session.CurrentIndex = i
		archivePath := filepath.Join(task.FolderPath, archive)
		sockets.EmitToUser(session.UserID, "extraction_archive_started", map[string]any{
			"task_id":         task.TaskID,
			"archive":         archive,
			"current_index":   i + 1,
			"total_files":     len(archives),
			"processed_files": session.ProcessedFiles,
			"processed_size":  session.ProcessedSize,
			"total_size":      totalSize,
		})
		extractTo := filepath.Join(task.FolderPath, strings.TrimSuffix(archive, filepath.Ext(archive)))
		if err := os.MkdirAll(extractTo, 0755); err != nil {
			log.Printf("Error: Failed to create extraction directory: %v", err)
			result.FailedFiles = append(result.FailedFiles, archive)
			continue
		}
		ext := strings.ToLower(filepath.Ext(archive))
		if ext == ".gz" && strings.HasSuffix(strings.ToLower(archive), ".tar.gz") {
			ext = ".tar.gz"
		} else if ext == ".xz" && strings.HasSuffix(strings.ToLower(archive), ".tar.xz") {
			ext = ".tar.xz"
		}
		handler := GetArchiveHandler(ext)
		if handler == nil {
			log.Printf("Error: Unsupported archive format: %s", archive)
			result.FailedFiles = append(result.FailedFiles, archive)
			es.emitProgress(session, archive, false, fmt.Sprintf("Unsupported format: %s", ext))
			continue
		}
		password := task.Passwords[archive]
		success, message := handler(archivePath, password, extractTo)
		if success {
			result.ProcessedFiles++
			if info, err := os.Stat(archivePath); err == nil {
				result.ProcessedSize += info.Size()
				session.ProcessedSize += info.Size()
			}
			session.ProcessedFiles++
			result.ExtractedFiles = append(result.ExtractedFiles, archive)
			es.emitProgress(session, archive, true, message)
			sockets.EmitToUser(session.UserID, "extraction_archive_complete", map[string]any{
				"task_id":         task.TaskID,
				"archive":         archive,
				"current_index":   i + 1,
				"total_files":     len(archives),
				"processed_files": session.ProcessedFiles,
				"processed_size":  session.ProcessedSize,
				"total_size":      totalSize,
				"success":         true,
				"message":         message,
			})
			progress := map[string]interface{}{
				"type":           "EXTRACTION",
				"status":         "RUNNING",
				"progress":       int(float64(session.ProcessedFiles) / float64(len(archives)) * 100),
				"currentFile":    archive,
				"currFileNumber": session.ProcessedFiles,
				"filesCount":     len(archives),
				"message":        message,
			}
			UpdateStageProgressArray(task.TaskID, "EXTRACTION", progress)
		} else if message == "password_required" {
			es.emitPasswordRequired(session.UserID, task.TaskID, archive)
			result.FailedFiles = append(result.FailedFiles, archive)
			es.emitProgress(session, archive, false, "Password required for this archive. Please provide password to continue.")
			sockets.EmitToUser(session.UserID, "extraction_archive_complete", map[string]any{
				"task_id":         task.TaskID,
				"archive":         archive,
				"current_index":   i + 1,
				"total_files":     len(archives),
				"processed_files": session.ProcessedFiles,
				"processed_size":  session.ProcessedSize,
				"total_size":      totalSize,
				"success":         false,
				"message":         "Password required for this archive. Please provide password to continue.",
			})
		} else {
			result.FailedFiles = append(result.FailedFiles, archive)
			es.emitProgress(session, archive, false, message)
			sockets.EmitToUser(session.UserID, "extraction_archive_complete", map[string]any{
				"task_id":         task.TaskID,
				"archive":         archive,
				"current_index":   i + 1,
				"total_files":     len(archives),
				"processed_files": session.ProcessedFiles,
				"processed_size":  session.ProcessedSize,
				"total_size":      totalSize,
				"success":         false,
				"message":         message,
			})
		}
	}
	completionMessage := "Extraction completed successfully"
	if len(result.FailedFiles) > 0 {
		completionMessage = fmt.Sprintf("Extraction completed with %d failed files", len(result.FailedFiles))
	}
	sockets.EmitToUser(session.UserID, "extraction_complete", map[string]any{
		"task_id":         task.TaskID,
		"message":         completionMessage,
		"total_files":     result.TotalFiles,
		"processed_files": result.ProcessedFiles,
		"total_size":      result.TotalSize,
		"processed_size":  result.ProcessedSize,
		"extracted_files": result.ExtractedFiles,
		"failed_files":    result.FailedFiles,
		"end_time":        time.Now().Format(time.RFC3339),
	})
	finalProgress := map[string]interface{}{
		"type":           "EXTRACTION",
		"status":         "DONE",
		"progress":       100,
		"currentFile":    nil,
		"currFileNumber": result.ProcessedFiles,
		"filesCount":     result.TotalFiles,
		"message":        completionMessage,
		"end_time":       time.Now().Format(time.RFC3339),
	}
	UpdateStageProgressArray(task.TaskID, "EXTRACTION", finalProgress)
	SignalStageComplete(task.TaskID, "EXTRACTION")
	return result
}

// --- THIS FUNCTION IS NOW RECURSIVE ---
// findArchiveFiles recursively scans a directory for supported archive files and returns their full paths.
func (es *ExtractionService) findArchiveFiles(folderPath string) ([]string, error) {
	var archives []string

	// filepath.Walk is the standard Go way to recursively process a directory tree.
	err := filepath.Walk(folderPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err // Propagate errors from walking the directory.
		}

		// Skip directories, we only care about files.
		if info.IsDir() {
			return nil
		}

		filename := info.Name()
		ext := strings.ToLower(filepath.Ext(filename))

		// Handle compound extensions
		if strings.HasSuffix(strings.ToLower(filename), ".tar.gz") {
			ext = ".tar.gz"
		} else if strings.HasSuffix(strings.ToLower(filename), ".tar.xz") {
			ext = ".tar.xz"
		} else if strings.HasSuffix(strings.ToLower(filename), ".tar.bz2") {
			ext = ".tar.bz2"
		} else if strings.HasSuffix(strings.ToLower(filename), ".tgz") {
			ext = ".tgz"
		} else if strings.HasSuffix(strings.ToLower(filename), ".txz") {
			ext = ".txz"
		}

		if SupportedArchiveFormats[ext] {
			// Add the full path of the archive to our list.
			archives = append(archives, path)
		}

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to walk directory %s: %w", folderPath, err)
	}

	return archives, nil
}

// (The rest of the file is unchanged)

// emitError sends an error event via WebSocket
func (es *ExtractionService) emitError(userID, taskID, message string) {
	sockets.EmitToUser(userID, "extraction_error", map[string]any{
		"task_id": taskID,
		"error":   message,
	})
}

// emitProgress sends a progress event via WebSocket
func (es *ExtractionService) emitProgress(session *ExtractionSession, archive string, success bool, message string) {
	progress := float64(session.CurrentIndex+1) / float64(session.TotalFiles) * 100

	sockets.EmitToUser(session.UserID, "extraction_progress", map[string]any{
		"task_id":         session.TaskID,
		"archive":         archive,
		"success":         success,
		"message":         message,
		"current_index":   session.CurrentIndex + 1,
		"total_files":     session.TotalFiles,
		"processed_files": session.ProcessedFiles,
		"processed_size":  session.ProcessedSize,
		"total_size":      session.TotalSize,
		"progress":        progress,
	})
}

// emitPasswordRequired sends a password required event via WebSocket
func (es *ExtractionService) emitPasswordRequired(userID, taskID, archive string) {
	sockets.EmitToUser(userID, "extraction_password_required", map[string]any{
		"task_id": taskID,
		"archive": archive,
	})
}

// Archive handler implementations

func HandleZipInteractive(archivePath, password, extractTo string, maxPrompts int) (bool, string) {
	ok, msg := handleZip(archivePath, password, extractTo)
	if ok || msg != "password_required" || password != "" {
		return ok, msg
	}
	for i := 0; i < maxPrompts; i++ {
		pw, err := promptForPassword(archivePath, i+1, maxPrompts)
		if err != nil {
			return false, fmt.Sprintf("password read error: %v", err)
		}
		if pw == "" {
			return false, "password_required"
		}
		ok, msg = handleZip(archivePath, pw, extractTo)
		if ok {
			return true, msg
		}
		if msg != "password_required" {
			return false, msg
		}
	}
	return false, "password_required"
}

func promptForPassword(archivePath string, attempt, max int) (string, error) {
	fmt.Fprintf(os.Stderr, "Password required to extract %s", filepath.Base(archivePath))
	if max > 1 {
		fmt.Fprintf(os.Stderr, " (attempt %d/%d)", attempt, max)
	}
	fmt.Fprint(os.Stderr, ": ")
	rd := bufio.NewReader(os.Stdin)
	pw, err := rd.ReadString('\n')
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(pw), nil
}

func handleZip(archivePath, password, extractTo string) (bool, string) {
	if err := os.MkdirAll(extractTo, 0755); err != nil {
		return false, fmt.Sprintf("create extract dir: %v", err)
	}

	// If a password is provided and 7z is available, first test the password to avoid false negatives
	if password != "" {
		if _, err := exec.LookPath("7z"); err == nil {
			okTest := test7zZipPassword(archivePath, password)
			if !okTest {
				// Wrong password; prompt immediately
				return false, "password_required"
			}
			// Password is valid, extract using 7z directly
			ok7, msg7 := try7zZip(archivePath, password, extractTo)
			if ok7 {
				return true, msg7
			}
			// If 7z failed for another reason, proceed to unzip fallback below
			_ = msg7
		}
	}

	// Prefer unzip when available
	if _, err := exec.LookPath("unzip"); err == nil {
		args := []string{"-o", "-q"}
		if password != "" {
			args = append(args, "-P", password)
		}
		args = append(args, archivePath, "-d", extractTo)
		tok, out, _ := runUnzip(args, extractTo, false)
		if tok {
			return true, fmt.Sprintf("Extracted %s using unzip", filepath.Base(archivePath))
		}
		low := strings.ToLower(out)
		// try disabling zip-bomb detection if that seems to be the error
		if strings.Contains(low, "zip bomb") ||
			strings.Contains(low, "overlapped components") ||
			strings.Contains(low, "unzip_disable_zipbomb_detection") {
			ok2, out2, _ := runUnzip(args, extractTo, true)
			if ok2 {
				return true, fmt.Sprintf("Extracted %s (zip-bomb check disabled)", filepath.Base(archivePath))
			}
			// fallthrough to 7z fallback
			_ = out2
		}
		// If unzip output suggests password issue OR is inconclusive, try 7z as a robust fallback (handles AES)
		if password != "" {
			ok7, msg7 := try7zZip(archivePath, password, extractTo)
			if ok7 {
				return true, msg7
			}
			// 7z may tell us wrong password precisely
			if strings.Contains(strings.ToLower(msg7), "wrong password") || strings.Contains(strings.ToLower(msg7), "incorrect password") {
				return false, "password_required"
			}
		}
		// No password provided or both tools failed; determine best error
		if strings.Contains(low, "password") || strings.Contains(low, "encrypted") || strings.Contains(low, "incorrect password") || isZipEncrypted(archivePath) {
			return false, "password_required"
		}
		return false, fmt.Sprintf("unzip error: %s", out)
	}

	// unzip not available: try 7z directly
	if password != "" {
		ok7, msg7 := try7zZip(archivePath, password, extractTo)
		if ok7 {
			return true, msg7
		}
		if strings.Contains(strings.ToLower(msg7), "wrong password") || strings.Contains(strings.ToLower(msg7), "incorrect password") {
			return false, "password_required"
		}
	} else {
		// even without password, attempt extraction (may succeed if not encrypted)
		ok7, msg7 := try7zZip(archivePath, "", extractTo)
		if ok7 {
			return true, msg7
		}
	}
	// If we reached here, 7z failed and either unzip is not present or failed too
	if isZipEncrypted(archivePath) {
		return false, "password_required"
	}
	return false, fmt.Sprintf("zip extraction failed: no suitable tool succeeded for %s", filepath.Base(archivePath))
}

// try7zZip extracts a zip using 7z, returning success and a message
func try7zZip(archivePath, password, extractTo string) (bool, string) {
	if _, err := exec.LookPath("7z"); err != nil {
		return false, "7z not installed"
	}
	args := []string{"x", "-y", "-o" + extractTo}
	if password != "" {
		args = append(args, "-p"+password)
	}
	args = append(args, archivePath)
	cmd := exec.Command("7z", args...)
	output, err := cmd.CombinedOutput()
	if err == nil {
		return true, fmt.Sprintf("Extracted %s using 7z", filepath.Base(archivePath))
	}
	out := strings.ToLower(string(output))
	log.Printf("7z extraction failed for %s: %s", filepath.Base(archivePath), string(output))
	if password != "" && (strings.Contains(out, "wrong password") || strings.Contains(out, "incorrect password") || strings.Contains(out, "data error") || strings.Contains(out, "crc failed")) {
		return false, "password_required"
	}
	return false, fmt.Sprintf("7z error: %s", string(output))
}

// test7zZipPassword rapidly tests if the provided password can open the archive using 7z (without extracting)
func test7zZipPassword(archivePath, password string) bool {
	if _, err := exec.LookPath("7z"); err != nil {
		return true // cannot test, assume ok and let extract handle it
	}
	args := []string{"t", archivePath}
	if password != "" {
		args = append(args, "-p"+password)
	}
	cmd := exec.Command("7z", args...)
	output, err := cmd.CombinedOutput()
	if err == nil {
		return true
	}
	out := strings.ToLower(string(output))
	// Only treat explicit wrong password signals as failure
	if strings.Contains(out, "wrong password") || strings.Contains(out, "incorrect password") || strings.Contains(out, "data error") || strings.Contains(out, "crc failed") {
		return false
	}
	return true
}

// isZipEncrypted attempts to detect whether a ZIP archive is encrypted by
// using zipinfo or 7z. Returns true if encryption is detected.
func isZipEncrypted(archivePath string) bool {
	// Try zipinfo -v
	if _, err := exec.LookPath("zipinfo"); err == nil {
		cmd := exec.Command("zipinfo", "-v", archivePath)
		output, err := cmd.CombinedOutput()
		if err == nil {
			low := strings.ToLower(string(output))
			if strings.Contains(low, "encrypted") || strings.Contains(low, "password") {
				return true
			}
		} else {
			low := strings.ToLower(string(output))
			if strings.Contains(low, "encrypted") || strings.Contains(low, "password") {
				return true
			}
		}
	}
	// Try 7z l -slt
	if _, err := exec.LookPath("7z"); err == nil {
		cmd := exec.Command("7z", "l", "-slt", archivePath)
		output, _ := cmd.CombinedOutput()
		low := strings.ToLower(string(output))
		// 7z prints lines like: "Encrypted = +" for encrypted entries
		if strings.Contains(low, "encrypted = +") || strings.Contains(low, "encrypted = yes") {
			return true
		}
	}
	return false
}

func runUnzip(args []string, workDir string, disableBomb bool) (bool, string, error) {
	cmd := exec.Command("unzip", args...)
	cmd.Dir = workDir
	if disableBomb {
		cmd.Env = append(os.Environ(), "UNZIP_DISABLE_ZIPBOMB_DETECTION=TRUE")
	}
	output, err := cmd.CombinedOutput()
	return err == nil, string(output), err
}

func handleTar(archivePath, password, extractTo string) (bool, string) {
	ext := strings.ToLower(filepath.Ext(archivePath))
	if strings.HasSuffix(strings.ToLower(archivePath), ".tar.gz") {
		ext = ".tar.gz"
	} else if strings.HasSuffix(strings.ToLower(archivePath), ".tar.xz") {
		ext = ".tar.xz"
	} else if strings.HasSuffix(strings.ToLower(archivePath), ".tar.bz2") {
		ext = ".tar.bz2"
	}
	if ext != ".tar" {
		decompressCmd := exec.Command("tar", "-xf", archivePath, "-C", extractTo)
		if output, err := decompressCmd.CombinedOutput(); err != nil {
			outputStr := strings.ToLower(string(output))
			if strings.Contains(outputStr, "password") || strings.Contains(outputStr, "encrypted") {
				return false, "password_required"
			}
			return false, fmt.Sprintf("tar error: %s", string(output))
		}
		return true, fmt.Sprintf("Extracted %s using tar", filepath.Base(archivePath))
	}
	cmd := exec.Command("tar", "-xf", archivePath, "-C", extractTo)
	if output, err := cmd.CombinedOutput(); err != nil {
		outputStr := strings.ToLower(string(output))
		if strings.Contains(outputStr, "password") || strings.Contains(outputStr, "encrypted") {
			return false, "password_required"
		}
		return false, fmt.Sprintf("tar error: %s", string(output))
	}
	return true, fmt.Sprintf("Extracted %s using tar", filepath.Base(archivePath))
}

func handleGz(archivePath, password, extractTo string) (bool, string) {
	return handleExternalTool(archivePath, extractTo, "gunzip", []string{"-c"})
}

func handleRar(archivePath, password, extractTo string) (bool, string) {
	args := []string{"x", "-y"}
	if password != "" {
		args = append(args, "-p"+password)
	}
	return handleExternalTool(archivePath, extractTo, "unrar", args)
}

func handle7z(archivePath, password, extractTo string) (bool, string) {
	args := []string{"x", "-y", "-o" + extractTo}
	if password != "" {
		args = append(args, "-p"+password)
	}
	return handleExternalTool(archivePath, extractTo, "7z", args)
}

func handleAce(archivePath, password, extractTo string) (bool, string) {
	return handleExternalTool(archivePath, extractTo, "unace", []string{"x", "-y"})
}

func handleArj(archivePath, password, extractTo string) (bool, string) {
	return handleExternalTool(archivePath, extractTo, "unarj", []string{"e"})
}

func handleLzh(archivePath, password, extractTo string) (bool, string) {
	return handleExternalTool(archivePath, extractTo, "lha", []string{"x"})
}
func handleCompress(archivePath, password, extractTo string) (bool, string) {
	return handleExternalTool(archivePath, extractTo, "uncompress", []string{"-c"})
}

func handleRarMultipart(archivePath, password, extractTo string) (bool, string) {
	args := []string{"x", "-y"}
	if password != "" {
		args = append(args, "-p"+password)
	}
	return handleExternalTool(archivePath, extractTo, "unrar", args)
}

func handleArc(archivePath, password, extractTo string) (bool, string) {
	tools := []struct {
		name string
		args []string
	}{
		{"arc", []string{"-x"}},
		{"unar", []string{"-o", extractTo}},
		{"7z", []string{"x", "-o" + extractTo, "-y", "-tarc"}},
		{"7z", []string{"x", "-o" + extractTo, "-y"}},
	}
	for _, tool := range tools {
		success, message := handleExternalTool(archivePath, extractTo, tool.name, tool.args)
		if success {
			return true, message
		}
	}
	return false, "Failed to extract .arc file. Please ensure you have either 'arc', 'unar', or '7z' installed."
}

func handleExternalTool(archivePath, extractTo, tool string, args []string) (bool, string) {
	if _, err := exec.LookPath(tool); err != nil {
		return false, fmt.Sprintf("%s tool not found. Please install %s to extract this archive type.", tool, tool)
	}
	cmdArgs := append(args, archivePath)
	if tool != "unzip" && tool != "7z" {
		cmdArgs = append(cmdArgs, extractTo)
	}
	cmd := exec.Command(tool, cmdArgs...)
	if tool == "unzip" || tool == "7z" {
		cmd.Dir = extractTo
	}
	output, err := cmd.CombinedOutput()
	if err != nil {
		outputStr := strings.ToLower(string(output))
		if strings.Contains(outputStr, "password") || strings.Contains(outputStr, "encrypted") {
			return false, "password_required"
		}
		return false, fmt.Sprintf("%s error: %s", tool, string(output))
	}
	return true, fmt.Sprintf("Extracted %s using %s", filepath.Base(archivePath), tool)
}
