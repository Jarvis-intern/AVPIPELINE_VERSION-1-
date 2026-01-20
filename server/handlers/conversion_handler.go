package handlers

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"mime"
	"net/http"
	"net/textproto"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jhillyerd/enmime"

	"gitlab.com/magnetite1/av-pipeline/server/helper"
	conv "gitlab.com/magnetite1/av-pipeline/server/interfaces"
	"gitlab.com/magnetite1/av-pipeline/server/logger"
	"gitlab.com/magnetite1/av-pipeline/server/sockets"
)

// HandleConversionUpload handles POST /api/convert/upload
func HandleConversionUpload(c *gin.Context) {
	if err := c.Request.ParseMultipartForm(64 << 20); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse form: " + err.Error()})
		return
	}

	conversionType := c.PostForm("conversion_type")
	userID := c.PostForm("user_id")
	files := c.Request.MultipartForm.File["files"]
	outputDir := strings.TrimSpace(c.PostForm("output_dir"))

	if userID == "" || len(files) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing required fields (user_id, files)"})
		return
	}

	taskID := fmt.Sprintf("conversion_%d", time.Now().UnixNano())
	uploadRoot := filepath.Join(os.TempDir(), "av-pipeline-uploads", taskID)
	if err := os.MkdirAll(uploadRoot, 0o755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create temp directory"})
		return
	}

	savedPaths := make([]string, 0, len(files))
	for _, fh := range files {
		dstPath := filepath.Join(uploadRoot, fh.Filename)
		if err := os.MkdirAll(filepath.Dir(dstPath), 0o755); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create subdirectory"})
			return
		}
		src, err := fh.Open()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open uploaded file"})
			return
		}
		out, err := os.Create(dstPath)
		if err != nil {
			src.Close()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create destination file"})
			return
		}
		if _, err := io.Copy(out, src); err != nil {
			out.Close()
			src.Close()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save uploaded file"})
			return
		}
		out.Close()
		src.Close()
		savedPaths = append(savedPaths, dstPath)
	}

	conversionRoot := uploadRoot
	if len(savedPaths) == 1 {
		conversionRoot = filepath.Dir(savedPaths[0])
	} else if len(savedPaths) > 1 {
		root := filepath.Dir(savedPaths[0])
		for _, p := range savedPaths[1:] {
			for !strings.HasPrefix(p, root+string(os.PathSeparator)) && root != string(os.PathSeparator) {
				root = filepath.Dir(root)
			}
		}
		if st, err := os.Stat(root); err == nil && st.IsDir() {
			conversionRoot = root
		}
	}

	task := conv.ConversionTask{Path: conversionRoot, ConversionType: conversionType, OutputPath: conversionRoot, TaskID: taskID}
	if outputDir != "" {
		if st, err := os.Stat(outputDir); err == nil && st.IsDir() {
			task.OutputPath = outputDir
		}
	}

	go processAdhocConversion(task, userID)

	c.JSON(http.StatusOK, gin.H{"message": "Upload successful. Conversion has started.", "task_id": taskID})
}

// HandleStartConversion handles websocket-based conversion requests
func HandleStartConversion(client *sockets.Client, data map[string]any) {
	if conversionID, ok := data["conversion_id"].(string); ok && conversionID != "" {
		go HandleAdhocConversion(client, data)
		return
	}
	if _, ok := data["task_id"].(string); ok {
		go HandleAutomationConversion(client, data)
		return
	}
	sockets.EmitError(client, "Missing required ID (conversion_id or task_id)", "conversion_error")
}

// HandleAdhocConversion starts a one-off conversion for a path
func HandleAdhocConversion(client *sockets.Client, data map[string]any) {
	path, _ := data["path"].(string)
	convType, _ := data["conversion_type"].(string)
	if path == "" {
		sockets.EmitError(client, "Missing required field: path", "conversion_error")
		return
	}
	taskID := fmt.Sprintf("conversion_%d", time.Now().UnixNano())
	task := conv.ConversionTask{Path: path, ConversionType: convType, OutputPath: path, TaskID: taskID}
	go processAdhocConversion(task, client.UserID)
}

