# 游乐场决策模型支持

**日期**: 2026-11-28

## 模型识别与请求

- Jev、Laya 等模型在对应任务插件已加载、声明 SystemOne 提交路由且模型出现在用户可用分组的模型列表中时，进入决策界面；依据协议能力识别，不按模型名称前缀判断。匹配插件声明的模型、大小写变体及可解析的渠道模型别名，未识别为决策模型时使用普通聊天界面。
- 游乐场查询模型时附带 `playground=true`，后端返回 `systemone_models`。展示判断界面与实际提交共用模型和路由匹配规则。
- 新增浏览器会话入口 `POST /pg/systemone`，校验用户可用分组，拒绝个人访问令牌；复用模型请求限流、任务插件路由、渠道分发和任务中继。没有匹配协议路由时返回模型不存在。

## 表单与结果

- 默认提供待分析文本、问题类型与问题输入，支持是非判断（`noul`）、单选（`choice`）和评分（`score`）。单选在表单中要求 1–255 个不同选项，评分要求 1–10 个由低到高的等级，均按行填写。默认示例围绕工作项目进度与延期风险。
- JSON 模式允许直接编辑请求体，提交前要求合法 JSON 对象且请求中的模型与当前选择一致；普通表单要求文本和问题非空。请求不自动重试，支持手动停止；切换模型或分组时重建决策表单并取消未完成请求。
- 输入表单、模型与分组选择及运行按钮保留在底部，较长表单独立滚动；问题类型复用共享可搜索下拉。普通聊天的按钮继续显示“发送”，决策表单显示“运行”。
- 桌面左侧展示判断结果、概率和置信度，右侧展示默认展开的原始 JSON；窄屏上下排列。结果使用主题色图标、数值与进度条，按当前界面语言格式化百分比和 Token 数量，未知答案类型回退为 JSON。
- 原始响应通过共享代码块的可选 `fillHeight` 填满桌面可用区域，窄屏使用固定高度，长内容在框内滚动并保留内边距。展开与收起提供箭头旋转和高度过渡，内容区预留滚动条空间并关闭滚动锚定。
- 等待状态显示模型名和“正在分析”，文字带流光，神经网络图标每 1.5 秒旋转一圈，节点交错闪亮；减少动态效果设置下停止这些动画。相关表单、结果及示例文案覆盖七种界面语言。

## 代码边界与入口

- `web/src/features/playground/index.tsx`：共享模型、分组及配置持久化，按模型能力选择独立界面。
- `web/src/features/playground/components/chat-playground.tsx`、`hooks/use-playground-state.ts`：普通聊天的消息、参数和会话操作，仅在聊天界面挂载。
- `web/src/features/playground/components/system-one-playground.tsx`、`components/system-one-result.tsx`：决策表单、请求、取消及结果展示，与聊天逻辑拆分。
- `web/src/features/playground/api.ts`、`types.ts`、`components/input/playground-input-controls.tsx`：协议能力标记及共享底部操作；`web/src/components/ai-elements/code-block.tsx`：兼容扩展代码框高度。
- `controller/user.go`、`pkg/jsplugin/routing.go`、`model/task_model_alias.go`：决策协议路由发现及模型、别名识别。
- `router/relay-router.go`、`middleware/task_plugin.go`、`middleware/distributor.go`、`middleware/access_token_routes.go`：会话入口、分组校验与插件中继衔接。
