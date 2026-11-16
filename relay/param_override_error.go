package relay

import (
	"errors"
	"net/http"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
)

// AIGatewayErrorFromParamOverride classifies a param override failure by what
// triggered it. A condition that fails on the request's own value is a 400
// request error: it neither retries on other channels nor counts against the
// channel. Other failures come from the channel's override config, which
// fails for every request, and stay channel errors.
func AIGatewayErrorFromParamOverride(err error) *types.AIGatewayError {
	if fixedErr, ok := relaycommon.AsParamOverrideReturnError(err); ok {
		return relaycommon.AIGatewayErrorFromParamOverride(fixedErr)
	}
	var valueErr *relaycommon.ParamOverrideRequestValueError
	if errors.As(err, &valueErr) {
		return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	return types.NewError(err, types.ErrorCodeChannelParamOverrideInvalid, types.ErrOptionWithSkipRetry())
}