// HandleAutomationConversion runs one or more conversion types for automation tasks
func HandleAutomationConversion(client *sockets.Client, data map[string]any) {
	userID := client.UserID
	taskID, _ := data["task_id"].(string)
	path, _ := data["path"].(string)
	list, _ := data["conversion_list"].([]interface{})
	if taskID == "" || path == "" || userID == "" || len(list) == 0 {
		sockets.EmitError(client, "Invalid conversion request", "conversion_error")
		SignalStageComplete(taskID, "CONVERSION")
		return
	}

	for _, it := range list {
		convType, _ := it.(string)
		task := conv.ConversionTask{Path: path, ConversionType: convType, OutputPath: path, TaskID: taskID}
		_ = processConversion(task, userID)
	}

	sockets.EmitToUser(userID, "conversion_complete", map[string]any{"path": path, "end_time": time.Now().Format(time.RFC3339), "task_id": taskID})
	logger.AppendActivity(logger.ActivityRecord{Type: "conversion_stage", TaskID: taskID, Status: "done", Meta: map[string]any{"path": path}})
	SignalStageComplete(taskID, "CONVERSION")
}

// Orchestration
func processAdhocConversion(task conv.ConversionTask, userID string) {
	_ = processConversion(task, userID)
}

func processConversion(task conv.ConversionTask, userID string) *conv.ConversionResult {
	start := time.Now()
	convType := strings.ToUpper(task.ConversionType)
	sockets.EmitToUser(userID, "conversion_started", map[string]any{"conversion_type": convType, "path": task.Path, "start_time": start.Format(time.RFC3339), "task_id": task.TaskID})

	// Phase 1: Extract everything recursively (with password prompts) before any conversion
	extractNestedArchivesRecursivelyWithPrompt(task.Path, userID, task.TaskID)

	// Phase 2: Convert only .eml/.mbox in a single stateless pass
	res, err := convertAnyToHTML(task)
	end := time.Now()
	if err != nil {
		sockets.EmitToUser(userID, "conversion_error", map[string]any{"error": err.Error(), "conversion_type": convType, "path": task.Path, "task_id": task.TaskID})
		return &conv.ConversionResult{Status: "error", ConversionType: convType, Path: task.Path, StartTime: start, EndTime: end, TaskID: task.TaskID, Error: err.Error()}
	}
	if res == nil {
		res = &conv.ConversionResult{Status: "completed", ConversionType: convType, Path: task.Path, StartTime: start, EndTime: end, TaskID: task.TaskID}
	} else {
		res.EndTime = end
	}
	sockets.EmitToUser(userID, "conversion_type_complete", map[string]any{
		"conversion_type": convType,
		"path":            res.Path,
		"start_time":      res.StartTime.Format(time.RFC3339),
		"end_time":        res.EndTime.Format(time.RFC3339),
		"total_files":     res.TotalFiles,
		"total_size":      res.TotalSize,
		"total_converted": res.TotalConverted,
		"total_failed":    res.TotalFailed,
		"converted_files": res.ConvertedFiles,
		"failed_files":    res.FailedFiles,
		"task_id":         res.TaskID,
	})
	for _, p := range res.ConvertedFiles {
		logger.AppendActivity(logger.ActivityRecord{Type: "conversion_file", TaskID: task.TaskID, File: p, Status: "converted", Meta: map[string]any{"conversion_type": task.ConversionType}})
	}
	for _, p := range res.FailedFiles {
		logger.AppendActivity(logger.ActivityRecord{Type: "conversion_file", TaskID: task.TaskID, File: p, Status: "failed", Meta: map[string]any{"conversion_type": task.ConversionType}})
	}
	return res
}

