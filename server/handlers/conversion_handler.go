package handlers

import (
	"bufio"
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"mime"
	"mime/multipart"
	"net/http"
	"net/mail"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"gitlab.com/magnetite1/av-pipeline/server/config"
	"gitlab.com/magnetite1/av-pipeline/server/helper"
	conv "gitlab.com/magnetite1/av-pipeline/server/interfaces"
	"gitlab.com/magnetite1/av-pipeline/server/models"
	"gitlab.com/magnetite1/av-pipeline/server/sockets"
)

// ConversionTypeResult struct
type ConversionTypeResult struct {
	Type               string   `json:"type"`
	Status             string   `json:"status"`
	TotalFiles         int      `json:"totalFiles"`
	ConvertedFiles     int      `json:"convertedFiles"`
	FailedFiles        int      `json:"failedFiles"`
	ConvertedFilesList []string `json:"convertedFilesList"`
	FailedFilesList    []string `json:"failedFilesList"`
	CurrentPhase       int      `json:"currentPhase"`
	Error              string   `json:"error,omitempty"`
}

// Helper to get current conversionResults from DB
func getConversionResultsFromDB(taskID string) ([]ConversionTypeResult, error) {
	var progress models.TaskProgress
	err := config.DB.Where("task_id = ?", taskID).First(&progress).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	var progressArr []map[string]interface{}
	if err := json.Unmarshal([]byte(progress.Progress), &progressArr); err != nil {
		return nil, err
	}
	for _, stage := range progressArr {
		if t, ok := stage["type"].(string); ok && t == "CONVERSION" {
			if cr, ok := stage["conversionResults"]; ok {
				crBytes, _ := json.Marshal(cr)
				var results []ConversionTypeResult
				if err := json.Unmarshal(crBytes, &results); err == nil {
					return results, nil
				}
			}
		}
	}
	return nil, nil
}

// Helper to update conversionResults in the progress array
func updateConversionResultsInDB(taskID string, updatedResults []ConversionTypeResult, updateFields map[string]interface{}) error {
	var progress models.TaskProgress
	err := config.DB.Where("task_id = ?", taskID).First(&progress).Error
	if err != nil {
		return err
	}
	var progressArr []map[string]interface{}
	if err := json.Unmarshal([]byte(progress.Progress), &progressArr); err != nil {
		return err
	}
	for i, stage := range progressArr {
		if t, ok := stage["type"].(string); ok && t == "CONVERSION" {
			stage["conversionResults"] = updatedResults
			for k, v := range updateFields {
				stage[k] = v
			}
			progressArr[i] = stage
		}
	}
	newProgressBytes, _ := json.Marshal(progressArr)
	progress.Progress = string(newProgressBytes)
	return config.DB.Save(&progress).Error
}

// Main dispatcher
func HandleStartConversion(client *sockets.Client, data map[string]any) {
	if conversionID, ok := data["conversion_id"].(string); ok && conversionID != "" {
		go HandleAdhocConversion(client, data)
	} else if taskID, ok := data["task_id"].(string); ok && taskID != "" {
		go HandleAutomationConversion(client, data)
	} else {
		sockets.EmitError(client, "Missing required ID (conversionID or task_id)", "conversion_error")
	}
}
func HandleConversionUpload(c *gin.Context) {
	err := c.Request.ParseMultipartForm(32 << 20)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse form: " + err.Error()})
		return
	}
	conversionType := c.PostForm("conversion_type")
	userID := c.PostForm("user_id")
	files := c.Request.MultipartForm.File["files"]
	if conversionType == "" || userID == "" || len(files) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing required fields"})
		return
	}
	taskID := fmt.Sprintf("conversion_%d", time.Now().UnixNano())
	tempDir := filepath.Join(os.TempDir(), "av-pipeline-uploads", taskID)
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create temp directory"})
		return
	}
	for _, fileHeader := range files {
		dstPath := filepath.Join(tempDir, fileHeader.Filename)
		if err := os.MkdirAll(filepath.Dir(dstPath), 0755); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create subdirectory"})
			return
		}
		src, _ := fileHeader.Open()
		defer src.Close()
		dst, _ := os.Create(dstPath)
		defer dst.Close()
		io.Copy(dst, src)
	}
	go func() {
		// *** FIX STARTS HERE: Robustly find the common base directory ***
		var conversionRoot = tempDir
		if len(files) > 0 {
			// Find the shortest path, which is a candidate for a common prefix
			shortestPath := files[0].Filename
			for _, f := range files {
				if len(f.Filename) < len(shortestPath) {
					shortestPath = f.Filename
				}
			}

			// Find the longest common path prefix among all files
			var commonPrefix string
			pathParts := strings.Split(filepath.ToSlash(shortestPath), "/")
			for i := len(pathParts) - 1; i >= 0; i-- {
				// Check if this prefix is common to all files
				prefix := strings.Join(pathParts[:i], "/")
				isCommon := true
				for _, f := range files {
					if !strings.HasPrefix(filepath.ToSlash(f.Filename), prefix) {
						isCommon = false
						break
					}
				}
				if isCommon {
					commonPrefix = prefix
					break
				}
			}

			// If a common directory is found, use it as the root
			if commonPrefix != "" {
				potentialRoot := filepath.Join(tempDir, commonPrefix)
				if info, err := os.Stat(potentialRoot); err == nil && info.IsDir() {
					conversionRoot = potentialRoot
				}
			}
		}
		// *** FIX ENDS HERE ***

		task := conv.ConversionTask{
			Path:           conversionRoot,
			ConversionType: conversionType,
			OutputPath:     conversionRoot,
			TaskID:         taskID,
		}
		processAdhocConversion(task, userID) // Keep this call as is
	}()

	// 6. Respond to the HTTP request immediately
	c.JSON(http.StatusOK, gin.H{
		"message": "Upload successful. Conversion has started.",
		"task_id": taskID,
	})
}
func processAdhocConversion(task conv.ConversionTask, userID string) {
	_ = processConversion(task, userID)
}

func processConversion(task conv.ConversionTask, userID string) *conv.ConversionResult {
	startTime := time.Now()
	conversionType := strings.ToUpper(task.ConversionType)

	sockets.EmitToUser(userID, "conversion_started", map[string]any{
		"conversion_type": conversionType,
		"path":            task.Path,
		"start_time":      startTime.Format(time.RFC3339),
		"task_id":         task.TaskID,
	})

	// All conversion logic is now centralized in convertAnyToHTML.
	result, err := convertAnyToHTML(task, userID)
	endTime := time.Now()

	if err != nil {
		sockets.EmitToUser(userID, "conversion_error", map[string]any{
			"error":           err.Error(),
			"conversion_type": conversionType,
			"path":            task.Path,
			"task_id":         task.TaskID,
		})
		return &conv.ConversionResult{
			Status:         "error",
			ConversionType: conversionType,
			Path:           task.Path,
			StartTime:      startTime,
			EndTime:        endTime,
			TaskID:         task.TaskID,
			Error:          err.Error(),
			ConvertedFiles: []string{},
			FailedFiles:    []string{},
		}
	}

	if result == nil {
		result = &conv.ConversionResult{
			Status:         "completed",
			ConversionType: conversionType,
			Path:           task.Path,
			StartTime:      startTime,
			EndTime:        endTime,
			TaskID:         task.TaskID,
			TotalFiles:     0,
			TotalConverted: 0,
			TotalFailed:    0,
			ConvertedFiles: []string{},
			FailedFiles:    []string{},
		}
	} else {
		result.EndTime = endTime
	}

	sockets.EmitToUser(userID, "conversion_type_complete", map[string]any{
		"conversion_type": conversionType,
		"path":            result.Path,
		"start_time":      result.StartTime.Format(time.RFC3339),
		"end_time":        result.EndTime.Format(time.RFC3339),
		"total_files":     result.TotalFiles,
		"total_size":      result.TotalSize,
		"total_converted": result.TotalConverted,
		"total_failed":    result.TotalFailed,
		"converted_files": result.ConvertedFiles,
		"failed_files":    result.FailedFiles,
		"task_id":         result.TaskID,
	})
	return result
}

