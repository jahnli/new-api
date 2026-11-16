# 移除概览页上手引导

**日期**: 2026-09-17

概览页不展示创建密钥、充值、发送请求的步骤清单、curl 示例、推荐操作及引导开关，移除折叠状态读写和仅服务于引导的数据请求。其余面板按各自显隐配置展示，FAQ 的当前差异见 [#035](035-faq-panel-redesign.md)。

入口：`web/src/features/dashboard/components/overview/overview-dashboard.tsx`。