// Walk the folder and convert .eml, .mbox, .msg, and .pst files
func convertAnyToHTML(task conv.ConversionTask) (*conv.ConversionResult, error) {
	result := &conv.ConversionResult{Status: "completed", ConversionType: strings.ToUpper(task.ConversionType), Path: task.Path, StartTime: time.Now(), TaskID: task.TaskID}
	// Scan for all supported email formats
	var emls, mboxes, msgs, psts []string
	err := filepath.WalkDir(task.Path, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		switch strings.ToLower(filepath.Ext(path)) {
		case ".eml":
			emls = append(emls, path)
		case ".mbox":
			mboxes = append(mboxes, path)
		case ".msg":
			msgs = append(msgs, path)
		case ".pst":
			psts = append(psts, path)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	sort.Strings(emls)
	sort.Strings(mboxes)
	sort.Strings(msgs)
	sort.Strings(psts)

	// Convert EML files (native Go)
	for _, p := range emls {
		if err := convertEMLToHTML(p); err == nil {
			out := strings.TrimSuffix(p, filepath.Ext(p)) + ".html"
			result.TotalConverted++
			result.ConvertedFiles = append(result.ConvertedFiles, out)
		} else {
			result.TotalFailed++
			result.FailedFiles = append(result.FailedFiles, p)
		}
	}

	// Convert MBOX files (native Go)
	for _, p := range mboxes {
		if err := convertMBOXToHTML(p); err == nil {
			out := filepath.Join(strings.TrimSuffix(p, filepath.Ext(p)), "index.html")
			result.TotalConverted++
			result.ConvertedFiles = append(result.ConvertedFiles, out)
		} else {
			result.TotalFailed++
			result.FailedFiles = append(result.FailedFiles, p)
		}
	}

	// Convert MSG files (via Python script)
	for _, p := range msgs {
		outDir := strings.TrimSuffix(p, filepath.Ext(p))
		converted, failed := convertViaPython("msg", p, outDir)
		result.ConvertedFiles = append(result.ConvertedFiles, converted...)
		result.FailedFiles = append(result.FailedFiles, failed...)
		result.TotalConverted += len(converted)
		result.TotalFailed += len(failed)
	}

	// Convert PST files (via Python script)
	for _, p := range psts {
		outDir := strings.TrimSuffix(p, filepath.Ext(p))
		converted, failed := convertViaPython("pst", p, outDir)
		result.ConvertedFiles = append(result.ConvertedFiles, converted...)
		result.FailedFiles = append(result.FailedFiles, failed...)
		result.TotalConverted += len(converted)
		result.TotalFailed += len(failed)
	}

	result.TotalFiles = len(emls) + len(mboxes) + len(msgs) + len(psts)
	return result, nil
}

// convertViaPython calls the Python convert_email.py script for MSG and PST files
func convertViaPython(fileType, inputPath, outputDir string) (converted []string, failed []string) {
	// Get the path to the Python script
	execPath, err := os.Executable()
	if err != nil {
		return nil, []string{inputPath}
	}
	serverDir := filepath.Dir(execPath)
	// Try multiple possible locations for the Python script
	pythonScript := filepath.Join(serverDir, "lib", "convert_email.py")
	if _, err := os.Stat(pythonScript); os.IsNotExist(err) {
		// Try relative to current working directory
		pythonScript = filepath.Join("lib", "convert_email.py")
		if _, err := os.Stat(pythonScript); os.IsNotExist(err) {
			// Try absolute path from server directory
			pythonScript = filepath.Join(filepath.Dir(filepath.Dir(execPath)), "server", "lib", "convert_email.py")
			if _, err := os.Stat(pythonScript); os.IsNotExist(err) {
				// Fallback: try current directory structure
				cwd, _ := os.Getwd()
				pythonScript = filepath.Join(cwd, "lib", "convert_email.py")
			}
		}
	}

	// Ensure output directory exists
	if err := os.MkdirAll(outputDir, 0o755); err != nil {
		return nil, []string{inputPath}
	}

	// Run Python script: python3 convert_email.py --type <type> --input <path> --output <dir>
	cmd := exec.Command("python3", pythonScript, "--type", fileType, "--input", inputPath, "--output", outputDir)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err = cmd.Run()
	output := stdout.Bytes()

	if err != nil {
		// Log the error but don't fail completely
		fmt.Printf("Python conversion error for %s: %v\nStderr: %s\nStdout: %s\n", inputPath, err, stderr.String(), string(output))
		return nil, []string{inputPath}
	}

	// Parse JSON output from Python script
	var result struct {
		ConvertedFiles []string `json:"converted_files"`
		FailedFiles    []string `json:"failed_files"`
		Error          string   `json:"error"`
	}
	if err := json.Unmarshal(output, &result); err != nil {
		fmt.Printf("Failed to parse Python output for %s: %v\nStdout: %s\nStderr: %s\n", inputPath, err, string(output), stderr.String())
		return nil, []string{inputPath}
	}

	if result.Error != "" {
		fmt.Printf("Python conversion reported error for %s: %s\n", inputPath, result.Error)
		return result.ConvertedFiles, append(result.FailedFiles, inputPath)
	}

	return result.ConvertedFiles, result.FailedFiles
}

// EML/MBOX Conversion
type attachmentPart struct {
	Header    textproto.MIMEHeader
	Content   []byte
	FileName  string
	MediaType string
	ContentID string
}

func convertEMLToHTML(path string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	env, err := enmime.ReadEnvelope(bufio.NewReader(f))
	if err != nil {
		return err
	}
	body, atts, cidMap := extractBestBodyAndAttachments(env)
	outDir := strings.TrimSuffix(path, filepath.Ext(path))
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return err
	}
	var assets []string
	savedByCID := map[string]string{}
	// Place attachments into a dedicated subfolder under the EML output dir
	attachDir := filepath.Join(outDir, "attachments")
	if err := os.MkdirAll(attachDir, 0o755); err != nil {
		return err
	}
	for _, a := range atts {
		sp, rel := processAttachment(attachDir, a)
		if sp != "" {
			// HTML lives at outDir+".html"; make path relative to HTML file directory
			href := filepath.ToSlash(filepath.Join(".", filepath.Base(outDir), "attachments", rel))
			assets = append(assets, href)
		}
		if sp != "" && a.ContentID != "" {
			cidPath := filepath.ToSlash(filepath.Join(".", filepath.Base(outDir), "attachments", filepath.Base(sp)))
			savedByCID[a.ContentID] = cidPath
		}
	}
	body = rewriteCIDSrcs(body, cidMap, savedByCID)
	html := createBasicHTML(filepath.Base(path), body, assets)
	return os.WriteFile(outDir+".html", []byte(html), 0o644)
}

func convertMBOXToHTML(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	chunks := splitMbox(data)
	outRoot := strings.TrimSuffix(path, filepath.Ext(path))
	if err := os.MkdirAll(outRoot, 0o755); err != nil {
		return err
	}
	var items []string
	for i, raw := range chunks {
		if len(bytes.TrimSpace(raw)) == 0 {
			continue
		}
		env, err := enmime.ReadEnvelope(bytes.NewReader(raw))
		if err != nil {
			continue
		}
		body, atts, cidMap := extractBestBodyAndAttachments(env)
		msgDir := filepath.Join(outRoot, fmt.Sprintf("msg_%06d", i+1))
		if err := os.MkdirAll(msgDir, 0o755); err != nil {
			return err
		}
		var assets []string
		savedByCID := map[string]string{}
		// Place attachments into a dedicated subfolder under the message dir
		attachDir := filepath.Join(msgDir, "attachments")
		if err := os.MkdirAll(attachDir, 0o755); err != nil {
			return err
		}
		for _, a := range atts {
			sp, rel := processAttachment(attachDir, a)
			if rel != "" {
				// Message HTML is at msgDir/index.html; attachments are at msgDir/attachments
				href := filepath.ToSlash(filepath.Join("attachments", rel))
				assets = append(assets, href)
			}
			if sp != "" && a.ContentID != "" {
				savedByCID[a.ContentID] = filepath.ToSlash(filepath.Join("attachments", filepath.Base(sp)))
			}
		}
		body = rewriteCIDSrcs(body, cidMap, savedByCID)
		html := createBasicHTML(fmt.Sprintf("Message %d", i+1), body, assets)
		if err := os.WriteFile(filepath.Join(msgDir, "index.html"), []byte(html), 0o644); err != nil {
			return err
		}
		items = append(items, fmt.Sprintf("<li><a href=\"%s\">Message %d</a></li>", filepath.Join(filepath.Base(msgDir), "index.html"), i+1))
	}
	index := "<html><head><meta charset=\"utf-8\"><title>MBOX</title></head><body><h1>MBOX Messages</h1><ul>" + strings.Join(items, "\n") + "</ul></body></html>"
	return os.WriteFile(filepath.Join(outRoot, "index.html"), []byte(index), 0o644)
}

func splitMbox(b []byte) [][]byte {
	lines := bytes.Split(b, []byte("\n"))
	var chunks [][]byte
	var cur [][]byte
	for _, ln := range lines {
		if bytes.HasPrefix(ln, []byte("From ")) && len(cur) > 0 {
			chunks = append(chunks, bytes.Join(cur, []byte("\n")))
			cur = nil
		}
		cur = append(cur, ln)
	}
	if len(cur) > 0 {
		chunks = append(chunks, bytes.Join(cur, []byte("\n")))
	}
	return chunks
}

func extractBestBodyAndAttachments(env *enmime.Envelope) (string, []*attachmentPart, map[string]string) {
	html := env.HTML
	if html == "" && env.Text != "" {
		html = "<pre>" + escapeHTML(env.Text) + "</pre>"
	}
	if html == "" {
		html = "<i>No body</i>"
	}
	var atts []*attachmentPart
	inlineMap := map[string]string{}
	all := append([]*enmime.Part{}, env.Inlines...)
	all = append(all, env.Attachments...)
	for _, p := range all {
		disp := strings.ToLower(p.Disposition)
		cid := strings.Trim(p.ContentID, "<>")
		mt := p.ContentType
		fn := p.FileName
		if fn == "" {
			if _, params, err := mime.ParseMediaType(p.Header.Get("Content-Type")); err == nil {
				if n, ok := params["name"]; ok {
					fn = n
				}
			}
		}
		if fn == "" {
			fn = helper.SanitizeFilename(fmt.Sprintf("part-%s", uuid.New().String()))
		}
		mediaType := mt
		if v, _, err := mime.ParseMediaType(mt); err == nil {
			mediaType = v
		}
		data := p.Content
		if len(data) == 0 && p.ContentReader != nil {
			buf := new(bytes.Buffer)
			io.Copy(buf, p.ContentReader)
			data = buf.Bytes()
		}
		part := &attachmentPart{Header: p.Header, Content: data, FileName: fn, MediaType: mediaType, ContentID: cid}
		if cid != "" && strings.HasPrefix(mediaType, "image/") {
			inlineMap[cid] = fn
		}
		// Include a broader set of attachment media types, including text/html and message/*
		if disp == "attachment" || strings.HasPrefix(mediaType, "application/") || strings.HasPrefix(mediaType, "image/") || strings.HasPrefix(mediaType, "audio/") || strings.HasPrefix(mediaType, "video/") || (strings.HasPrefix(mediaType, "text/") && (mediaType == "text/html" || fn != "")) || strings.HasPrefix(mediaType, "message/") {
			atts = append(atts, part)
		}
	}
	return html, atts, inlineMap
}

func processAttachment(dstDir string, part *attachmentPart) (savedPath, relRef string) {
	if part == nil {
		return "", ""
	}
	// Determine a safe, bounded filename and infer extension if missing
	name := safeFileName(part.FileName, part.MediaType)
	if name == "" {
		name = fmt.Sprintf("file-%s.bin", uuid.New().String())
	}
	abs, _ := helper.GetUniqueFilename(dstDir, name)
	if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
		return "", ""
	}
	out, err := os.Create(abs)
	if err != nil {
		return "", ""
	}
	defer out.Close()
	// IMPORTANT: enmime already decodes attachments. Write bytes as-is to avoid double-decoding corruption.
	if _, err := out.Write(part.Content); err != nil {
		return "", ""
	}
	// Do NOT perform ad-hoc zip extraction here; rely on extractNestedArchivesRecursively to handle all formats uniformly.
	rel, _ := filepath.Rel(dstDir, abs)
	return abs, rel
}