// convertAnyToHTML walks the folder and converts supported files recursively.
// Supported: .eml, .msg, .pst, .mbox (and can be extended).
func convertAnyToHTML(task conv.ConversionTask, userID string) (*conv.ConversionResult, error) {
	res := &conv.ConversionResult{
		Status:         "processing",
		ConversionType: task.ConversionType,
		Path:           task.Path,
		StartTime:      time.Now(),
		TaskID:         task.TaskID,
		ConvertedFiles: []string{},
		FailedFiles:    []string{},
	}

	// If a specific type was requested, delegate to that converter.
	switch strings.ToLower(task.ConversionType) {
	case "eml":
		return convertEML(task, userID)
	case "msg":
		return convertMSG(task, userID)
	case "pst":
		return convertPST(task, userID)
	case "mbox":
		return convertMBOX(task, userID)
	}

	// Otherwise treat it as Any → HTML and iterate per file.
	var files []string
	supported := map[string]bool{".eml": true, ".msg": true, ".pst": true, ".mbox": true}
	filepath.WalkDir(task.Path, func(path string, d fs.DirEntry, err error) error {
		if err == nil && !d.IsDir() {
			ext := strings.ToLower(filepath.Ext(path))
			if supported[ext] {
				files = append(files, path)
			}
		}
		return nil
	})

	res.TotalFiles = len(files)
	sockets.EmitToUser(userID, "phase_started", map[string]any{
		"task_id":     task.TaskID,
		"phase":       1,
		"total_files": res.TotalFiles,
	})

	for _, filePath := range files {
		ext := strings.ToLower(filepath.Ext(filePath))
		var ok bool
		var outPaths []string

		switch ext {
		case ".eml":
			success, single, err := convertEMLToHTML(filePath, task.OutputPath)
			if err == nil && success && single != "" {
				ok = true
				outPaths = append(outPaths, single)
			}
		case ".msg":
			success, single, err := convertWithPython("msg", filePath, task.OutputPath)
			if err == nil && success && single != "" {
				ok = true
				outPaths = append(outPaths, single)
			}
		case ".pst":
			// Try Python first, then fallback to pffexport
			if success, single, err := convertWithPython("pst", filePath, task.OutputPath); err == nil && success && single != "" {
				ok = true
				outPaths = append(outPaths, single)
			} else {
				if success2, many, err2 := convertPSTViaPffexport(filePath, task.OutputPath); err2 == nil && success2 && len(many) > 0 {
					ok = true
					outPaths = append(outPaths, many...)
				}
			}
		case ".mbox":
			success, many, err := convertMBOXToHTML(filePath, task.OutputPath)
			if err == nil && success && len(many) > 0 {
				ok = true
				outPaths = append(outPaths, many...)
			}
		}

		if ok {
			res.TotalConverted++
			res.ConvertedFiles = append(res.ConvertedFiles, outPaths...)
		} else {
			res.TotalFailed++
			res.FailedFiles = append(res.FailedFiles, filePath)
		}

		sockets.EmitToUser(userID, "file_progress", map[string]any{
			"task_id":         task.TaskID,
			"phase":           1,
			"current_file":    filepath.Base(filePath),
			"converted_count": res.TotalConverted,
			"failed_count":    res.TotalFailed,
			"total_files":     res.TotalFiles,
		})
	}

	res.Status = "completed"
	res.EndTime = time.Now()
	return res, nil
}

// processConversion is now simplified. It ALWAYS uses the intelligent dispatcher.

// Existing logic for automation (taskID)
func HandleAutomationConversion(client *sockets.Client, data map[string]any) {
	// Get taskID first so it's always available for SignalStageComplete
	taskID, _ := data["task_id"].(string)

	// Parse conversion list from data
	conversionList, ok := data["conversion_list"].([]interface{})
	if !ok {
		sockets.EmitError(client, "Invalid or missing conversion list", "conversion_error")
		SignalStageComplete(taskID, "CONVERSION")
		return
	}

	if len(conversionList) == 0 {
		sockets.EmitError(client, "No conversion types provided", "conversion_error")
		SignalStageComplete(taskID, "CONVERSION")
		return
	}

	// Use the client's user ID for websocket events
	userID := client.UserID
	if userID == "" {
		sockets.EmitError(client, "User ID is required for conversion", "conversion_error")
		SignalStageComplete(taskID, "CONVERSION")
		return
	}

	// Get path
	path, ok := data["path"].(string)
	if !ok || path == "" {
		sockets.EmitError(client, "Missing required field: path", "conversion_error")
		SignalStageComplete(taskID, "CONVERSION")
		return
	}
	if taskID == "" {
		sockets.EmitError(client, "Missing required field: task_id", "conversion_error")
		SignalStageComplete(taskID, "CONVERSION")
		return
	}

	// Prepare initial conversionResults array
	conversionResults := []ConversionTypeResult{}
	for _, conversionType := range conversionList {
		typeStr, ok := conversionType.(string)
		if !ok {
			continue
		}
		conversionResults = append(conversionResults, ConversionTypeResult{
			Type:               strings.ToUpper(typeStr),
			Status:             "pending",
			TotalFiles:         0,
			ConvertedFiles:     0,
			FailedFiles:        0,
			ConvertedFilesList: []string{},
			FailedFilesList:    []string{},
			CurrentPhase:       1,
		})
	}
	// Persist initial progress
	conversionProgress := map[string]interface{}{
		"type":               "CONVERSION",
		"status":             "RUNNING",
		"progress":           0,
		"currConversionType": "",
		"currentFile":        "",
		"currFileNumber":     0,
		"filesCount":         0,
		"message":            "Starting conversion",
		"conversionResults":  conversionResults,
	}
	UpdateStageProgressArray(taskID, "CONVERSION", conversionProgress)

	for _, conversionType := range conversionList {
		typeStr, ok := conversionType.(string)
		if !ok {
			continue
		}
		// Update status to running for this type
		results, _ := getConversionResultsFromDB(taskID)
		for i, r := range results {
			if r.Type == strings.ToUpper(typeStr) {
				results[i].Status = "running"
				results[i].CurrentPhase = 1
			}
		}
		updateConversionResultsInDB(taskID, results, map[string]interface{}{
			"currConversionType": typeStr,
			"status":             "RUNNING",
			"message":            "Running conversion",
		})
		// Create conversion task
		task := conv.ConversionTask{
			Path:           path,
			ConversionType: typeStr,
			OutputPath:     path, // Use the same path for output
			TaskID:         taskID,
		}
		result := processConversion(task, userID)
		// On completion, update status for this type
		results, _ = getConversionResultsFromDB(taskID)
		for i, r := range results {
			if r.Type == strings.ToUpper(typeStr) {
				results[i].Status = "completed"
				results[i].ConvertedFiles = result.TotalConverted
				results[i].TotalFiles = result.TotalFiles
				results[i].FailedFiles = result.TotalFailed
				results[i].ConvertedFilesList = result.ConvertedFiles
				results[i].FailedFilesList = result.FailedFiles
			}
		}
		updateConversionResultsInDB(taskID, results, map[string]interface{}{
			"currConversionType": typeStr,
			"status":             "RUNNING",
			"message":            "Conversion type complete",
		})
	}
	// Mark all as done
	results, _ := getConversionResultsFromDB(taskID)
	updateConversionResultsInDB(taskID, results, map[string]interface{}{
		"status":   "DONE",
		"progress": 100,
		"message":  "Conversion complete",
		"end_time": time.Now().Format(time.RFC3339),
	})
	sockets.EmitToUser(userID, "conversion_complete", map[string]any{
		"path":     path,
		"end_time": time.Now().Format(time.RFC3339),
		"task_id":  taskID,
	})
	SignalStageComplete(taskID, "CONVERSION")
}
func convertMBOXToHTML(mboxPath, outputBase string) (bool, []string, error) {
	// Create output directory
	htmlDir := filepath.Join(outputBase, "Converted_MBOX")
	if err := createDirs(htmlDir); err != nil {
		return false, nil, fmt.Errorf("failed to create directory: %w", err)
	}

	fileName := strings.TrimSuffix(filepath.Base(mboxPath), filepath.Ext(mboxPath))

	// Open MBOX file
	file, err := os.Open(mboxPath)
	if err != nil {
		return false, nil, fmt.Errorf("failed to open MBOX file: %w", err)
	}
	defer file.Close()

	var htmlPaths []string
	messageCount := 0

	// Parse MBOX file using buffered reader to handle large messages
	reader := bufio.NewReader(file)
	var currentMessage strings.Builder
	var inMessage bool
	lineNumber := 0

	for {
		line, err := reader.ReadString('\n')
		if err != nil && err != io.EOF {
			return false, nil, fmt.Errorf("error reading MBOX file: %w", err)
		}

		lineNumber++

		// Remove trailing newline for processing
		trimmedLine := strings.TrimSuffix(line, "\n")
		trimmedLine = strings.TrimSuffix(trimmedLine, "\r")

		// Check for message separator (From line at start of message)
		// MBOX format: messages start with "From " followed by email and timestamp
		if strings.HasPrefix(trimmedLine, "From ") && (lineNumber == 1 || inMessage) {
			// Process previous message if we have one
			if inMessage && currentMessage.Len() > 0 {
				htmlPath, processErr := processMBOXMessage(currentMessage.String(), htmlDir, fileName, messageCount)
				if processErr != nil {
					log.Printf("Warning: Failed to process MBOX message %d: %v", messageCount, processErr)
				} else if htmlPath != "" {
					htmlPaths = append(htmlPaths, htmlPath)
				}
				messageCount++
				currentMessage.Reset()
			}
			inMessage = true
			currentMessage.WriteString(line)
		} else if inMessage {
			currentMessage.WriteString(line)
		}

		// Break if we've reached EOF
		if err == io.EOF {
			break
		}
	}

	// Process last message
	if inMessage && currentMessage.Len() > 0 {
		htmlPath, processErr := processMBOXMessage(currentMessage.String(), htmlDir, fileName, messageCount)
		if processErr != nil {
			log.Printf("Warning: Failed to process final MBOX message: %v", processErr)
		} else if htmlPath != "" {
			htmlPaths = append(htmlPaths, htmlPath)
		}
	}

	return len(htmlPaths) > 0, htmlPaths, nil
}

