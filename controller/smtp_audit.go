package controller

import (
	"errors"
	"net/http"
	"net/mail"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func ListSMTPAudits(c *gin.Context) {
	query := struct {
		model.SMTPAuditFilter
		Page     int `form:"p" binding:"gte=1"`
		PageSize int `form:"page_size" binding:"gte=1,lte=100"`
	}{Page: 1, PageSize: 20}
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid SMTP audit filters"})
		return
	}
	if query.Page-1 > int(^uint(0)>>1)/query.PageSize ||
		(query.StartTimestamp > 0 && query.EndTimestamp > 0 && query.StartTimestamp > query.EndTimestamp) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid SMTP audit range"})
		return
	}
	if query.Recipient != "" {
		address, err := mail.ParseAddress(query.Recipient)
		if err != nil || strings.ContainsAny(query.Recipient, ";\r\n") {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "recipient must be one email address"})
			return
		}
		query.Recipient = address.Address
	}
	items, total, err := model.ListSMTPAudits(c.Request.Context(), query.SMTPAuditFilter, (query.Page-1)*query.PageSize, query.PageSize)
	if err != nil {
		common.SysError("SMTP audit list query failed")
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "failed to load SMTP audits"})
		return
	}
	for i := range items {
		items[i].Sender = maskSMTPAuditAddresses(items[i].Sender)
		items[i].Recipient = maskSMTPAuditAddresses(items[i].Recipient)
		items[i].Events = ""
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"items": items, "total": total, "p": query.Page, "page_size": query.PageSize,
	}})
}

func GetSMTPAudit(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid SMTP audit ID"})
		return
	}
	row, err := model.GetSMTPAudit(c.Request.Context(), id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "SMTP audit not found"})
		return
	}
	if err != nil {
		common.SysError("SMTP audit detail query failed")
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "failed to load SMTP audit"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": row})
}

func maskSMTPAuditAddresses(value string) string {
	if value == "" {
		return ""
	}
	var masked strings.Builder
	for entry := range strings.SplitSeq(value, ";") {
		if masked.Len() > 0 {
			masked.WriteByte(';')
		}
		address, err := mail.ParseAddress(strings.TrimSpace(entry))
		if err != nil {
			masked.WriteString("***masked***")
			continue
		}
		// Quoted mailbox names may themselves contain '@'. Keep only the
		// final domain separator before passing through the shared masker.
		separator := strings.LastIndexByte(address.Address, '@')
		if separator < 0 {
			masked.WriteString("***masked***")
			continue
		}
		masked.WriteString(common.MaskEmail(address.Address[separator:]))
	}
	return masked.String()
}