// removed decodedReader and ad-hoc zip streaming; attachment bytes are already decoded by enmime

func rewriteCIDSrcs(html string, inline map[string]string, saved map[string]string) string {
	if len(inline) == 0 || html == "" {
		return html
	}
	re := regexp.MustCompile(`(?i)src\s*=\s*"cid:([^"]+)"`)
	return re.ReplaceAllStringFunc(html, func(m string) string {
		sub := re.FindStringSubmatch(m)
		if len(sub) < 2 {
			return m
		}
		cid := sub[1]
		if fn, ok := saved[cid]; ok {
			return strings.Replace(m, "cid:"+cid, fn, 1)
		}
		if fn, ok := inline[cid]; ok {
			return strings.Replace(m, "cid:"+cid, fn, 1)
		}
		return m
	})
}

func createBasicHTML(title, body string, assets []string) string {
	var b strings.Builder
	b.WriteString("<html><head><meta charset=\"utf-8\"><title>")
	b.WriteString(escapeHTML(title))
	b.WriteString("</title></head><body>")
	b.WriteString(body)
	if len(assets) > 0 {
		b.WriteString("<h3>Attachments</h3><ul>")
		for _, a := range assets {
			b.WriteString("<li><a href=\"")
			b.WriteString(escapeHTML(a))
			b.WriteString("\">")
			b.WriteString(escapeHTML(filepath.Base(a)))
			b.WriteString("</a></li>")
		}
		b.WriteString("</ul>")
	}
	b.WriteString("</body></html>")
	return b.String()
}