// processMBOXMessage processes a single message from an MBOX file
func processMBOXMessage(messageText, htmlDir, fileName string, messageIndex int) (string, error) {
	// Validate message content
	if strings.TrimSpace(messageText) == "" {
		return "", fmt.Errorf("empty message content")
	}

	// Parse the message as an email
	reader := strings.NewReader(messageText)
	msg, err := mail.ReadMessage(reader)
	if err != nil {
		// Try to create a basic HTML file for malformed messages
		return createBasicMBOXHTML(messageText, htmlDir, fileName, messageIndex, err)
	}

	// Create HTML filename and per-message attachment directory
	htmlPath := filepath.Join(htmlDir, fmt.Sprintf("%s_message_%d.html", fileName, messageIndex))
	attachmentDir := filepath.Join(htmlDir, fmt.Sprintf("%s_message_%d_attachments", fileName, messageIndex))
	if err := createDirs(attachmentDir); err != nil {
		return "", fmt.Errorf("failed to create attachment directory: %w", err)
	}

	// Extract headers
	fromHeader := msg.Header.Get("From")
	toHeader := msg.Header.Get("To")
	ccHeader := msg.Header.Get("Cc")
	subjectHeader := msg.Header.Get("Subject")
	dateHeader := msg.Header.Get("Date")

	if fromHeader == "" {
		fromHeader = "Unknown"
	}
	if toHeader == "" {
		toHeader = "Unknown"
	}
	if subjectHeader == "" {
		subjectHeader = "No Subject"
	}
	if dateHeader == "" {
		dateHeader = "Unknown Date"
	}

	// Build headers HTML with improved formatting
	headers := fmt.Sprintf(`<div class="header-field"><strong>From:</strong> %s</div>
<div class="header-field"><strong>To:</strong> %s</div>
<div class="header-field"><strong>Cc:</strong> %s</div>
<div class="header-field"><strong>Date:</strong> %s</div>`,
		escapeHTML(fromHeader),
		escapeHTML(toHeader),
		escapeHTML(ccHeader),
		escapeHTML(dateHeader))

	// Extract body content and attachments using EML logic
	bodyContent, attachments, err := extractEMLContent(msg, attachmentDir, htmlPath)
	if err != nil {
		log.Printf("Warning: Failed to extract content from MBOX message %d: %v", messageIndex, err)
		bodyContent = "Failed to extract email content"
	}

	// Build attachments HTML with improved formatting
	attachmentHTML := ""
	if len(attachments) > 0 {
		attachmentHTML = fmt.Sprintf(`<div class="attachments">
            <h3>📎 Attachments (%d)</h3>
            %s
        </div>`, len(attachments), strings.Join(attachments, ""))
	}

	// Create HTML content with improved styling (similar to EML)
	htmlContent := fmt.Sprintf(`<!DOCTYPE html>
		<html>
		<head>
			<meta charset="UTF-8">
			<title>%s</title>
			<style>
				body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
				.email-container { max-width: 800px; margin: 0 auto; }
				.header { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #28a745; }
				.header h2 { margin: 0 0 10px 0; color: #333; }
				.header-field { margin: 5px 0; }
				.header-field strong { color: #555; }
				.message-number { background: #007cba; color: white; padding: 5px 10px; border-radius: 3px; font-size: 0.9em; margin-bottom: 15px; display: inline-block; }
				.content { background: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 5px; margin-bottom: 20px; }
				.attachments { background: #f9f9f9; padding: 15px; border-radius: 5px; border-left: 4px solid #28a745; }
				.attachments h3 { margin: 0 0 10px 0; color: #333; }
				.attachment-link { display: inline-block; margin: 5px 10px 5px 0; padding: 5px 10px; background: #e9ecef; border-radius: 3px; text-decoration: none; color: #495057; }
				.attachment-link:hover { background: #dee2e6; }
				pre { white-space: pre-wrap; word-wrap: break-word; margin: 0; }
			</style>
		</head>
		<body>
			<div class="email-container">
				<div class="message-number">📧 Message #%d</div>
				<div class="header">
					<h2>%s</h2>
					%s
				</div>
				<div class="content">
					%s
				</div>
				%s
			</div>
		</body>
		</html>`, escapeHTML(subjectHeader), messageIndex+1, escapeHTML(subjectHeader), headers, bodyContent, attachmentHTML)

	// Write HTML file
	if err := os.WriteFile(htmlPath, []byte(htmlContent), 0644); err != nil {
		return "", fmt.Errorf("failed to write HTML file: %w", err)
	}

	return htmlPath, nil
}

// createBasicMBOXHTML creates a basic HTML file for malformed MBOX messages
func createBasicMBOXHTML(messageText, htmlDir, fileName string, messageIndex int, parseErr error) (string, error) {
	// Create HTML filename
	htmlPath := filepath.Join(htmlDir, fmt.Sprintf("%s_message_%d.html", fileName, messageIndex))

	// Extract basic information from raw text
	lines := strings.Split(messageText, "\n")
	var fromLine, subject string

	for _, line := range lines {
		if strings.HasPrefix(line, "From ") {
			fromLine = line
		} else if strings.HasPrefix(strings.ToLower(line), "subject:") {
			subject = strings.TrimSpace(line[8:]) // Remove "Subject:" prefix
		}
		// Stop after headers section (empty line)
		if strings.TrimSpace(line) == "" {
			break
		}
	}

	if subject == "" {
		subject = "Malformed Message"
	}
	if fromLine == "" {
		fromLine = "Unknown sender"
	}

	// Create HTML content for malformed message
	htmlContent := fmt.Sprintf(`<!DOCTYPE html>
		<html>
		<head>
			<meta charset="UTF-8">
			<title>MBOX Message: %d</title>
			<style>
				body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
				.email-container { max-width: 800px; margin: 0 auto; }
				.header { background: #fff3cd; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #ffc107; }
				.header h2 { margin: 0 0 10px 0; color: #333; }
				.error { background-color: #f8d7da; padding: 10px; border-radius: 5px; border-left: 4px solid #dc3545; margin-bottom: 15px; }
				.content { background: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
				.message-number { background-color: #6c757d; color: white; padding: 5px 10px; border-radius: 3px; font-size: 0.9em; margin-bottom: 15px; display: inline-block; }
				pre { white-space: pre-wrap; word-wrap: break-word; margin: 0; font-size: 0.9em; }
			</style>
		</head>
		<body>
			<div class="email-container">
				<div class="message-number">📧 Message #%d (Malformed)</div>
				<div class="header">
					<h2>%s</h2>
					<p><strong>From:</strong> %s</p>
				</div>
				<div class="error">
					<strong>⚠️ Parse Error:</strong> %s
				</div>
				<div class="content">
					<h3>Raw Message Content:</h3>
					<pre>%s</pre>
				</div>
			</div>
		</body>
		</html>`, messageIndex+1, messageIndex+1, escapeHTML(subject), escapeHTML(fromLine),
		escapeHTML(parseErr.Error()), escapeHTML(messageText))

	// Write HTML file
	if err := os.WriteFile(htmlPath, []byte(htmlContent), 0644); err != nil {
		return "", fmt.Errorf("failed to write HTML file: %w", err)
	}

	return htmlPath, nil
}

