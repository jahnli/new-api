package service

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"time"

	"github.com/QuantumNous/new-api/common"
)

type notificationImageUpload struct {
	Filename string
	Data     []byte
}

func uploadFeishuNotificationImage(ctx context.Context, token string, image notificationImageUpload) (string, error) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	if err := writer.WriteField("image_type", "message"); err != nil {
		return "", err
	}
	part, err := writer.CreateFormFile("image", image.Filename)
	if err != nil {
		return "", err
	}
	if _, err := part.Write(image.Data); err != nil {
		return "", err
	}
	if err := writer.Close(); err != nil {
		return "", err
	}
	for attempt := 0; attempt <= feishuMaxRetries; attempt++ {
		if attempt > 0 {
			timer := time.NewTimer(time.Duration(attempt) * time.Second)
			select {
			case <-ctx.Done():
				timer.Stop()
				return "", ctx.Err()
			case <-timer.C:
			}
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, feishuBaseURL+"/im/v1/images", bytes.NewReader(body.Bytes()))
		if err != nil {
			return "", err
		}
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		resp, err := feishuHTTPClient().Do(req)
		if err != nil {
			return "", err
		}
		responseBody, readErr := io.ReadAll(io.LimitReader(resp.Body, 1024*1024))
		resp.Body.Close()
		if readErr != nil {
			return "", readErr
		}
		if (resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500) && attempt < feishuMaxRetries {
			continue
		}
		result, err := feishuCheckResult(responseBody, resp.StatusCode)
		if err != nil {
			return "", fmt.Errorf("%s: %w", image.Filename, err)
		}
		var data struct {
			ImageKey string `json:"image_key"`
		}
		if err := common.Unmarshal(result.Data, &data); err != nil {
			return "", err
		}
		if data.ImageKey == "" {
			return "", fmt.Errorf("Feishu image upload returned an empty image key")
		}
		return data.ImageKey, nil
	}
	return "", fmt.Errorf("Feishu image upload failed")
}

func uploadDingTalkNotificationImage(ctx context.Context, token string, image notificationImageUpload) (string, error) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("media", image.Filename)
	if err != nil {
		return "", err
	}
	if _, err := part.Write(image.Data); err != nil {
		return "", err
	}
	if err := writer.Close(); err != nil {
		return "", err
	}
	endpoint := dingTalkBaseURL + "/media/upload?access_token=" + url.QueryEscape(token) + "&type=image"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, &body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	resp, err := (&http.Client{Timeout: dingTalkHTTPTimeout}).Do(req)
	if err != nil {
		return "", fmt.Errorf("DingTalk image upload failed")
	}
	defer resp.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(resp.Body, 1024*1024))
	if err != nil {
		return "", err
	}
	var response struct {
		Errcode int    `json:"errcode"`
		Errmsg  string `json:"errmsg"`
		MediaID string `json:"media_id"`
	}
	if err := common.Unmarshal(responseBody, &response); err != nil {
		return "", err
	}
	if resp.StatusCode != http.StatusOK || response.Errcode != 0 || response.MediaID == "" {
		return "", fmt.Errorf("DingTalk image upload rejected: code=%d message=%s", response.Errcode, response.Errmsg)
	}
	return response.MediaID, nil
}
