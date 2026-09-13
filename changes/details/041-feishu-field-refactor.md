# 飞书同步接口与 User 表飞书字段重构

**日期**: 2026-06-25

## 涉及文件

- `service/feishu_sync.go`
- `model/user.go`
- `controller/ldap.go`

## 自 CHANGELOG 说明列迁入

飞书同步改用 directory/v1/employees/mget 单接口（替代原用户详情/工号/部门 3 个接口）；User 表飞书字段重构：employee_number→job_number，新增 description、gender、leader_id、mobile、job_title、departments、department_name、background_image、custom_field_values、join_date，移除旧部门拆分字段；custom_field_values 扁平化为 {field_key: text_value} 格式存储；修复 background_image 结构体类型错误（应为纯字符串）