// extractBestBodyAndAttachments extracts the best body and attachments from a multipart message
func extractBestBodyAndAttachments(reader io.Reader, headers mail.Header, attachmentDir, htmlPath string) (string, []string, error) {
	contentType := headers.Get("Content-Type")
	mediaType, params, _ := mime.ParseMediaType(contentType)
	var attachments []string
	if strings.HasPrefix(mediaType, "multipart/alternative") {
		boundary := params["boundary"]
		if boundary == "" {
			return "", nil, nil
		}
		mr := multipart.NewReader(reader, boundary)
		var htmlPart, textPart string
		for {
			part, err := mr.NextPart()
			if err == io.EOF {
				break
			}
			if err != nil {
				break
			}
			ct := part.Header.Get("Content-Type")
			disp := part.Header.Get("Content-Disposition")
			if strings.Contains(disp, "attachment") || strings.Contains(disp, "inline") {
				_, partAttachments, _ := processAttachment(part, attachmentDir, disp, ct, htmlPath)
				attachments = append(attachments, partAttachments...)
			} else {
				body, partAttachments, _ := extractBestBodyAndAttachments(part, mail.Header(part.Header), attachmentDir, htmlPath)
				attachments = append(attachments, partAttachments...)
				if strings.HasPrefix(ct, "text/html") {
					htmlPart = body
				} else if strings.HasPrefix(ct, "text/plain") {
					textPart = "<pre>" + body + "</pre>"
				}
			}
			part.Close()
		}
		if htmlPart != "" {
			return htmlPart, attachments, nil
		}
		return textPart, attachments, nil
	} else if strings.HasPrefix(mediaType, "multipart/") {
		boundary := params["boundary"]
		if boundary == "" {
			return "", nil, nil
		}
		mr := multipart.NewReader(reader, boundary)
		var content string
		for {
			part, err := mr.NextPart()
			if err == io.EOF {
				break
			}
			if err != nil {
				break
			}
			ct := part.Header.Get("Content-Type")
			disp := part.Header.Get("Content-Disposition")
			if strings.Contains(disp, "attachment") || strings.Contains(disp, "inline") {
				_, partAttachments, _ := processAttachment(part, attachmentDir, disp, ct, htmlPath)
				attachments = append(attachments, partAttachments...)
			} else {
				body, partAttachments, _ := extractBestBodyAndAttachments(part, mail.Header(part.Header), attachmentDir, htmlPath)
				attachments = append(attachments, partAttachments...)
				if content != "" && body != "" {
					content += "<br><hr><br>"
				}
				content += body
			}
			part.Close()
		}
		return content, attachments, nil
	} else {
		// Single part
		body, _ := io.ReadAll(reader)
		if strings.HasPrefix(mediaType, "text/html") {
			return string(body), nil, nil
		} else if strings.HasPrefix(mediaType, "text/plain") {
			return "<pre>" + string(body) + "</pre>", nil, nil
		}
		return "", nil, nil
	}
}

// getEmailDate tries to convert various date formats (Unix, Windows FILETIME) to RFC3339 string
func getEmailDate(dateInt int64) string {
	if dateInt <= 0 {
		return "Unknown Date"
	}
	// If plausible Unix timestamp (1970-2100)
	if dateInt > 0 && dateInt < 4102444800 { // 2100-01-01
		return time.Unix(dateInt, 0).Format(time.RFC3339)
	}
	// If plausible Windows FILETIME (100-ns intervals since 1601-01-01)
	if dateInt > 1e15 { // Lower threshold to avoid misclassifying large Unix timestamps
		const ticksPerSecond = 10000000
		const epochDifference = 11644473600 // seconds between 1601-01-01 and 1970-01-01
		seconds := dateInt / ticksPerSecond
		nanos := (dateInt % ticksPerSecond) * 100
		t := time.Unix(seconds-epochDifference, nanos)
		if t.Year() > 2100 || t.Year() < 1601 {
			return "Unknown Date"
		}
		return t.Format(time.RFC3339)
	}
	// Fallback: show raw value
	return fmt.Sprintf("%d", dateInt)
}

// isPSTFile checks if a file is likely a PST file
func isPSTFile(path string) bool {
	f, err := os.Open(path)
	if err != nil {
		return false
	}
	defer f.Close()
	header := make([]byte, 4)
	if _, err := f.Read(header); err != nil {
		return false
	}
	return string(header) == "!BDN"
}

// New logic for ad-hoc conversion (conversionID)
func HandleAdhocConversion(client *sockets.Client, data map[string]any) {
	conversionID, _ := data["conversion_id"].(string)
	systemIp, _ := data["system_ip"].(string)
	selectedFormat, _ := data["selected_format"].(string)
	inputPath, _ := data["path"].(string)
	conversionList, _ := data["conversion_list"].([]interface{})

	if conversionID == "" || inputPath == "" || len(conversionList) == 0 {
		sockets.EmitError(client, "Missing required fields for conversion", "conversion_error")
		return
	}

	// Prepare initial state
	phases := []map[string]interface{}{}
	conversionProgress := map[string]interface{}{
		"total":           0,
		"converted":       0,
		"failed":          0,
		"currentFile":     "",
		"size":            0,
		"phase":           1,
		"converted_files": []string{},
		"failed_files":    []string{},
	}
	phasesJSON, _ := json.Marshal(phases)
	progressJSON, _ := json.Marshal(conversionProgress)

	convModel := models.Conversion{
		ConversionID:       conversionID,
		SystemIP:           systemIp,
		SelectedFormat:     selectedFormat,
		IsConverting:       true,
		CurrentPhase:       1,
		InputPath:          inputPath,
		SocketUserID:       client.UserID,
		ConversionProgress: string(progressJSON),
		Phases:             string(phasesJSON),
		ConversionError:    "",
		ApiResponse:        "",
	}
	convModel.Create()

	for _, conversionType := range conversionList {
		typeStr, ok := conversionType.(string)
		if !ok {
			continue
		}
		task := conv.ConversionTask{
			Path:           inputPath,
			ConversionType: typeStr,
			OutputPath:     inputPath,
		}
		result := processConversion(task, client.UserID)

		// Update progress after each type
		conversionProgress["currentFile"] = ""
		conversionProgress["converted"] = result.TotalConverted
		conversionProgress["failed"] = result.TotalFailed
		conversionProgress["total"] = result.TotalFiles
		conversionProgress["converted_files"] = result.ConvertedFiles
		conversionProgress["failed_files"] = result.FailedFiles
		conversionProgress["phase"] = 1 // or increment if you want to track phases

		progressJSON, _ = json.Marshal(conversionProgress)
		convModel.ConversionProgress = string(progressJSON)
		convModel.IsConverting = false
		convModel.CurrentPhase = 1
		// Optionally update phases, apiResponse, etc.
		convModel.Update()
	}

	// On complete, update status and apiResponse
	apiResponse := map[string]interface{}{
		"total_files":     conversionProgress["total"],
		"total_converted": conversionProgress["converted"],
		"total_failed":    conversionProgress["failed"],
		"converted_files": conversionProgress["converted_files"],
		"failed_files":    conversionProgress["failed_files"],
		"total_size":      conversionProgress["size"],
	}
	apiRespJSON, _ := json.Marshal(apiResponse)
	convModel.ApiResponse = string(apiRespJSON)
	convModel.IsConverting = false
	convModel.Update()
}

// emitEvent sends WebSocket events for conversion progress using centralized manager
func emitEvent(eventType string, data map[string]interface{}, userID string) {
	// Convert map[string]interface{} to map[string]any for compatibility
	convertedData := make(map[string]any)
	for k, v := range data {
		convertedData[k] = v
	}

	// Use centralized websocket manager directly
	sockets.EmitToUser(userID, eventType, convertedData)
}

// Helper function to sanitize filenames
func sanitizeFilename(filename string) string {
	// Remove or replace invalid characters
	invalid := []string{"<", ">", ":", "\"", "|", "?", "*", "/", "\\"}
	result := filename
	for _, char := range invalid {
		result = strings.ReplaceAll(result, char, "_")
	}
	return result
}

// Helper function to get unique filename
func getUniqueFilename(dir, filename string) string {
	fullPath := filepath.Join(dir, filename)
	if _, err := os.Stat(fullPath); os.IsNotExist(err) {
		return fullPath
	}

	// File exists, create unique name
	ext := filepath.Ext(filename)
	name := strings.TrimSuffix(filename, ext)

	for i := 1; ; i++ {
		newName := fmt.Sprintf("%s_%d%s", name, i, ext)
		newPath := filepath.Join(dir, newName)
		if _, err := os.Stat(newPath); os.IsNotExist(err) {
			return newPath
		}
	}
}

// Helper function to escape HTML
func escapeHTML(text string) string {
	if text == "" {
		return ""
	}
	text = strings.ReplaceAll(text, "&", "&amp;")
	text = strings.ReplaceAll(text, "<", "&lt;")
	text = strings.ReplaceAll(text, ">", "&gt;")
	text = strings.ReplaceAll(text, "\"", "&quot;")
	text = strings.ReplaceAll(text, "'", "&#x27;")
	return text
}

// Helper function to create directories
func createDirs(paths ...string) error {
	for _, path := range paths {
		if err := os.MkdirAll(path, 0755); err != nil {
			return fmt.Errorf("failed to create directory %s: %w", path, err)
		}
	}
	return nil
}

