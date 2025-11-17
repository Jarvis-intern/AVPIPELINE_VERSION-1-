package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"gitlab.com/magnetite1/av-pipeline/server/config"
	"gitlab.com/magnetite1/av-pipeline/server/models"
	"gitlab.com/magnetite1/av-pipeline/server/sockets"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// allow all origins or add your origin check logic
		return true
	},
}

func WebSocketHandler(c *gin.Context) {
	// Get user ID from query parameters for user-specific messaging
	userID := c.Query("user_id")
	systemIp := c.RemoteIP()

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("WebSocket upgrade failed:", err)
		return
	}

	client := &sockets.Client{
		ID:     uuid.New().String(),
		UserID: userID,
		Conn:   conn,
		Send:   make(chan []byte, 256), // buffered channel
	}

	// WebSocket connection established

	sockets.Hub.Register <- client

	// Send user ID assignment message (similar to Python's assigned_user_id)
	if userID == "" {
		userID = client.ID // Use client ID as fallback
		client.UserID = userID
	}

	// Send user ID assignment message using the websocket manager
	go func() {
		// Small delay to ensure client is registered in the hub
		time.Sleep(100 * time.Millisecond)

		sockets.EmitToUser(userID, "assigned_user_id", map[string]any{
			"user_id": userID,
		})
	}()

	// Start goroutines
	go readMessages(client, systemIp)
	go writeMessages(client)
}

func readMessages(client *sockets.Client, systemIp string) {
	defer func() {
		// Clean up on disconnect
		sockets.Hub.Unregister <- client
		client.Conn.Close()
	}()

	for {
		msgType, message, err := client.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket read error [%s]: %v", client.ID, err)
			}
			break
		}

		switch msgType {
		case websocket.TextMessage:
			// Parse the incoming message
			var wsMsg sockets.WebSocketMessage
			if err := json.Unmarshal(message, &wsMsg); err != nil {
				log.Printf("Error: Failed to parse WebSocket message from %s: %v", client.ID, err)
				continue
			}

			// Bind systemIp to wsMsg.Data
			if wsMsg.Data == nil {
				wsMsg.Data = make(map[string]any)
			}
			wsMsg.Data["system_ip"] = systemIp

			// Handle different event types
			switch wsMsg.Event {
			case "start_automation":
				Start_automation(client, wsMsg.Data)
			case "start_conversion":
				HandleStartConversion(client, wsMsg.Data)
			case "start_scanning":
				HandleScanning(client, wsMsg.Data)
			case "start_extraction":
				handleStartExtraction(client, wsMsg.Data)
			case "start_extraction_with_passwords":
				handleStartExtractionWithPasswords(client, wsMsg.Data)
			case "start_removal":
				HandleRemoveFiles(client, wsMsg.Data)
			case "start_verify_removal":
				HandleVerifyRemoveFiles(client, wsMsg.Data)
			case "organize_av_results":
				handleOrganizeAVResults(client, wsMsg.Data)
			case "proceed_verification":
				data := wsMsg.Data // already map[string]any
				taskID, _ := data["task_id"].(string)
				fmt.Println("Received proceed_verification for task:", taskID)
				// Mark verification as DONE in the progress array
				progress := map[string]interface{}{
					"type":     "VERIFICATION",
					"status":   "DONE",
					"progress": 100,
					"message":  "Verification complete",
					"end_time": time.Now().Format(time.RFC3339),
				}
				UpdateStageProgressArray(taskID, "VERIFICATION", progress)
				SignalStageComplete(taskID, "VERIFICATION")
			default:
				log.Printf("Error: Unknown event type: %s from client %s", wsMsg.Event, client.ID)
			}
		default:
			log.Printf("Error: Unsupported message type %d from %s", msgType, client.ID)
		}
	}
}

func writeMessages(client *sockets.Client) {
	for msg := range client.Send {
		err := client.Conn.WriteMessage(websocket.TextMessage, msg)
		if err != nil {
			log.Printf("Error: WebSocket write failed for client %s: %v", client.ID, err)
			break
		}
	}
}

