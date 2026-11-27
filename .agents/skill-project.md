# 项目技能配置

本文件只保存当前仓库差异，六个通用技能的 SKILL.md 可独立复制到其他项目。复制后按目标仓库更新本文件，不能沿用原项目远端或部署适配。用户本次明确要求优先；本文件不授权执行提交、推送或部署，也不存凭据。下列路径均相对目标仓库根目录。

```yaml
project_name: AI Gateway
git:
  push_after_commit: true
  target_branch: current
  push_targets:
  - remote: github
    expected_url: https://github.com/jahnli/new-api
  - remote: gitlab
    expected_url: https://gitlab.semi-tech.com/eed/ai-gateway
  read_only_remotes:
  - upstream
changelog:
  mode: local-customizations
  path: changes/CHANGELOG.md
  details_dir: changes/details
  language: zh-CN
  stage_after_update: true
announcement:
  title: AI Gateway 功能更新公告
  audience: 平台使用者
  featured_topics:
  - 模型新增
  - 模型下架
  - 模型价格变动
  - 模型推荐和使用建议
main_upstream_deploy:
  workflow: .agents/skills/main-upstream-deploy/references/project-workflow.md
```

## 提交与日志约定

保留本项目原有约定：“提交”默认含推送，明确要求仅本地或限定远端时遵循用户要求。上表 github/gitlab 接收同一次提交；操作前须核对实际 push URL。upstream 即使存在也仅作只读来源。日志是有效二开清单，不是已发布版本历史；显式更新日志后沿用原有暂存约定，但不得混入用户无关或部分暂存内容。

## 公告业务约定

模型新增、下架、实际调价及有明确依据的推荐放 Featured，且不在其他分类重复。仅从内置候选列表删名不等于下架；定价编辑器、展示或同步工具改进属于 Feat，不等于实际调价。价格、币种、单位、前后数值、生效时间和替代建议均须有证据，不编造。

## main 发布适配

沿用本项目既有的 main 专用 SSH 流程，与当前二开分支独立。固定 Git 目标、主机、目录和三个允许命令仅在[本项目适配](skills/main-upstream-deploy/references/project-workflow.md)维护；不触发镜像构建，不追加运行版本或健康检查。命令完成只能报告执行结果。