// convertEML handles EML file conversion with phase processing
func convertEML(task conv.ConversionTask, userID string) (*conv.ConversionResult, error) {
	result := &conv.ConversionResult{
		Status:         "processing",
		ConversionType: "eml",
		Path:           task.Path,
		StartTime:      time.Now(),
		TaskID:         task.TaskID,
		// *** FIX: ALWAYS INITIALIZE SLICES ***
		ConvertedFiles: []string{},
		FailedFiles:    []string{},
	}

	phase := 1
	totalFiles := 0
	totalSize := int64(0)
	totalConverted := 0
	totalFailed := 0

	for {
		var sourceFolder string
		if phase == 1 {
			sourceFolder = task.Path
		} else {
			sourceFolder = filepath.Join(task.OutputPath, "EML_Attachments", fmt.Sprintf("Phase%d", phase-1))
		}

		// Check if source folder exists
		if _, err := os.Stat(sourceFolder); os.IsNotExist(err) {
			log.Printf("Source folder %s does not exist, breaking", sourceFolder)
			break
		}

		// Find EML files
		emlFiles, err := findEMLFiles(sourceFolder)
		if err != nil {
			return nil, fmt.Errorf("failed to find EML files: %w", err)
		}

		if len(emlFiles) == 0 {
			if phase == 1 {
				// No EML files found in the initial directory - return early with zero results
				log.Printf("No EML files found in %s for conversion", sourceFolder)
				result.TotalFiles = 0
				result.TotalSize = 0
				result.TotalConverted = 0
				result.TotalFailed = 0
				result.Status = "completed"

				return result, nil
			} else {
				// No more files in subsequent phases - normal completion
				log.Printf("No EML files found in %s, breaking", sourceFolder)
				break
			}
		}

		// Calculate file size
		phaseSize := int64(0)
		for _, file := range emlFiles {
			if info, err := os.Stat(file); err == nil {
				phaseSize += info.Size()
			}
		}

		totalFiles += len(emlFiles)
		totalSize += phaseSize

		// Emit phase started
		emitEvent("phase_started", map[string]interface{}{
			"conversion_type": "eml",
			"phase":           phase,
			"total_files":     len(emlFiles),
			"total_size":      phaseSize,
			"task_id":         task.TaskID,
		}, userID)

		converted := 0
		failed := 0
		phaseConvertedFiles := []string{}
		phaseFailedFiles := []string{}

		// Process each EML file
		for _, emlFile := range emlFiles {
			success, htmlPath, err := convertEMLToHTML(emlFile, task.OutputPath)

			if success {
				converted++
				phaseConvertedFiles = append(phaseConvertedFiles, htmlPath)
			} else {
				failed++
				phaseFailedFiles = append(phaseFailedFiles, emlFile)
				if err != nil {
					log.Printf("Failed to convert %s: %v", emlFile, err)
				}
			}

			// Emit file progress
			emitEvent("file_progress", map[string]interface{}{
				"conversion_type": "eml",
				"phase":           phase,
				"current_file":    emlFile,
				"converted_count": converted,
				"failed_count":    failed,
				"total_files":     len(emlFiles),
				"converted_files": phaseConvertedFiles,
				"failed_files":    phaseFailedFiles,
				"size":            phaseSize,
				"task_id":         task.TaskID,
			}, userID)
		}

		// Emit phase completed
		emitEvent("phase_completed", map[string]interface{}{
			"conversion_type":      "eml",
			"phase":                phase,
			"converted_files":      converted,
			"failed_files":         failed,
			"total_files":          len(emlFiles),
			"size":                 phaseSize,
			"converted_files_list": phaseConvertedFiles,
			"failed_files_list":    phaseFailedFiles,
			"task_id":              task.TaskID,
		}, userID)

		totalConverted += converted
		totalFailed += failed
		result.ConvertedFiles = append(result.ConvertedFiles, phaseConvertedFiles...)
		result.FailedFiles = append(result.FailedFiles, phaseFailedFiles...)
		phase++
	}

	result.TotalFiles = totalFiles
	result.TotalSize = totalSize
	result.TotalConverted = totalConverted
	result.TotalFailed = totalFailed
	result.Status = "completed"

	return result, nil
}

// findEMLFiles recursively finds all EML files in a directory
func findEMLFiles(dir string) ([]string, error) {
	var emlFiles []string

	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if !info.IsDir() && strings.ToLower(filepath.Ext(path)) == ".eml" {
			emlFiles = append(emlFiles, path)
		}

		return nil
	})

	return emlFiles, err
}

// convertEMLToHTML converts an EML file to HTML format using improved parsing
func convertEMLToHTML(filePath, outputDir string) (bool, string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return false, "", err
	}
	defer file.Close()
	msg, err := mail.ReadMessage(file)
	if err != nil {
		return false, "", err
	}
	subject := msg.Header.Get("Subject")
	htmlBody, err := io.ReadAll(msg.Body)
	if err != nil {
		return false, "", err
	}
	htmlFileName := fmt.Sprintf("%s.html", strings.TrimSuffix(filepath.Base(filePath), filepath.Ext(filePath)))
	emlOutputDir := filepath.Join(outputDir, "Converted_EML")
	os.MkdirAll(emlOutputDir, 0755)
	htmlFilePath, _ := helper.GetUniqueFilename(emlOutputDir, htmlFileName)
	htmlContent := fmt.Sprintf("<html><head><title>%s</title></head><body>%s</body></html>", subject, string(htmlBody))
	err = os.WriteFile(htmlFilePath, []byte(htmlContent), 0644)
	if err != nil {
		return false, "", err
	}
	return true, htmlFilePath, nil
}

// createBasicEMLHTML creates a basic HTML file for malformed EML files
func createBasicEMLHTML(emlPath, outputBase string, phase int, sourceFolder string, parseErr error) (bool, string, error) {
	// Calculate relative path to maintain folder structure
	relPath, err := filepath.Rel(sourceFolder, emlPath)
	if err != nil {
		relPath = filepath.Base(emlPath)
	}

	// Remove the file extension and get directory parts
	relDir := filepath.Dir(relPath)
	fileName := strings.TrimSuffix(filepath.Base(relPath), filepath.Ext(relPath))

	// Create output paths maintaining structure
	htmlDir := filepath.Join(outputBase, "Converted_EML", fmt.Sprintf("Phase%d", phase), relDir)
	if err := createDirs(htmlDir); err != nil {
		return false, "", fmt.Errorf("failed to create directory: %w", err)
	}

	htmlPath := filepath.Join(htmlDir, fileName+".html")

	// Read the raw file content for display
	rawContent, err := os.ReadFile(emlPath)
	if err != nil {
		rawContent = []byte(fmt.Sprintf("Error reading file: %v", err))
	}

	// Limit content size for display (max 50KB)
	const maxDisplaySize = 50 * 1024
	if len(rawContent) > maxDisplaySize {
		rawContent = rawContent[:maxDisplaySize]
		rawContent = append(rawContent, []byte("\n\n... (content truncated)")...)
	}

	// Create basic HTML content
	htmlContent := fmt.Sprintf(`<html>
			<head>
				<title>EML File: %s (Parse Error)</title>
				<meta charset="UTF-8">
				<style>
					body { font-family: Arial, sans-serif; margin: 20px; }
					.error { color: red; background-color: #ffe6e6; padding: 10px; border-radius: 5px; margin-bottom: 20px; }
					.info { background-color: #e6f3ff; padding: 10px; border-radius: 5px; margin-bottom: 20px; }
					.raw-content { background-color: #f5f5f5; padding: 15px; border-radius: 5px; white-space: pre-wrap; font-family: monospace; max-height: 400px; overflow-y: auto; }
				</style>
			</head>
			<body>
				<h2>EML File: %s</h2>
				<div class="error">
					<strong>Parse Error:</strong> %s
				</div>
				<div class="info">
					<strong>Original Path:</strong> %s<br>
					<strong>Phase:</strong> %d<br>
					<strong>File Size:</strong> %s
				</div>
				<h3>Raw Content:</h3>
				<div class="raw-content">%s</div>
				<div class="info">
					<strong>Note:</strong> This EML file could not be parsed properly due to formatting issues.
					The raw content is displayed above for manual inspection.
				</div>
			</body>
			</html>`,
		escapeHTML(fileName),
		escapeHTML(fileName),
		escapeHTML(parseErr.Error()),
		escapeHTML(emlPath),
		phase,
		formatFileSize(int64(len(rawContent))),
		escapeHTML(string(rawContent)))

	// Write HTML file
	if err := os.WriteFile(htmlPath, []byte(htmlContent), 0644); err != nil {
		return false, "", fmt.Errorf("failed to write HTML file: %w", err)
	}

	return true, htmlPath, nil
}

// extractEMLContent extracts body content and attachments from an email message
func extractEMLContent(msg *mail.Message, attachmentDir, htmlPath string) (string, []string, error) {
	var bodyContent string
	var attachments []string

	// Get content type
	contentType := msg.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "text/plain"
	}

	// Parse content type
	mediaType, params, err := mime.ParseMediaType(contentType)
	if err != nil {
		// Fallback to reading as plain text
		body, err := io.ReadAll(msg.Body)
		if err != nil {
			return "", nil, err
		}
		return string(body), attachments, nil
	}

	if strings.HasPrefix(mediaType, "multipart/alternative") {
		boundary := params["boundary"]
		if boundary == "" {
			return "No boundary found in multipart message", attachments, nil
		}
		reader := multipart.NewReader(msg.Body, boundary)
		partCount := 0
		maxParts := 1000
		var htmlPart, textPart string
		for partCount < maxParts {
			part, err := reader.NextPart()
			if err == io.EOF {
				break
			}
			if err != nil {
				break
			}
			contentType := part.Header.Get("Content-Type")
			body, _ := io.ReadAll(part)
			if strings.HasPrefix(contentType, "text/html") {
				htmlPart = string(body)
			} else if strings.HasPrefix(contentType, "text/plain") {
				textPart = "<pre>" + escapeHTML(string(body)) + "</pre>"
			}
			part.Close()
			partCount++
		}
		if htmlPart != "" {
			bodyContent = htmlPart
		} else if textPart != "" {
			bodyContent = textPart
		}
		if bodyContent == "" {
			bodyContent = "No content found"
		}
		return bodyContent, attachments, nil
	} else if strings.HasPrefix(mediaType, "multipart/") {
		bodyContent, attachments, _ = extractBestBodyAndAttachments(msg.Body, msg.Header, attachmentDir, htmlPath)
		if bodyContent == "" {
			bodyContent = "No content found"
		}
		return bodyContent, attachments, nil
	} else {
		// Handle single part message
		body, err := io.ReadAll(msg.Body)
		if err != nil {
			return "", nil, err
		}

		if strings.HasPrefix(mediaType, "text/html") {
			bodyContent = string(body)
		} else {
			// Convert plain text to HTML
			bodyContent = "<pre>" + escapeHTML(string(body)) + "</pre>"
		}
	}

	if bodyContent == "" {
		bodyContent = "No content found"
	}

	return bodyContent, attachments, nil
}

