package deepseek

import "github.com/QuantumNous/new-api/constant"

var ModelList = []string{
	"deepseek-v4.1-flash",
	"deepseek-v4-pro",
	constant.DeepSeekSearchModel, constant.DeepSeekFetchModel,
}

var ChannelName = "deepseek"

// Tool-price keys of the DeepSeek Search and Fetch APIs. They price the
// server-side searches and page fetches DeepSeek runs on its Anthropic and
// Responses endpoints.
const (
	SearchToolPriceKey = "deepseek_search"
	FetchToolPriceKey  = "deepseek_fetch"
)