func escapeHTML(s string) string {
	r := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", "\"", "&quot;", "'", "&#39;")
	return r.Replace(s)
}

// safeFileName enforces a safe filename, infers an extension from media type when missing,
// and truncates overly long names to avoid OS path limitations.
func safeFileName(original, mediaType string) string {
	name := strings.TrimSpace(original)
	name = filepath.Base(name)
	name = helper.SanitizeFilename(name)

	// Infer extension if missing
	ext := strings.ToLower(filepath.Ext(name))
	if ext == "" {
		if mt := strings.ToLower(strings.TrimSpace(mediaType)); mt != "" {
			extMap := map[string]string{
				"text/html":          ".html",
				"text/plain":         ".txt",
				"message/rfc822":     ".eml",
				"application/pdf":    ".pdf",
				"application/msword": ".doc",
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
				"application/vnd.ms-excel": ".xls",
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":         ".xlsx",
				"application/vnd.ms-powerpoint":                                             ".ppt",
				"application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
				"image/jpeg":                   ".jpg",
				"image/jpg":                    ".jpg",
				"image/png":                    ".png",
				"image/gif":                    ".gif",
				"image/bmp":                    ".bmp",
				"image/tiff":                   ".tif",
				"application/zip":              ".zip",
				"application/x-7z-compressed":  ".7z",
				"application/x-rar-compressed": ".rar",
				"application/x-tar":            ".tar",
				"application/gzip":             ".gz",
				"application/x-bzip2":          ".bz2",
				"application/x-xz":             ".xz",
			}
			if e, ok := extMap[mt]; ok {
				// If name is empty after sanitize, generate one
				if name == "" || name == "." || name == ".." {
					name = fmt.Sprintf("file-%s%s", uuid.New().String(), e)
				} else {
					name = name + e
				}
				ext = e
			}
		}
	}

	// Truncate base to keep total length reasonable
	const maxLen = 200 // keeps room for unique suffixes
	if len(name) > maxLen {
		base := strings.TrimSuffix(name, ext)
		keep := maxLen - len(ext)
		if keep < 1 {
			keep = maxLen
		}
		if len(base) > keep {
			base = base[:keep]
		}
		name = base + ext
	}
	if name == "" {
		name = fmt.Sprintf("file-%s.bin", uuid.New().String())
	}
	return name
}

