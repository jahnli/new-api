package system_setting

import (
	"sync"

	"github.com/QuantumNous/new-api/common"
)

// 飞书支持联系人从 .env 读取；应用凭据由公司配置提供。
// 使用惰性初始化，确保在 .env 加载完毕后才读取环境变量。
var feishuSupportOpenID = sync.OnceValue(func() string { return common.GetEnvOrDefaultString("FEISHU_SUPPORT_OPEN_ID", "") })

func FeishuSupportOpenID() string { return feishuSupportOpenID() }
