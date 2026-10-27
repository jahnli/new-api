package aws

import "strings"

var awsModelIDMap = map[string]string{

}

var awsModelCanCrossRegionMap = map[string]map[string]bool{
	
}

var awsRegionCrossModelPrefixMap = map[string]string{
	"us": "us",
	"eu": "eu",
	"ap": "apac",
}

var ChannelName = "aws"

// 判断是否为Nova模型
func isNovaModel(modelId string) bool {
	return strings.Contains(modelId, "nova-")
}