// extractNestedArchivesRecursively scans a directory tree for archives and extracts them repeatedly until no more archives are found.
// (legacy) extractNestedArchivesRecursively removed in favor of password-aware variant

// extractNestedArchivesRecursivelyWithPrompt is similar to extractNestedArchivesRecursively, but requests passwords via WebSocket
// when encountering password-protected archives. If the password arrives later through the EXTRACT stage, user can rerun conversion.
func extractNestedArchivesRecursivelyWithPrompt(root, userID, taskID string) {
	queue := []string{root}
	processed := make(map[string]struct{})

	for len(queue) > 0 {
		dir := queue[0]
		queue = queue[1:]

		_ = filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
			if err != nil || d.IsDir() {
				return nil
			}
			nameLower := strings.ToLower(d.Name())
			ext := strings.ToLower(filepath.Ext(nameLower))
			if strings.HasSuffix(nameLower, ".tar.gz") {
				ext = ".tar.gz"
			} else if strings.HasSuffix(nameLower, ".tar.xz") {
				ext = ".tar.xz"
			} else if strings.HasSuffix(nameLower, ".tar.bz2") {
				ext = ".tar.bz2"
			} else if strings.HasSuffix(nameLower, ".tgz") {
				ext = ".tgz"
			} else if strings.HasSuffix(nameLower, ".txz") {
				ext = ".txz"
			}
			if !SupportedArchiveFormats[ext] {
				return nil
			}
			if _, seen := processed[path]; seen {
				return nil
			}
			processed[path] = struct{}{}

			base := filepath.Base(path)
			baseName := base
			switch {
			case strings.HasSuffix(strings.ToLower(base), ".tar.gz"):
				baseName = strings.TrimSuffix(base, ".tar.gz")
			case strings.HasSuffix(strings.ToLower(base), ".tar.xz"):
				baseName = strings.TrimSuffix(base, ".tar.xz")
			case strings.HasSuffix(strings.ToLower(base), ".tar.bz2"):
				baseName = strings.TrimSuffix(base, ".tar.bz2")
			default:
				baseName = strings.TrimSuffix(base, filepath.Ext(base))
			}
			dest := filepath.Join(filepath.Dir(path), baseName+"_extracted")
			_ = os.MkdirAll(dest, 0o755)

			handler := GetArchiveHandler(ext)
			if handler == nil {
				return nil
			}

			// Try without password first
			ok, msg := handler(path, "", dest)
			if !ok && (strings.Contains(strings.ToLower(msg), "password") || strings.Contains(strings.ToLower(msg), "encrypted")) {
				// Ask the UI for a password
				sockets.EmitToUser(userID, "conversion_password_required", map[string]any{
					"task_id":       taskID,
					"archive_name":  base,
					"archive_path":  path,
					"suggested_dir": dest,
					"message":       "Password required to extract archive during conversion.",
				})
				return nil
			}
			if ok {
				queue = append(queue, dest)
			}
			return nil
		})
	}
}