// processAttachment handles attachment parts
func processAttachment(part *multipart.Part, attachmentDir, disposition, contentType, htmlPath string) (string, []string, error) {
	var attachments []string

	// Extract filename
	filename := extractFilename(disposition, contentType)
	if filename == "" {
		filename = fmt.Sprintf("attachment_%d", time.Now().UnixNano())
	}

	// Sanitize filename
	filename = sanitizeFilename(filename)

	// If filename is too long, generate a unique short name for saving and linking, but keep the original for display
	const maxFilenameLen = 50
	origFilename := filename
	if len(filename) > maxFilenameLen {
		ext := filepath.Ext(filename)
		filename = fmt.Sprintf("attachment_%d%s", time.Now().UnixNano(), ext)
	}

	// Create unique filename
	attachmentPath := getUniqueFilename(attachmentDir, filename)

	// Read attachment data with size limit (10MB max)
	const maxAttachmentSize = 10 * 1024 * 1024 // 10MB
	limitedReader := io.LimitReader(part, maxAttachmentSize)

	attachmentData, err := io.ReadAll(limitedReader)
	if err != nil {
		return "", nil, fmt.Errorf("failed to read attachment: %w", err)
	}

	// Handle encoding
	encoding := part.Header.Get("Content-Transfer-Encoding")
	if strings.ToLower(encoding) == "base64" {
		decoded, err := base64.StdEncoding.DecodeString(string(attachmentData))
		if err == nil {
			attachmentData = decoded
		} else {
			log.Printf("Warning: Failed to decode base64 attachment %s: %v", filename, err)
		}
	}

	// Write attachment file
	if err := os.WriteFile(attachmentPath, attachmentData, 0644); err != nil {
		return "", nil, fmt.Errorf("failed to write attachment: %w", err)
	}

	// If the attachment is an EML file, process it recursively
	if strings.HasSuffix(strings.ToLower(filename), ".eml") {
		success, htmlPathGenerated, err := convertEMLToHTML(attachmentPath, attachmentDir)
		if err != nil {
			log.Printf("Failed to recursively convert EML attachment %s: %v", attachmentPath, err)
		}
		if success && htmlPathGenerated != "" && htmlPathGenerated != attachmentPath {
			// Compute relative path from parent HTML to the generated HTML
			var relHTMLPath string
			if htmlPath != "" {
				htmlDir := filepath.Dir(htmlPath)
				rel, err := filepath.Rel(htmlDir, htmlPathGenerated)
				if err == nil {
					relHTMLPath = rel
				} else {
					relHTMLPath = filepath.Base(htmlPathGenerated)
				}
			} else {
				relHTMLPath = filepath.Base(htmlPathGenerated)
			}
			attachments = append(attachments, fmt.Sprintf(`<a target="_blank" href="%s" class="attachment-link">📄 %s (view as HTML)</a>`,
				relHTMLPath, escapeHTML(origFilename)))
			return "", attachments, nil
		}
	} else {
		// Compute relative path from HTML file to attachment
		var relAttachmentPath string
		if htmlPath != "" {
			htmlDir := filepath.Dir(htmlPath)
			rel, err := filepath.Rel(htmlDir, attachmentPath)
			if err == nil {
				relAttachmentPath = rel
			} else {
				relAttachmentPath = filepath.Base(attachmentPath)
			}
		} else {
			relAttachmentPath = filepath.Base(attachmentPath)
		}
		attachments = append(attachments, fmt.Sprintf(`<a target="_blank" href="%s" class="attachment-link">📎 %s (%s)</a>`,
			relAttachmentPath, escapeHTML(origFilename), formatFileSize(int64(len(attachmentData)))))
		return "", attachments, nil
	}
	return "", attachments, nil
}

// processBodyContent handles body content parts
func processBodyContent(part *multipart.Part, contentType string) (string, []string, error) {
	// Read body content with size limit (1MB max for body)
	const maxBodySize = 1024 * 1024 // 1MB
	limitedReader := io.LimitReader(part, maxBodySize)

	body, err := io.ReadAll(limitedReader)
	if err != nil {
		return "", nil, fmt.Errorf("failed to read part body: %w", err)
	}

	// Handle encoding
	encoding := part.Header.Get("Content-Transfer-Encoding")
	switch strings.ToLower(encoding) {
	case "base64":
		if decoded, err := base64.StdEncoding.DecodeString(string(body)); err == nil {
			body = decoded
		} else {
			log.Printf("Warning: Failed to decode base64 body content: %v", err)
		}
	case "quoted-printable":
		body = []byte(decodeQuotedPrintable(string(body)))
	}

	// Parse content type
	mediaType, _, err := mime.ParseMediaType(contentType)
	if err != nil {
		mediaType = "text/plain"
	}

	var content string
	switch {
	case strings.HasPrefix(mediaType, "text/html"):
		content = string(body)
	case strings.HasPrefix(mediaType, "text/plain"):
		content = "<pre>" + escapeHTML(string(body)) + "</pre>"
	default:
		content = fmt.Sprintf("<p><i>Content type: %s</i></p><pre>%s</pre>",
			escapeHTML(mediaType), escapeHTML(string(body)))
	}

	return content, nil, nil
}

// formatFileSize returns a human-readable file size
func formatFileSize(size int64) string {
	const unit = 1024
	if size < unit {
		return fmt.Sprintf("%d B", size)
	}
	div, exp := int64(unit), 0
	for n := size / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(size)/float64(div), "KMGTPE"[exp])
}

// extractFilename extracts filename from Content-Disposition or Content-Type headers
func extractFilename(disposition, contentType string) string {
	// Try Content-Disposition first
	if disposition != "" {
		re := regexp.MustCompile(`filename[*]?=["']?([^"';]+)["']?`)
		matches := re.FindStringSubmatch(disposition)
		if len(matches) > 1 {
			return matches[1]
		}
	}

	// Try Content-Type
	if contentType != "" {
		re := regexp.MustCompile(`name[*]?=["']?([^"';]+)["']?`)
		matches := re.FindStringSubmatch(contentType)
		if len(matches) > 1 {
			return matches[1]
		}
	}

	return ""
}

// decodeQuotedPrintable performs basic quoted-printable decoding
func decodeQuotedPrintable(s string) string {
	// Basic implementation - replace =XX with actual characters
	re := regexp.MustCompile(`=([0-9A-Fa-f]{2})`)
	result := re.ReplaceAllStringFunc(s, func(match string) string {
		hex := match[1:]
		if len(hex) == 2 {
			var b byte
			fmt.Sscanf(hex, "%02x", &b)
			return string(b)
		}
		return match
	})

	// Remove soft line breaks (=\r\n or =\n)
	result = strings.ReplaceAll(result, "=\r\n", "")
	result = strings.ReplaceAll(result, "=\n", "")

	return result
}

