package relay

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/sjson"
)

func addImageGenerationDetail(details map[string]interface{}, key string, value interface{}) {
	if value == nil {
		return
	}

	switch typedValue := value.(type) {
	case string:
		if typedValue != "" {
			details[key] = typedValue
		}
	case *bool:
		if typedValue != nil {
			details[key] = *typedValue
		}
	case json.RawMessage:
		if len(typedValue) == 0 || string(typedValue) == "null" {
			return
		}
		var decodedValue interface{}
		if err := common.Unmarshal(typedValue, &decodedValue); err == nil {
			details[key] = decodedValue
			return
		}
		details[key] = string(typedValue)
	default:
		details[key] = typedValue
	}
}

func buildImageGenerationDetails(request *dto.ImageRequest, imageCount uint, quality string) map[string]interface{} {
	details := make(map[string]interface{})
	addImageGenerationDetail(details, "size", request.Size)
	addImageGenerationDetail(details, "quality", quality)
	addImageGenerationDetail(details, "count", imageCount)
	addImageGenerationDetail(details, "response_format", request.ResponseFormat)
	addImageGenerationDetail(details, "style", request.Style)
	addImageGenerationDetail(details, "background", request.Background)
	addImageGenerationDetail(details, "moderation", request.Moderation)
	addImageGenerationDetail(details, "output_format", request.OutputFormat)
	addImageGenerationDetail(details, "output_compression", request.OutputCompression)
	addImageGenerationDetail(details, "partial_images", request.PartialImages)
	addImageGenerationDetail(details, "stream", request.Stream)
	addImageGenerationDetail(details, "input_fidelity", request.InputFidelity)
	addImageGenerationDetail(details, "watermark", request.Watermark)
	addImageGenerationDetail(details, "watermark_enabled", request.WatermarkEnabled)
	return details
}

