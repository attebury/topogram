# Verification Checklist

Generated from `/Users/attebury/Documents/topogram/examples/generated/content-approval/topogram`

## `ver_article_review_flow` - Article review flow

Verifies article creation, revision requests, resubmission, approval, and rejection.

Method: `runtime`
Status: `active`
Validates: `cap_create_article`, `cap_get_article`, `cap_list_articles`, `cap_update_article`, `cap_request_article_revision`, `cap_approve_article`, `cap_reject_article`

- [ ] create article in draft
- [ ] request revision for submitted article
- [ ] resubmit article after revision requested
- [ ] reject approval without precondition
- [ ] approve submitted article
- [ ] reject submitted article

## `ver_runtime_smoke` - Content approval runtime smoke

Covers the minimum web and API checks for the generated Content Approval stack.

Method: `smoke`
Status: `active`
Validates: `cap_create_article`, `cap_get_article`, `cap_list_articles`

- [ ] articles page responds
- [ ] create article smoke
- [ ] get created article smoke
- [ ] list articles smoke