// convertMSG handles MSG file conversion (calls Python)
func convertMSG(task conv.ConversionTask, userID string) (*conv.ConversionResult, error) {
	result := &conv.ConversionResult{
		Status:         "processing",
		ConversionType: "msg",
		Path:           task.Path,
		StartTime:      time.Now(),
		TaskID:         task.TaskID,
		ConvertedFiles: []string{},
		FailedFiles:    []string{},
	}

	msgFiles, err := findMSGFiles(task.Path)
	if err != nil {
		return nil, fmt.Errorf("failed to find MSG files: %w", err)
	}

	totalFiles := len(msgFiles)
	emitEvent("conversion_started", map[string]interface{}{
		"conversion_type": "msg",
		"total_files":     totalFiles,
		"task_id":         task.TaskID,
	}, userID)

	for i, msgFile := range msgFiles {
		emitEvent("file_progress", map[string]interface{}{
			"conversion_type": "msg",
			"current_file":    msgFile,
			"converted_count": len(result.ConvertedFiles),
			"failed_count":    len(result.FailedFiles),
			"total_files":     totalFiles,
			"index":           i + 1,
			"task_id":         task.TaskID,
			"progress":        float64(i) / float64(totalFiles) * 100,
		}, userID)
		relPath, err := filepath.Rel(task.Path, msgFile)
		if err != nil {
			relPath = filepath.Base(msgFile)
		}
		// Remove the file extension and get directory parts
		relDir := filepath.Dir(relPath)
		// fileName := strings.TrimSuffix(filepath.Base(relPath), filepath.Ext(relPath))
		// Create output directory structure
		htmlDir := filepath.Join(task.OutputPath, "Converted_MSG", relDir)
		if err := os.MkdirAll(htmlDir, 0755); err != nil {
			// handle error, emit event, etc.
			continue
		}
		// Pass htmlDir as the output directory to the Python script
		pyResult, err := callPythonConverter("msg", msgFile, htmlDir, userID, task.TaskID)
		if err != nil || (pyResult != nil && len(pyResult.FailedFiles) > 0) {
			var errorMsg string
			if err != nil {
				errorMsg = err.Error()
			} else if pyResult != nil && len(pyResult.FailedFiles) > 0 {
				errorMsg = "Python conversion failed for this file"
			} else {
				errorMsg = "Unknown error"
			}
			emitEvent("file_conversion_failed", map[string]interface{}{
				"file":            msgFile,
				"error":           errorMsg,
				"index":           i + 1,
				"conversion_type": "msg",
				"task_id":         task.TaskID,
			}, userID)
			result.FailedFiles = append(result.FailedFiles, msgFile)
			continue
		}

		result.ConvertedFiles = append(result.ConvertedFiles, pyResult.ConvertedFiles...)
		emitEvent("file_progress", map[string]interface{}{
			"conversion_type": "msg",
			"current_file":    msgFile,
			"converted_count": len(result.ConvertedFiles),
			"failed_count":    len(result.FailedFiles),
			"total_files":     totalFiles,
			"index":           i + 1,
			"task_id":         task.TaskID,
			"progress":        float64(i+1) / float64(totalFiles) * 100,
		}, userID)
	}

	result.Status = "completed"
	result.TotalFiles = totalFiles
	result.TotalConverted = len(result.ConvertedFiles)
	result.TotalFailed = len(result.FailedFiles)
	result.EndTime = time.Now()
	return result, nil
}

// findMSGFiles recursively finds all MSG files in a directory
func findMSGFiles(dir string) ([]string, error) {
	var msgFiles []string
	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && strings.HasSuffix(strings.ToLower(info.Name()), ".msg") {
			msgFiles = append(msgFiles, path)
		}
		return nil
	})
	return msgFiles, err
}

// callPythonConverter runs the Python converter and returns a parsed result structure.
func callPythonConverter(conversionType, inputPath, outputDir, userID, taskID string) (*conv.ConversionResult, error) {
	// Prefer python3 on Ubuntu, fallback to python
	python := "python3"
	if _, err := exec.LookPath(python); err != nil {
		python = "python"
	}

	script := filepath.Join("lib", "convert_email.py")
	cmd := exec.Command(python, script, "--type", conversionType, "--input", inputPath, "--output", outputDir)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("python error: %v, stderr: %s, stdout: %s", err, strings.TrimSpace(stderr.String()), strings.TrimSpace(stdout.String()))
	}

	// Parse JSON strictly from stdout. Many libraries log to stderr (tzlocal, etc.).
	out := strings.TrimSpace(stdout.String())
	var py struct {
		ConvertedFiles []string `json:"converted_files"`
		FailedFiles    []string `json:"failed_files"`
		Error          string   `json:"error"`
		Traceback      string   `json:"traceback"`
	}
	if err := json.Unmarshal([]byte(out), &py); err != nil {
		return nil, fmt.Errorf("json parse error: %v; stdout: %s; stderr: %s", err, out, strings.TrimSpace(stderr.String()))
	}
	if py.Error != "" {
		return nil, fmt.Errorf("python script error: %s\n%s", py.Error, py.Traceback)
	}
	return &conv.ConversionResult{
		ConvertedFiles: py.ConvertedFiles,
		FailedFiles:    py.FailedFiles,
		Status:         "completed",
		ConversionType: conversionType,
		Path:           inputPath,
		TaskID:         taskID,
	}, nil
}

// convertWithPython calls the provided Python script for MSG and PST conversion.
func convertWithPython(fileType, inputPath, outputDir string) (bool, string, error) {
	pythonScriptPath := filepath.Join("lib", "convert_email.py")
	typeOutputDir := filepath.Join(outputDir, "Converted_"+strings.ToUpper(fileType))
	_ = os.MkdirAll(typeOutputDir, 0o755)

	// Prefer python3 on Ubuntu
	python := "python3"
	if _, err := exec.LookPath(python); err != nil {
		python = "python"
	}

	cmd := exec.Command(python, pythonScriptPath, "--type", fileType, "--input", inputPath, "--output", typeOutputDir)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		log.Printf("Python script error for %s: %v\nStdout: %s\nStderr: %s",
			inputPath, err, stdout.String(), stderr.String())
		return false, "", fmt.Errorf("python conversion failed: %v", err)
	}

	// Parse JSON strictly from stdout to determine converted files
	out := strings.TrimSpace(stdout.String())
	var py struct {
		ConvertedFiles []string `json:"converted_files"`
		FailedFiles    []string `json:"failed_files"`
		Error          string   `json:"error"`
		Traceback      string   `json:"traceback"`
	}
	if err := json.Unmarshal([]byte(out), &py); err != nil {
		// If JSON parsing fails, still return success but point to output dir, and log context
		log.Printf("JSON parse error from python stdout for %s: %v; stdout: %s; stderr: %s", inputPath, err, out, strings.TrimSpace(stderr.String()))
		return true, typeOutputDir, nil
	}
	if py.Error != "" {
		log.Printf("Python reported error for %s: %s\n%s", inputPath, py.Error, py.Traceback)
		return false, "", fmt.Errorf("python script error: %s", py.Error)
	}
	if len(py.ConvertedFiles) > 0 {
		// Return the first converted file path for UI listing
		return true, py.ConvertedFiles[0], nil
	}
	// No files reported; consider this a failure
	return false, "", fmt.Errorf("no converted files returned by python")
}

// convertPST handles PST file conversion using the existing Python helper per PST file.
func convertPST(task conv.ConversionTask, userID string) (*conv.ConversionResult, error) {
	result := &conv.ConversionResult{
		Status:         "processing",
		ConversionType: "pst",
		Path:           task.Path,
		StartTime:      time.Now(),
		TaskID:         task.TaskID,
		ConvertedFiles: []string{},
		FailedFiles:    []string{},
	}

	pstFiles, err := findPSTFiles(task.Path)
	if err != nil {
		return nil, fmt.Errorf("failed to find PST files: %w", err)
	}
	totalFiles := len(pstFiles)
	if totalFiles == 0 {
		result.Status = "completed"
		result.EndTime = time.Now()
		return result, nil
	}

	emitEvent("conversion_started", map[string]interface{}{
		"conversion_type": "pst",
		"total_files":     totalFiles,
		"task_id":         task.TaskID,
	}, userID)

	converted := 0
	failed := 0

	for i, pstPath := range pstFiles {
		emitEvent("file_progress", map[string]interface{}{
			"conversion_type": "pst",
			"current_file":    pstPath,
			"converted_count": converted,
			"failed_count":    failed,
			"total_files":     totalFiles,
			"index":           i + 1,
			"task_id":         task.TaskID,
			"progress":        float64(i) / float64(totalFiles) * 100,
		}, userID)

		ok, outPath, err := convertWithPython("pst", pstPath, task.OutputPath)
		if err != nil || !ok {
			// Fallback to pffexport extraction + EML/MSG conversion
			if ok2, htmls, err2 := convertPSTViaPffexport(pstPath, task.OutputPath); err2 == nil && ok2 && len(htmls) > 0 {
				converted++
				result.ConvertedFiles = append(result.ConvertedFiles, htmls...)
			} else {
				failed++
				result.FailedFiles = append(result.FailedFiles, pstPath)
			}
		} else {
			converted++
			if outPath != "" {
				result.ConvertedFiles = append(result.ConvertedFiles, outPath)
			} else {
				result.ConvertedFiles = append(result.ConvertedFiles, pstPath)
			}
		}

		emitEvent("file_progress", map[string]interface{}{
			"conversion_type": "pst",
			"current_file":    pstPath,
			"converted_count": converted,
			"failed_count":    failed,
			"total_files":     totalFiles,
			"index":           i + 1,
			"task_id":         task.TaskID,
			"progress":        float64(i+1) / float64(totalFiles) * 100,
		}, userID)
	}

	result.Status = "completed"
	result.TotalFiles = totalFiles
	result.TotalConverted = converted
	result.TotalFailed = failed
	result.EndTime = time.Now()
	return result, nil
}

// findPSTFiles recursively finds all PST files in a directory
func findPSTFiles(dir string) ([]string, error) {
	var pstFiles []string
	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && strings.HasSuffix(strings.ToLower(info.Name()), ".pst") {
			pstFiles = append(pstFiles, path)
		}
		return nil
	})
	return pstFiles, err
}

