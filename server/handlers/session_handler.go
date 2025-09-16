package handlers

import "github.com/gin-gonic/gin"

const TaskCookieName = "task_session" // replace with real cookie name if different

// AutomateTaskPage resets the task cookie and serves a fresh page/session
func AutomateTaskPage(c *gin.Context) {
    c.SetCookie(TaskCookieName, "", -1, "/", "", false, true)
    c.JSON(200, gin.H{"message": "fresh automate task page"})
}

// ClearTaskCookie explicitly clears the task cookie; invoke from frontend button
func ClearTaskCookie(c *gin.Context) {
    c.SetCookie(TaskCookieName, "", -1, "/", "", false, true)
    c.JSON(200, gin.H{"message": "task cookie cleared"})
}