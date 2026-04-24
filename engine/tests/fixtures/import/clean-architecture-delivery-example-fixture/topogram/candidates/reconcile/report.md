# Reconcile Report

## Promoted

- None

## Skipped

- None

## Adoption

- Plan: `candidates/reconcile/adoption-plan.json`
- Selector: `none`
- Approved items: 0
- Applied items: 35
- Skipped items: 0
- Blocked items: 0
- Canonical files: 0
- Refreshed canonical files: 0
- Approved review groups: 6
- Projection-dependent items: 0
- Projection review groups: 0
- UI review groups: 0
- Workflow review groups: 6

## Approved Review Groups

- `workflow_review:order`
- `workflow_review:product`
- `workflow_review:store`
- `workflow_review:cousine`
- `workflow_review:customer`
- `workflow_review:account`

## Projection Review Groups

- None

## UI Review Groups

- None

## Workflow Review Groups

- `workflow_review:account` <- `dec_account`, `workflow_account`
- `workflow_review:cousine` <- `dec_cousine`, `workflow_cousine`
- `workflow_review:customer` <- `dec_customer`, `workflow_customer`
- `workflow_review:order` <- `dec_order`, `workflow_order`
- `workflow_review:product` <- `dec_product`, `workflow_product`
- `workflow_review:store` <- `dec_store`, `workflow_store`

## Bundle Blockers

- `account`: blocked=0, approved=0, applied=4, pending=0, dependencies=_none_
- `cousine`: blocked=0, approved=0, applied=5, pending=0, dependencies=_none_
- `customer`: blocked=0, approved=0, applied=5, pending=0, dependencies=_none_
- `order`: blocked=0, approved=0, applied=9, pending=0, dependencies=_none_
- `product`: blocked=0, approved=0, applied=6, pending=0, dependencies=_none_
- `store`: blocked=0, approved=0, applied=6, pending=0, dependencies=_none_

## Bundle Priorities

- `order`: next=_none_, bundle-review=_none_, from-plan=no
- `product`: next=_none_, bundle-review=_none_, from-plan=no
- `store`: next=_none_, bundle-review=_none_, from-plan=no
- `cousine`: next=_none_, bundle-review=_none_, from-plan=no
- `customer`: next=_none_, bundle-review=_none_, from-plan=no
- `account`: next=_none_, bundle-review=_none_, from-plan=no

## Suppressed Noise Bundles

- `orderitem`: JPA implementation-noise child entity.

## Projection Dependencies

- None

## Blocked Adoption Items

- None

## Candidate Model Bundles

- `account` (0 actors, 0 roles, 0 entities, 0 enums, 1 capabilities, 1 shapes, 0 screens, 1 workflows, 0 docs)
- `cousine` (0 actors, 0 roles, 1 entities, 0 enums, 2 capabilities, 0 shapes, 0 screens, 1 workflows, 0 docs)
- `customer` (0 actors, 0 roles, 1 entities, 0 enums, 2 capabilities, 0 shapes, 0 screens, 1 workflows, 0 docs)
- `order` (0 actors, 0 roles, 1 entities, 1 enums, 5 capabilities, 0 shapes, 0 screens, 1 workflows, 0 docs)
- `product` (0 actors, 0 roles, 1 entities, 0 enums, 3 capabilities, 0 shapes, 0 screens, 1 workflows, 0 docs)
- `store` (0 actors, 0 roles, 1 entities, 0 enums, 3 capabilities, 0 shapes, 0 screens, 1 workflows, 0 docs)

## Candidate Model Files

- `candidates/reconcile/model/bundles/account/README.md`
- `candidates/reconcile/model/bundles/account/capabilities/cap_sign_in_account.tg`
- `candidates/reconcile/model/bundles/account/decisions/dec_account.tg`
- `candidates/reconcile/model/bundles/account/docs/workflows/workflow_account.md`
- `candidates/reconcile/model/bundles/account/shapes/shape_output_sign_in_account.tg`
- `candidates/reconcile/model/bundles/cousine/README.md`
- `candidates/reconcile/model/bundles/cousine/capabilities/cap_list_cousines.tg`
- `candidates/reconcile/model/bundles/cousine/capabilities/cap_search_cousines.tg`
- `candidates/reconcile/model/bundles/cousine/decisions/dec_cousine.tg`
- `candidates/reconcile/model/bundles/cousine/docs/workflows/workflow_cousine.md`
- `candidates/reconcile/model/bundles/cousine/entities/entity_cousine.tg`
- `candidates/reconcile/model/bundles/customer/README.md`
- `candidates/reconcile/model/bundles/customer/capabilities/cap_create_customer.tg`
- `candidates/reconcile/model/bundles/customer/capabilities/cap_get_customer.tg`
- `candidates/reconcile/model/bundles/customer/decisions/dec_customer.tg`
- `candidates/reconcile/model/bundles/customer/docs/workflows/workflow_customer.md`
- `candidates/reconcile/model/bundles/customer/entities/entity_customer.tg`
- `candidates/reconcile/model/bundles/order/README.md`
- `candidates/reconcile/model/bundles/order/capabilities/cap_create_order.tg`
- `candidates/reconcile/model/bundles/order/capabilities/cap_delete_order.tg`
- `candidates/reconcile/model/bundles/order/capabilities/cap_delivery_order.tg`
- `candidates/reconcile/model/bundles/order/capabilities/cap_get_order.tg`
- `candidates/reconcile/model/bundles/order/capabilities/cap_pay_order.tg`
- `candidates/reconcile/model/bundles/order/decisions/dec_order.tg`
- `candidates/reconcile/model/bundles/order/docs/workflows/workflow_order.md`
- `candidates/reconcile/model/bundles/order/entities/entity_order.tg`
- `candidates/reconcile/model/bundles/order/enums/status.tg`
- `candidates/reconcile/model/bundles/product/README.md`
- `candidates/reconcile/model/bundles/product/capabilities/cap_get_product.tg`
- `candidates/reconcile/model/bundles/product/capabilities/cap_list_products.tg`
- `candidates/reconcile/model/bundles/product/capabilities/cap_search_products.tg`
- `candidates/reconcile/model/bundles/product/decisions/dec_product.tg`
- `candidates/reconcile/model/bundles/product/docs/workflows/workflow_product.md`
- `candidates/reconcile/model/bundles/product/entities/entity_product.tg`
- `candidates/reconcile/model/bundles/store/README.md`
- `candidates/reconcile/model/bundles/store/capabilities/cap_get_store.tg`
- `candidates/reconcile/model/bundles/store/capabilities/cap_list_stores.tg`
- `candidates/reconcile/model/bundles/store/capabilities/cap_search_stores.tg`
- `candidates/reconcile/model/bundles/store/decisions/dec_store.tg`
- `candidates/reconcile/model/bundles/store/docs/workflows/workflow_store.md`
- `candidates/reconcile/model/bundles/store/entities/entity_store.tg`

## Canonical Outputs

- None
