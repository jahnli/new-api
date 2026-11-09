# 飞书同步接口与 User 表飞书字段重构

**日期**: 2026-11-09

## 涉及文件

- `service/feishu_sync.go` — 同步头像时优先保存飞书返回的 `avatar_640`，该字段为空时回退到 `avatar_240`；数据库与当前用户对象使用同一地址，不读取 `avatar_origin`。已有头像地址需下一次飞书资料同步后更新。员工自定义资料只提取职级、职位描述、出生日期、探亲地、民族，直接写入五个独立列；移除旧 JSON 的扁平化存储逻辑与未使用的部门自定义字段请求。
- `model/user.go` — 新增 `job_level`、`job_description`、`birthday`、`hometown`、`ethnicity` 五个文本字段，移除 `CustomFieldValues` 模型映射及对应 API 字段；现有数据库的 `custom_field_values` 列保留。
- `controller/user.go` — 对外模式清空用户资料响应时改为清空五个独立字段。
- `controller/ldap.go`

## 数据来源与升级说明

飞书接口协议仍以 `base_info.custom_field_values` 返回上述资料，应用只在入站响应中解析该字段，不再读写数据库旧列。现有旧 JSON 数据需要一次性回填到新列，应用启动流程不保留旧列回填或读取兜底。钉钉同步维持现有基础资料范围，不新增这五项的同步。

## 既有功能

飞书同步使用 directory/v1/employees/mget 单接口，替代原用户详情、工号和部门三个接口；User 表将 employee_number 改为 job_number，新增 description、gender、leader_id、mobile、job_title、departments、department_name、background_image、join_date 等字段，移除旧部门拆分字段；background_image 使用纯字符串。早期自定义资料扁平 JSON 存储已由五个独立字段替代。
