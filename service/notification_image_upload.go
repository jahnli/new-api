package service

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"

	"github.com/QuantumNous/new-api/common"
)

type notificationImageUpload struct {
	Filename string
	Data     []byte
}

func uploadFeishuNotificationImage(token string, image notificationImageUpload) (string, error) {
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
	req, err := http.NewRequest(http.MethodPost, feishuBaseURL+"/im/v1/images", &body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	resp, err := feishuHTTPClient().Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(resp.Body, 1024*1024))
	if err != nil {
		return "", err
	}
	result, err := feishuCheckResult(responseBody, resp.StatusCode)
	if err != nil {
		return "", err
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

func uploadDingTalkNotificationImage(token string, image notificationImageUpload) (string, error) {
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
	req, err := http.NewRequest(http.MethodPost, endpoint, &body)
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