// handleStartExtraction processes extraction requests via WebSocket
func handleStartExtraction(client *sockets.Client, data map[string]any) {
	// Extract folder path
	folderPath, ok := data["folder_path"].(string)
	if !ok || folderPath == "" {
		log.Printf("Error: Invalid folder_path in extraction request")
		sockets.EmitError(client, "Missing required field: folder_path", "extraction_error")
		return
	}

	// Extract optional parameters
	password, _ := data["password"].(string)
	taskID, _ := data["task_id"].(string)
	if taskID == "" {
		taskID = fmt.Sprintf("extract_%d", time.Now().Unix())
	}

	// Get user ID from client
	userID := client.UserID
	if userID == "" {
		log.Printf("Error: No user ID available for extraction")
		sockets.EmitError(client, "User ID not available", "extraction_error")
		return
	}

	// Create extraction task
	task := ExtractionTask{
		FolderPath: folderPath,
		Password:   password,
		TaskID:     taskID,
	}

	// Start extraction in a goroutine
	go func() {
		extractionService := NewExtractionService()
		extractionService.StartExtractionWithWebSocket(task, userID)
	}()
}

// handleStartExtractionWithPasswords processes extraction requests with passwords via WebSocket
func handleStartExtractionWithPasswords(client *sockets.Client, data map[string]any) {
	// Extract folder path
	folderPath, ok := data["folder_path"].(string)
	if !ok || folderPath == "" {
		log.Printf("Error: Invalid folder_path in extraction request")
		sockets.EmitError(client, "Missing required field: folder_path", "extraction_error")
		return
	}

	// Extract passwords map (trim and normalize keys to lowercase base names)
	passwordsInterface, _ := data["passwords"].(map[string]interface{})
	passwords := make(map[string]string)
	if len(passwordsInterface) != 0 {
		for key, value := range passwordsInterface {
			if strValue, ok := value.(string); ok {
				trimmed := strings.TrimSpace(strValue)
				base := filepath.Base(key)
				lower := strings.ToLower(base)
				passwords[base] = trimmed
				passwords[lower] = trimmed
			}
		}
	}

	// Extract task ID
	taskID, _ := data["task_id"].(string)
	if taskID == "" {
		taskID = fmt.Sprintf("extract_%d", time.Now().Unix())
	}

	// Get user ID from client
	userID := client.UserID
	if userID == "" {
		log.Printf("Error: No user ID available for extraction")
		sockets.EmitError(client, "User ID not available", "extraction_error")
		return
	}

	// Create extraction task
	task := ExtractionTask{
		FolderPath: folderPath,
		Passwords:  passwords,
		TaskID:     taskID,
	}

	// Start extraction in a goroutine
	go func() {
		extractionService := NewExtractionService()
		extractionService.StartExtractionWithPasswords(task, userID)
	}()
}