func ImageHelper(c *gin.Context, info *relaycommon.RelayInfo) (AIGatewayError *types.AIGatewayError) {
	info.InitChannelMeta(c)
	info.BillingImageCount = nil
	info.ImageRequestCount = 0

	imageReq, ok := info.Request.(*dto.ImageRequest)
	if !ok {
		return types.NewErrorWithStatusCode(fmt.Errorf("invalid request type, expected dto.ImageRequest, got %T", info.Request), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}

	request, err := common.DeepCopy(imageReq)
	if err != nil {
		return types.NewError(fmt.Errorf("failed to copy request to ImageRequest: %w", err), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}

	err = helper.ModelMappedHelper(c, info, request)
	if err != nil {
		return types.NewError(err, types.ErrorCodeChannelModelMappedError, types.ErrOptionWithSkipRetry())
	}

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)
	imageCount, err := request.ImageCount(info.ChannelType == constant.ChannelTypeAli)
	if err != nil {
		return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	promptExtend := request.BillingParameters != nil && request.BillingParameters.PromptExtend != nil && *request.BillingParameters.PromptExtend

	var requestBody io.Reader
	var jsonData []byte

	if model_setting.GetGlobalSettings().PassThroughRequestEnabled || info.ChannelSetting.PassThroughBodyEnabled {
		storage, err := common.GetBodyStorage(c)
		if err != nil {
			return types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		if strings.Contains(c.Request.Header.Get("Content-Type"), "multipart/form-data") {
			requestBody = common.NewReplayableBodyReader(storage)
		} else {
			jsonData, err = storage.Bytes()
			if err != nil {
				return types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
			}
		}
	} else {
		convertedRequest, err := adaptor.ConvertImageRequest(c, info, *request)
		if err != nil {
			return types.NewError(err, types.ErrorCodeConvertRequestFailed)
		}
		relaycommon.AppendRequestConversionFromRequest(info, convertedRequest)

		switch convertedRequest.(type) {
		case *bytes.Buffer:
			requestBody = convertedRequest.(io.Reader)
		default:
			jsonData, err = common.Marshal(convertedRequest)
			if err != nil {
				return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
			}

			// apply param override
			if len(info.ParamOverride) > 0 {
				jsonData, err = relaycommon.ApplyParamOverrideWithRelayInfo(jsonData, info)
				if err != nil {
					return AIGatewayErrorFromParamOverride(err)
				}

				var overriddenQuantity struct {
					N *uint `json:"n"`
				}
				if err = common.Unmarshal(jsonData, &overriddenQuantity); err != nil {
					return types.NewErrorWithStatusCode(
						fmt.Errorf("invalid image count after parameter override: %w", err),
						types.ErrorCodeConvertRequestFailed,
						http.StatusBadRequest,
						types.ErrOptionWithSkipRetry(),
					)
				}
				requestedQuantity := uint(1)
				if request.N != nil && *request.N > 0 {
					requestedQuantity = *request.N
				}
				if overriddenQuantity.N != nil && (*overriddenQuantity.N == 0 || *overriddenQuantity.N > dto.MaxImageN) {
					return types.NewErrorWithStatusCode(
						fmt.Errorf("image count after parameter override must be between 1 and %d", dto.MaxImageN),
						types.ErrorCodeConvertRequestFailed,
						http.StatusBadRequest,
						types.ErrOptionWithSkipRetry(),
					)
				}
				if overriddenQuantity.N != nil && *overriddenQuantity.N != requestedQuantity {
					return types.NewErrorWithStatusCode(
						fmt.Errorf("parameter override cannot change image count from %d to %d", requestedQuantity, *overriddenQuantity.N),
						types.ErrorCodeConvertRequestFailed,
						http.StatusBadRequest,
						types.ErrOptionWithSkipRetry(),
					)
				}
			}

		}
	}
	if jsonData != nil {
		// This is a different trust boundary from ingress: channel overrides
		// and pass-through bodies can change the quantity actually submitted.
		var outbound struct {
			N          *uint                       `json:"n"`
			Parameters *dto.ImageBillingParameters `json:"parameters"`
		}
		if err := common.Unmarshal(jsonData, &outbound); err != nil {
			return types.NewErrorWithStatusCode(fmt.Errorf("invalid image billing parameters: %w", err), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		quantityRequest := dto.ImageRequest{N: outbound.N, BillingParameters: outbound.Parameters}
		if quantityRequest.N == nil {
			quantityRequest.N = common.GetPointer(uint(imageCount))
		}
		imageCount, err = quantityRequest.ImageCount(info.ChannelType == constant.ChannelTypeAli)
		if err != nil {
			return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		promptExtend = outbound.Parameters != nil && outbound.Parameters.PromptExtend != nil && *outbound.Parameters.PromptExtend
		if info.ChannelType == constant.ChannelTypeAli {
			// Always send the same explicit quantity that is reserved, including
			// when an empty parameters object accompanies a top-level n.
			jsonData, err = sjson.SetBytes(jsonData, "parameters.n", imageCount)
			if err != nil {
				return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
			}
		}
		logger.LogDebug(c, "image request body: %s", jsonData)
		body, closer, err := relaycommon.NewOutboundJSONBody(jsonData)
		if err != nil {
			return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
		defer closer.Close()
		requestBody = body
	}
	if billingErr := service.PrepareImageBillingForRequest(c, info, imageCount, promptExtend); billingErr != nil {
		return billingErr
	}

	statusCodeMappingStr := c.GetString("status_code_mapping")

	resp, err := adaptor.DoRequest(c, info, requestBody)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}
	var httpResp *http.Response
	if resp != nil {
		httpResp = resp.(*http.Response)
		info.IsStream = info.IsStream || strings.HasPrefix(httpResp.Header.Get("Content-Type"), "text/event-stream")
		if httpResp.StatusCode != http.StatusOK {
			if httpResp.StatusCode == http.StatusCreated && info.ApiType == constant.APITypeReplicate {
				// replicate channel returns 201 Created when using Prefer: wait, treat it as success.
				httpResp.StatusCode = http.StatusOK
			} else {
				AIGatewayError = service.RelayErrorHandler(c.Request.Context(), httpResp, false)
				// reset status code 重置状态码
				service.ResetStatusCode(AIGatewayError, statusCodeMappingStr)
				return AIGatewayError
			}
		}
	}

	usage, AIGatewayError := adaptor.DoResponse(c, httpResp, info)
	if AIGatewayError != nil {
		// reset status code 重置状态码
		service.ResetStatusCode(AIGatewayError, statusCodeMappingStr)
		return AIGatewayError
	}

	imageN := uint(1)
	if request.N != nil {
		imageN = *request.N
	}

	if usage.(*dto.Usage).TotalTokens == 0 {
		usage.(*dto.Usage).TotalTokens = 1
	}
	if usage.(*dto.Usage).PromptTokens == 0 {
		usage.(*dto.Usage).PromptTokens = 1
	}

	quality := request.Quality
	if quality == "" {
		quality = "standard"
	}

	var logContent []string

	if len(request.Size) > 0 {
		logContent = append(logContent, fmt.Sprintf("大小 %s", request.Size))
	}
	if len(quality) > 0 {
		logContent = append(logContent, fmt.Sprintf("品质 %s", quality))
	}
	if imageN > 0 {
		logContent = append(logContent, fmt.Sprintf("生成数量 %d", imageN))
	}

	common.SetContextKey(c, constant.ContextKeyImageGenerationDetails, buildImageGenerationDetails(request, imageN, quality))

	// Persist the generation into the image studio history so images produced
	// via the raw API (not just the Image Studio UI) show up in the gallery.
	// No-op unless a recorder is registered and sources were captured.
	scheduleImageAutoRecord(c, info, request)

	service.PostTextConsumeQuota(c, info, usage.(*dto.Usage), logContent)
	return nil
}