// convertMBOX handles MBOX file conversion
func convertMBOX(task conv.ConversionTask, userID string) (*conv.ConversionResult, error) {
	result := &conv.ConversionResult{
		Status:         "processing",
		ConversionType: "mbox",
		Path:           task.Path,
		StartTime:      time.Now(),
		TaskID:         task.TaskID,
		ConvertedFiles: []string{},
		FailedFiles:    []string{},
	}

	// Find MBOX files
	mboxFiles, err := findMBOXFiles(task.Path)
	if err != nil {
		return nil, fmt.Errorf("failed to find MBOX files: %w", err)
	}

	if len(mboxFiles) == 0 {
		// No MBOX files found - return early with zero results
		log.Printf("No MBOX files found in %s for conversion", task.Path)
		result.TotalFiles = 0
		result.TotalSize = 0
		result.TotalConverted = 0
		result.TotalFailed = 0
		result.Status = "completed"

		return result, nil
	}

	// Calculate total size
	totalSize := int64(0)
	for _, file := range mboxFiles {
		if info, err := os.Stat(file); err == nil {
			totalSize += info.Size()
		}
	}

	result.TotalFiles = len(mboxFiles)
	result.TotalSize = totalSize

	// Emit conversion started
	emitEvent("conversion_started", map[string]interface{}{
		"conversion_type": "mbox",
		"total_files":     len(mboxFiles),
		"total_size":      totalSize,
		"task_id":         task.TaskID,
	}, userID)

	converted := 0
	failed := 0

	// Process each MBOX file
	for i, mboxFile := range mboxFiles {
		success, htmlPaths, err := convertMBOXToHTML(mboxFile, task.OutputPath)

		if success {
			converted++
			result.ConvertedFiles = append(result.ConvertedFiles, htmlPaths...)
		} else {
			failed++
			result.FailedFiles = append(result.FailedFiles, mboxFile)
			if err != nil {
				log.Printf("Failed to convert %s: %v", mboxFile, err)
			}
		}

		// Emit progress
		emitEvent("file_progress", map[string]interface{}{
			"conversion_type": "mbox",
			"current_file":    mboxFile,
			"success":         success,
			"progress":        float64(i+1) / float64(len(mboxFiles)) * 100,
			"converted_count": converted,
			"failed_count":    failed,
			"total_files":     len(mboxFiles),
			"task_id":         task.TaskID,
		}, userID)
	}

	result.TotalConverted = converted
	result.TotalFailed = failed
	result.Status = "completed"

	return result, nil
}

// findMBOXFiles recursively finds all MBOX files in a directory
func findMBOXFiles(dir string) ([]string, error) {
	var mboxFiles []string

	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if !info.IsDir() {
			ext := strings.ToLower(filepath.Ext(path))
			// MBOX files can have various extensions or no extension
			if ext == ".mbox" || ext == ".mbx" || ext == "" {
				// Check if it's likely an MBOX file by reading the first line
				if isMBOXFile(path) {
					mboxFiles = append(mboxFiles, path)
				}
			}
		}

		return nil
	})

	return mboxFiles, err
}

// isMBOXFile checks if a file is likely an MBOX file
func isMBOXFile(filePath string) bool {
	file, err := os.Open(filePath)
	if err != nil {
		return false
	}
	defer file.Close()

	// Read first line
	scanner := bufio.NewScanner(file)
	if scanner.Scan() {
		firstLine := scanner.Text()
		// MBOX files typically start with "From " (note the space)
		return strings.HasPrefix(firstLine, "From ")
	}

	return false
}

// convertMBOXToHTML converts an MBOX file to HTML format

// buildEmailHTML builds HTML content for an email message
func buildEmailHTML(msg *mail.Message, attachmentLinks []string, originalPath string) string {
	subject := msg.Header.Get("Subject")
	if subject == "" {
		subject = "No Subject"
	}
	from := msg.Header.Get("From")
	dateStr := msg.Header.Get("Date")
	if dateStr == "" {
		dateStr = "Unknown Date"
	}

	headers := fmt.Sprintf(`<div class="header-field"><strong>From:</strong> %s</div>
<div class="header-field"><strong>Date:</strong> %s</div>`, escapeHTML(from), escapeHTML(dateStr))

	// Read body (best-effort)
	var bodyText string
	if msg != nil && msg.Body != nil {
		if b, err := io.ReadAll(msg.Body); err == nil {
			bodyText = escapeHTML(string(b))
		}
	}

	attachHTML := ""
	if len(attachmentLinks) > 0 {
		attachHTML = fmt.Sprintf(`<div class="attachments"><h3>📎 Attachments</h3>%s</div>`, strings.Join(attachmentLinks, ""))
	}

	html := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<title>%s</title>
	<style>
		body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
		.email-container { max-width: 800px; margin: 0 auto; }
		.header { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #28a745; }
		.header h2 { margin: 0 0 10px 0; color: #333; }
		.header-field { margin: 5px 0; }
		.header-field strong { color: #555; }
		.content { background: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 5px; margin-bottom: 20px; }
		.attachments { background: #f9f9f9; padding: 15px; border-radius: 5px; border-left: 4px solid #28a745; }
		.attachments h3 { margin: 0 0 10px 0; color: #333; }
		.attachment-link { display: inline-block; margin: 5px 10px 5px 0; padding: 5px 10px; background: #e9ecef; border-radius: 3px; text-decoration: none; color: #495057; }
		.attachment-link:hover { background: #dee2e6; }
		pre { white-space: pre-wrap; word-wrap: break-word; }
		.original-path { font-size: 0.9em; color: #666; margin-bottom: 15px; }
	</style>
	</head>
	<body>
		<div class="email-container">
			<div class="original-path"><strong>Original Path:</strong> %s</div>
			<div class="header">
				<h2>%s</h2>
				%s
			</div>
			<div class="content">%s</div>
			%s
		</div>
	</body>
</html>`, escapeHTML(subject), escapeHTML(originalPath), escapeHTML(subject), headers, bodyText, attachHTML)
	return html
}

// findPffexport tries PATH, env var, and common repo locations to locate pffexport(.exe)
func findPffexport() (string, error) {
	// 1) User-provided env var
	if v := os.Getenv("PFFEXPORT_PATH"); v != "" {
		if fi, err := os.Stat(v); err == nil && !fi.IsDir() {
			return v, nil
		}
	}

	// 2) PATH
	if p, err := exec.LookPath("pffexport"); err == nil {
		return p, nil
	}
	if p, err := exec.LookPath("pffexport.exe"); err == nil {
		return p, nil
	}

	// 3) Common repo locations
	candidates := []string{
		filepath.Join("libpff", "pffexport.exe"),
		filepath.Join("libpff", "pffexport"),
		filepath.Join("libpff", "bin", "pffexport.exe"),
		filepath.Join("libpff", "bin", "pffexport"),
		filepath.Join("libpff", "win64", "pffexport.exe"),
		filepath.Join("libpff", "win64", "pffexport"),
	}
	for _, c := range candidates {
		if fi, err := os.Stat(c); err == nil && !fi.IsDir() {
			return c, nil
		}
	}

	return "", fmt.Errorf("pffexport not found; set PFFEXPORT_PATH or add pffexport to PATH")
}

// convertPSTViaPffexport extracts PST to EML/MSG using pffexport, then converts to HTML
func convertPSTViaPffexport(pstPath, outputBase string) (bool, []string, error) {
	pff, err := findPffexport()
	if err != nil {
		return false, nil, err
	}

	base := strings.TrimSuffix(filepath.Base(pstPath), filepath.Ext(pstPath))
	base = sanitizeFilename(base)
	extractRoot := filepath.Join(outputBase, "PST_Extracted", base)

	if err := os.MkdirAll(extractRoot, 0755); err != nil {
		return false, nil, fmt.Errorf("failed to create extract dir: %w", err)
	}

	// pffexport basic usage: pffexport -o <outDir> <pst>
	cmd := exec.Command(pff, "-o", extractRoot, pstPath)
	out, cmdErr := cmd.CombinedOutput()
	if cmdErr != nil {
		return false, nil, fmt.Errorf("pffexport failed: %v, output: %s", cmdErr, string(out))
	}

	// Convert extracted EML/MSG to HTML
	var htmlPaths []string

	// EML
	emls, _ := findEMLFiles(extractRoot)
	for _, eml := range emls {
		ok, htmlPath, err := convertEMLToHTML(eml, outputBase)
		if err == nil && ok && htmlPath != "" {
			htmlPaths = append(htmlPaths, htmlPath)
		}
	}

	// MSG (use existing Python helper for MSG)
	msgs, _ := findMSGFiles(extractRoot)
	for _, msg := range msgs {
		ok, htmlPath, err := convertWithPython("msg", msg, outputBase)
		if err == nil && ok && htmlPath != "" {
			htmlPaths = append(htmlPaths, htmlPath)
		}
	}

	return len(htmlPaths) > 0, htmlPaths, nil
}