// extractRelativePathFromUNC extracts the relative path from a UNC path
// Example: \\?\UNC\192.168.1.51\ScanShare\subfolder\file.txt -> subfolder/file.txt
func extractRelativePathFromUNC(uncPath string) string {
	s := strings.TrimSpace(uncPath)

	// Handle \\?\UNC\ prefix (Windows extended-length path)
	if strings.HasPrefix(s, `\\?\UNC\`) {
		s = strings.TrimPrefix(s, `\\?\UNC\`)
	} else if strings.HasPrefix(s, `\\\\?\\UNC\\`) {
		s = strings.TrimPrefix(s, `\\\\?\\UNC\\`)
	} else if strings.HasPrefix(s, `\\\\`) {
		s = strings.TrimPrefix(s, `\\\\`)
	} else if strings.HasPrefix(s, `\\`) {
		s = strings.TrimPrefix(s, `\\`)
	} else {
		return "" // Not a UNC path
	}

	// Split by backslash
	parts := strings.Split(s, `\`)
	if len(parts) < 3 {
		return "" // Need at least: host, share, file
	}

	// Handle optional "UNC" prefix in parts
	if strings.EqualFold(parts[0], "UNC") && len(parts) >= 4 {
		parts = parts[1:] // Skip "UNC"
	}

	// parts now: [host, share, rest...]
	// We want everything after the share name
	if len(parts) < 3 {
		return ""
	}

	// Join the remaining parts (after host and share)
	relativeParts := parts[2:]
	relativePath := strings.Join(relativeParts, "/")

	log.Printf("[UNC-EXTRACT] Extracted '%s' from UNC path", relativePath)
	return relativePath
}

// extractRelativePathFromDrive extracts the relative path from a Windows drive path
// Example: Z:\subfolder\file.txt -> subfolder/file.txt
func extractRelativePathFromDrive(drivePath string) string {
	re := regexp.MustCompile(`^[A-Za-z]:\\`)
	if !re.MatchString(drivePath) {
		return "" // Not a drive path
	}

	// Remove drive letter and leading backslash
	relativePath := strings.TrimPrefix(drivePath[2:], `\`)
	// Convert backslashes to forward slashes
	relativePath = strings.ReplaceAll(relativePath, `\`, `/`)

	log.Printf("[DRIVE-EXTRACT] Extracted '%s' from drive path", relativePath)
	return relativePath
}

// convertWindowsPathToLinux converts a Windows path (UNC or drive letter) to a Linux path
// by combining the original scan base path with the relative path extracted from Windows path.
// This makes it portable - works with any mount point, any share name, any folder!
//
// basePath: The original Linux scan path provided by the user (e.g., /mnt/my-folder)
// winPath: The Windows path returned by ClamAV (e.g., \\?\UNC\192.168.1.51\ScanShare\subfolder\file.txt)
// Returns: Linux path (e.g., /mnt/my-folder/subfolder/file.txt)
func convertWindowsPathToLinux(basePath, winPath string) string {
	var relativePath string

	// Try extracting from UNC path first
	if strings.HasPrefix(winPath, `\\`) || strings.HasPrefix(winPath, `\\\\`) {
		relativePath = extractRelativePathFromUNC(winPath)
		if relativePath != "" {
			// Check if relativePath starts with a folder name that's already in basePath
			// E.g., basePath = /mnt/av-test-data/workflow-test
			//       relativePath = workflow-test/level1/virus2.txt
			// We need to remove the duplicate "workflow-test" part
			basePathParts := strings.Split(filepath.Clean(basePath), string(filepath.Separator))
			relativePathParts := strings.Split(filepath.ToSlash(relativePath), "/")

			// Find and remove common suffix in basePath with prefix in relativePath
			for i := len(basePathParts) - 1; i >= 0; i-- {
				if len(relativePathParts) > 0 && basePathParts[i] == relativePathParts[0] {
					// Found match - skip this part in relativePath
					relativePathParts = relativePathParts[1:]
					relativePath = strings.Join(relativePathParts, "/")
					log.Printf("[PATH-CONVERT] Removed duplicate folder '%s' from relative path", basePathParts[i])
					break
				}
			}

			linuxPath := filepath.Join(basePath, relativePath)
			log.Printf("[PATH-CONVERT] UNC: %s + %s = %s", basePath, relativePath, linuxPath)
			return linuxPath
		}
	}

	// Try extracting from drive letter path
	if regexp.MustCompile(`^[A-Za-z]:\\`).MatchString(winPath) {
		relativePath = extractRelativePathFromDrive(winPath)
		if relativePath != "" {
			linuxPath := filepath.Join(basePath, relativePath)
			log.Printf("[PATH-CONVERT] Drive: %s + %s = %s", basePath, relativePath, linuxPath)
			return linuxPath
		}
	}

	// Fallback: assume it's already a relative path or use basename
	log.Printf("[PATH-CONVERT] Using fallback for: %s", winPath)
	return filepath.Join(basePath, filepath.Base(winPath))
}

// handleOrganizeAVResults organizes files into infected and cleaned folders based on AV scan results
// SIMPLIFIED APPROACH: Uses the original scan path + relative paths extracted from Windows paths
// No hardcoded paths, no environment variables needed!
func handleOrganizeAVResults(client *sockets.Client, data map[string]any) {
	// Extract the original Linux scan path (e.g., /mnt/my-folder, /srv/data, etc.)
	basePath, ok := data["filePath"].(string)
	if !ok || basePath == "" {
		log.Printf("Error: Invalid filePath in organize_av_results request")
		sockets.EmitError(client, "Missing required field: filePath", "organize_av_results_error")
		return
	}

	// Get the list of infected files (Windows paths from ClamAV)
	infectedFilesInterface, ok := data["infectedFiles"].([]interface{})
	if !ok {
		log.Printf("Error: Invalid infectedFiles in organize_av_results request")
		sockets.EmitError(client, "Missing required field: infectedFiles", "organize_av_results_error")
		return
	}

	// If basePath is a Windows path (like Y:\ or Z:\), we need to find the Linux equivalent
	originalWindowsPath := basePath
	if regexp.MustCompile(`^[A-Za-z]:\\`).MatchString(basePath) || strings.HasPrefix(basePath, `\\`) {
		log.Printf("[ORGANIZE] Base path is Windows format: %s, searching for Linux mount point...", basePath)

		// For drive letters (Y:\, Z:\), scan all /mnt directories to find matching content
		foundLinuxPath := false

		// Try common mount point patterns first
		driveLetter := strings.ToUpper(string(basePath[0]))
		possiblePaths := []string{
			"/mnt/" + driveLetter,
			"/mnt/" + strings.ToLower(driveLetter),
		}

		// Then try scanning all /mnt directories
		if entries, err := os.ReadDir("/mnt"); err == nil {
			for _, entry := range entries {
				if entry.IsDir() {
					possiblePaths = append(possiblePaths, "/mnt/"+entry.Name())
				}
			}
		}

		// Also check /srv and /media
		if entries, err := os.ReadDir("/srv"); err == nil {
			for _, entry := range entries {
				if entry.IsDir() {
					possiblePaths = append(possiblePaths, "/srv/"+entry.Name())
				}
			}
		}

		for _, testPath := range possiblePaths {
			if info, err := os.Stat(testPath); err == nil && info.IsDir() {
				basePath = testPath
				log.Printf("[ORGANIZE] Found Linux mount point: %s for Windows path: %s", basePath, originalWindowsPath)
				foundLinuxPath = true
				break
			}
		}

		if !foundLinuxPath {
			log.Printf("[ORGANIZE] ERROR: Could not find Linux mount for Windows path: %s", originalWindowsPath)
			sockets.EmitError(client, fmt.Sprintf("Cannot organize: Windows path %s is not mounted on Linux. Please mount the share to /mnt/ first.", originalWindowsPath), "organize_av_results_error")
			return
		}
	}

	// Ensure basePath is a directory
	if info, err := os.Stat(basePath); err == nil {
		if !info.IsDir() {
			basePath = filepath.Dir(basePath)
			log.Printf("[ORGANIZE] Base path was a file, using parent: %s", basePath)
		}
	} else {
		log.Printf("[ORGANIZE] WARNING: Base path does not exist: %s", basePath)
		sockets.EmitError(client, fmt.Sprintf("Base path does not exist: %s", basePath), "organize_av_results_error")
		return
	}

	log.Printf("[ORGANIZE] Starting organization - Base path: %s, Infected files: %d", basePath, len(infectedFilesInterface))

	// Convert Windows paths to relative paths
	var relativeInfectedFiles []string
	for _, v := range infectedFilesInterface {
		var winPath string
		if s, ok := v.(string); ok {
			winPath = s
		} else if obj, ok := v.(map[string]any); ok {
			if s, ok := obj["filePath"].(string); ok {
				winPath = s
			}
		}

		if winPath == "" {
			continue
		}

		log.Printf("[ORGANIZE] Processing: %s", winPath)

		// Convert Windows path to Linux path using the base path
		linuxPath := convertWindowsPathToLinux(basePath, winPath)

		// Get relative path for organizing
		if rel, err := filepath.Rel(basePath, linuxPath); err == nil {
			log.Printf("[ORGANIZE] Relative path: %s", rel)
			relativeInfectedFiles = append(relativeInfectedFiles, rel)
		} else {
			log.Printf("[ORGANIZE] ERROR: Failed to get relative path for %s: %v", linuxPath, err)
		}
	}

	userID := client.UserID
	if userID == "" {
		log.Printf("Error: No user ID available for file organization")
		sockets.EmitError(client, "User ID not available", "organize_av_results_error")
		return
	}

	taskID, _ := data["task_id"].(string)

	log.Printf("[ORGANIZE] Will organize %d files from base: %s", len(relativeInfectedFiles), basePath)

	// Start organizing in background
	go func() {
		organizeFiles(basePath, relativeInfectedFiles, userID, taskID)
	}()
}

// organizeFiles creates infected and cleaned folders and organizes files accordingly
func organizeFiles(filePath string, infectedFiles []string, userID string, taskID string) {
	// Defensive: ensure base is a directory
	if fi, err := os.Stat(filePath); err == nil && !fi.IsDir() {
		dir := filepath.Dir(filePath)
		log.Printf("[organizeFiles] Base path is file (%s). Switching to parent directory: %s", filePath, dir)
		filePath = dir
	}

	infectedFolder := filepath.Join(filePath, "infected")
	if err := os.MkdirAll(infectedFolder, 0755); err != nil {
		log.Printf("Error: Failed to create infected folder: %v", err)
		sockets.EmitToUser(userID, "organize_av_results_error", map[string]any{
			"error": fmt.Sprintf("Failed to create infected folder: %v", err),
			"base":  filePath,
		})
		return
	}

	// Log the infected files received

	// Build a set of infected relative paths for fast lookup
	infectedSet := make(map[string]bool)
	for _, relPath := range infectedFiles {
		infectedSet[relPath] = true
		log.Printf("[organizeFiles] Added to infected set: %s", relPath)
	}
	log.Printf("[organizeFiles] Total infected files to move: %d", len(infectedSet))

	var movedFiles []string
	var errorFiles []string

	// Recursively walk the directory
	err := filepath.WalkDir(filePath, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			// Skip the infected folder itself
			if strings.HasSuffix(path, "/infected") || strings.HasSuffix(path, "\\infected") {
				return filepath.SkipDir
			}
			return nil
		}
		rel, relErr := filepath.Rel(filePath, path)
		if relErr != nil {
			log.Printf("[organizeFiles] Failed to get relative path for %s: %v", path, relErr)
			return nil
		}
		// Check if this file is in the infected set
		if infectedSet[rel] {
			log.Printf("[organizeFiles] ✓ MATCH! Moving infected file: %s", rel)
			destPath := filepath.Join(infectedFolder, rel)

			// Emit progress update
			sockets.EmitToUser(userID, "organize_progress", map[string]any{
				"action":  "moving",
				"file":    rel,
				"message": fmt.Sprintf("Moving infected file: %s", filepath.Base(rel)),
			})

			if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
				log.Printf("[organizeFiles] ✗ Failed to create dest dir for %s: %v", destPath, err)
				errorFiles = append(errorFiles, rel)
				sockets.EmitToUser(userID, "organize_progress", map[string]any{
					"action":  "error",
					"file":    rel,
					"message": fmt.Sprintf("Failed to create directory for: %s", filepath.Base(rel)),
					"error":   err.Error(),
				})
				return nil
			}
			if err := moveFile(path, destPath); err != nil {
				log.Printf("[organizeFiles] ✗ Failed to move file %s: %v", path, err)
				errorFiles = append(errorFiles, rel)
				sockets.EmitToUser(userID, "organize_progress", map[string]any{
					"action":  "error",
					"file":    rel,
					"message": fmt.Sprintf("Failed to move: %s", filepath.Base(rel)),
					"error":   err.Error(),
				})
			} else {
				log.Printf("[organizeFiles] ✓ Successfully moved: %s -> infected/%s", rel, rel)
				movedFiles = append(movedFiles, rel)
				sockets.EmitToUser(userID, "organize_progress", map[string]any{
					"action":  "moved",
					"file":    rel,
					"message": fmt.Sprintf("✓ Moved to quarantine: %s", filepath.Base(rel)),
				})
			}
		}
		return nil
	})
	if err != nil {
		log.Printf("[organizeFiles] Error walking directory: %v", err)
	}

	log.Printf("[organizeFiles] ====== Organization Summary ======")
	log.Printf("[organizeFiles] Total infected files: %d", len(infectedSet))
	log.Printf("[organizeFiles] Successfully moved: %d", len(movedFiles))
	log.Printf("[organizeFiles] Failed to move: %d", len(errorFiles))
	log.Printf("[organizeFiles] Quarantine folder: %s", infectedFolder)
	log.Printf("[organizeFiles] ===================================")

	// After organizing, update isOrganized in the DB
	task := models.Task{}
	err = config.DB.Where("unique_id = ?", taskID).First(&task).Error
	if err == nil {
		task.IsOrganized = true
		_ = task.Update()
	} else {
		log.Printf("[organizeFiles] Could not update isOrganized for taskID %s: %v", taskID, err)
	}

	// collect file names for convenience
	movedNames := make([]string, 0, len(movedFiles))
	for _, p := range movedFiles {
		movedNames = append(movedNames, filepath.Base(p))
	}

	sockets.EmitToUser(userID, "organize_av_results_complete", map[string]any{
		"filePath":       filePath,
		"movedFiles":     movedFiles,
		"movedFileNames": movedNames, // NEW: just names
		"errorFiles":     errorFiles,
		"infectedCount":  len(infectedFiles),
		"cleanedCount":   len(movedFiles) - len(infectedFiles),
	})
}

// copyFile copies a file from source to destination
func copyFile(src, dst string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	destFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destFile.Close()

	_, err = io.Copy(destFile, sourceFile)
	return err
}

func moveFile(src, dst string) error {
	// Try to move (rename) first
	if err := os.Rename(src, dst); err == nil {
		return nil
	}
	// If rename fails (e.g., across filesystems), fallback to copy+remove
	if err := copyFile(src, dst); err != nil {
		return err
	}
	return os.Remove(src)
}
