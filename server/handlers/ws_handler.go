package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
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

// windowsToLinuxRelative maps a Windows path to a Linux path based on the first common directory
func windowsToLinuxRelative(winPath, linuxBase string) string {
	// Normalize slashes
	winPathNorm := strings.ReplaceAll(winPath, "\\", "/")
	linuxBaseNorm := filepath.ToSlash(linuxBase)

	winParts := strings.Split(winPathNorm, "/")
	linuxParts := strings.Split(linuxBaseNorm, "/")

	// Find the first common directory name
	commonIdxWin := -1
	commonIdxLinux := -1
	for i, wp := range winParts {
		for j, lp := range linuxParts {
			if strings.EqualFold(wp, lp) && wp != "" {
				commonIdxWin = i
				commonIdxLinux = j
				break
			}
		}
		if commonIdxWin != -1 {
			break
		}
	}

	if commonIdxWin == -1 || commonIdxLinux == -1 {
		// No common directory, fallback to basename
		return filepath.Join(linuxBase, filepath.Base(winPathNorm))
	}

	// Get the relative path after the common directory in Windows path
	relParts := winParts[commonIdxWin+1:]
	relPath := strings.Join(relParts, "/")

	// Join with the Linux base up to the common directory
	linuxPrefix := strings.Join(linuxParts[:commonIdxLinux+1], "/")
	return filepath.Join(linuxPrefix, relPath)
}

// handleOrganizeAVResults organizes files into infected and cleaned folders based on AV scan results
func handleOrganizeAVResults(client *sockets.Client, data map[string]any) {
	// Extract required parameters
	filePath, ok := data["filePath"].(string)
	if !ok || filePath == "" {
		log.Printf("Error: Invalid filePath in organize_av_results request")
		sockets.EmitError(client, "Missing required field: filePath", "organize_av_results_error")
		return
	}

	infectedFilesInterface, ok := data["infectedFiles"].([]interface{})
	if !ok {
		log.Printf("Error: Invalid infectedFiles in organize_av_results request")
		sockets.EmitError(client, "Missing required field: infectedFiles", "organize_av_results_error")
		return
	}

	// Convert infected files to string slice and map Windows paths to Linux paths
	var infectedFiles []string
	for _, file := range infectedFilesInterface {
		// Support both string and object with filePath property
		if fileStr, ok := file.(string); ok {
			linuxPath := windowsToLinuxRelative(fileStr, filePath)
			rel, _ := filepath.Rel(filePath, linuxPath)
			infectedFiles = append(infectedFiles, rel)
		}
	}

	// Get user ID from client
	userID := client.UserID
	if userID == "" {
		log.Printf("Error: No user ID available for file organization")
		sockets.EmitError(client, "User ID not available", "organize_av_results_error")
		return
	}

	taskID, _ := data["task_id"].(string)

	// Start file organization in a goroutine
	go func() {
		fmt.Println(infectedFiles)
		organizeFiles(filePath, infectedFiles, userID, taskID)
	}()
}

// organizeFiles creates infected and cleaned folders and organizes files accordingly
func organizeFiles(filePath string, infectedFiles []string, userID string, taskID string) {
	infectedFolder := filepath.Join(filePath, "infected")
	if err := os.MkdirAll(infectedFolder, 0755); err != nil {
		log.Printf("Error: Failed to create infected folder: %v", err)
		sockets.EmitToUser(userID, "organize_av_results_error", map[string]any{
			"error": fmt.Sprintf("Failed to create infected folder: %v", err),
		})
		return
	}

	// Log the infected files received

	// Build a set of infected relative paths for fast lookup
	infectedSet := make(map[string]bool)
	for _, relPath := range infectedFiles {
		infectedSet[relPath] = true
	}

	var movedFiles []string
	var errorFiles []string

	// Recursively walk the directory
	err := filepath.WalkDir(filePath, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		rel, relErr := filepath.Rel(filePath, path)
		if relErr != nil {
			log.Printf("[organizeFiles] Failed to get relative path for %s: %v", path, relErr)
			return nil
		}
		// Log the file being checked
		if infectedSet[rel] {
			destPath := filepath.Join(infectedFolder, rel)
			if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
				log.Printf("[organizeFiles] Failed to create dest dir for %s: %v", destPath, err)
				errorFiles = append(errorFiles, rel)
				return nil
			}
			if err := moveFile(path, destPath); err != nil {
				log.Printf("[organizeFiles] Failed to move file %s: %v", path, err)
				errorFiles = append(errorFiles, rel)
			} else {
				movedFiles = append(movedFiles, rel)
			}
		}
		return nil
	})
	if err != nil {
		log.Printf("[organizeFiles] Error walking directory: %v", err)
	}

	// After organizing, update isOrganized in the DB
	task := models.Task{}
	err = config.DB.Where("unique_id = ?", taskID).First(&task).Error
	if err == nil {
		task.IsOrganized = true
		_ = task.Update()
	} else {
		log.Printf("[organizeFiles] Could not update isOrganized for taskID %s: %v", taskID, err)
	}

	sockets.EmitToUser(userID, "organize_av_results_complete", map[string]any{
		"filePath":      filePath,
		"movedFiles":    movedFiles,
		"errorFiles":    errorFiles,
		"infectedCount": len(infectedFiles),
		"cleanedCount":  len(movedFiles) - len(infectedFiles),
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
