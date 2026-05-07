export const serverContract = {
  "type": "server_contract_graph",
  "projection": {
    "id": "proj_api",
    "name": "API",
    "type": "api_contract"
  },
  "routes": [
    {
      "capabilityId": "cap_create_item",
      "handlerName": "handleCreateItem",
      "repositoryMethod": "createItem",
      "method": "POST",
      "path": "/items",
      "successStatus": 201,
      "requestContract": {
        "type": "api_request_contract",
        "shape": {
          "id": "shape_input_create_item",
          "name": "Create Item Input"
        },
        "fields": [
          {
            "name": "title",
            "sourceName": "title",
            "required": true,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "title"
            }
          },
          {
            "name": "description",
            "sourceName": "description",
            "required": false,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "description"
            }
          },
          {
            "name": "priority",
            "sourceName": "priority",
            "required": true,
            "schema": {
              "type": "string",
              "enum": [
                "low",
                "medium",
                "high"
              ],
              "default": "medium"
            },
            "transport": {
              "location": "body",
              "wireName": "priority"
            }
          },
          {
            "name": "owner_id",
            "sourceName": "owner_id",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "owner_id"
            }
          },
          {
            "name": "collection_id",
            "sourceName": "collection_id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "collection_id"
            }
          },
          {
            "name": "due_at",
            "sourceName": "due_at",
            "required": false,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "due_at"
            }
          }
        ],
        "required": [
          "title",
          "priority",
          "collection_id"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_input_create_item",
          "title": "Create Item Input",
          "description": "Fields accepted when creating a item",
          "type": "object",
          "properties": {
            "title": {
              "type": "string"
            },
            "description": {
              "type": "string"
            },
            "priority": {
              "type": "string",
              "enum": [
                "low",
                "medium",
                "high"
              ],
              "default": "medium"
            },
            "owner_id": {
              "type": "string",
              "format": "uuid"
            },
            "collection_id": {
              "type": "string",
              "format": "uuid"
            },
            "due_at": {
              "type": "string",
              "format": "date-time"
            }
          },
          "additionalProperties": false,
          "required": [
            "title",
            "priority",
            "collection_id"
          ]
        },
        "transport": {
          "path": [],
          "query": [],
          "header": [],
          "body": [
            {
              "name": "title",
              "sourceName": "title",
              "required": true,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "title"
              }
            },
            {
              "name": "description",
              "sourceName": "description",
              "required": false,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "description"
              }
            },
            {
              "name": "priority",
              "sourceName": "priority",
              "required": true,
              "schema": {
                "type": "string",
                "enum": [
                  "low",
                  "medium",
                  "high"
                ],
                "default": "medium"
              },
              "transport": {
                "location": "body",
                "wireName": "priority"
              }
            },
            {
              "name": "owner_id",
              "sourceName": "owner_id",
              "required": false,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "owner_id"
              }
            },
            {
              "name": "collection_id",
              "sourceName": "collection_id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "collection_id"
              }
            },
            {
              "name": "due_at",
              "sourceName": "due_at",
              "required": false,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "due_at"
              }
            }
          ]
        }
      },
      "responseContract": {
        "type": "api_response_contract",
        "shape": {
          "id": "shape_output_item_detail",
          "name": "Item Detail Output"
        },
        "fields": [
          {
            "name": "id",
            "sourceName": "id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "id"
            }
          },
          {
            "name": "title",
            "sourceName": "title",
            "required": true,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "title"
            }
          },
          {
            "name": "description",
            "sourceName": "description",
            "required": false,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "description"
            }
          },
          {
            "name": "status",
            "sourceName": "status",
            "required": true,
            "schema": {
              "type": "string",
              "enum": [
                "draft",
                "active",
                "completed",
                "archived"
              ],
              "default": "draft"
            },
            "transport": {
              "location": "body",
              "wireName": "status"
            }
          },
          {
            "name": "priority",
            "sourceName": "priority",
            "required": true,
            "schema": {
              "type": "string",
              "enum": [
                "low",
                "medium",
                "high"
              ],
              "default": "medium"
            },
            "transport": {
              "location": "body",
              "wireName": "priority"
            }
          },
          {
            "name": "owner_id",
            "sourceName": "owner_id",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "owner_id"
            }
          },
          {
            "name": "collection_id",
            "sourceName": "collection_id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "collection_id"
            }
          },
          {
            "name": "created_at",
            "sourceName": "created_at",
            "required": true,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "created_at"
            }
          },
          {
            "name": "updated_at",
            "sourceName": "updated_at",
            "required": true,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "updated_at"
            }
          },
          {
            "name": "completed_at",
            "sourceName": "completed_at",
            "required": false,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "completed_at"
            }
          },
          {
            "name": "due_at",
            "sourceName": "due_at",
            "required": false,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "due_at"
            }
          }
        ],
        "required": [
          "id",
          "title",
          "status",
          "priority",
          "collection_id",
          "created_at",
          "updated_at"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_output_item_detail",
          "title": "Item Detail Output",
          "description": "Detailed item payload",
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid"
            },
            "title": {
              "type": "string"
            },
            "description": {
              "type": "string"
            },
            "status": {
              "type": "string",
              "enum": [
                "draft",
                "active",
                "completed",
                "archived"
              ],
              "default": "draft"
            },
            "priority": {
              "type": "string",
              "enum": [
                "low",
                "medium",
                "high"
              ],
              "default": "medium"
            },
            "owner_id": {
              "type": "string",
              "format": "uuid"
            },
            "collection_id": {
              "type": "string",
              "format": "uuid"
            },
            "created_at": {
              "type": "string",
              "format": "date-time"
            },
            "updated_at": {
              "type": "string",
              "format": "date-time"
            },
            "completed_at": {
              "type": "string",
              "format": "date-time"
            },
            "due_at": {
              "type": "string",
              "format": "date-time"
            }
          },
          "additionalProperties": false,
          "required": [
            "id",
            "title",
            "status",
            "priority",
            "collection_id",
            "created_at",
            "updated_at"
          ]
        },
        "mode": "item",
        "collection": false,
        "itemJsonSchema": null,
        "pagination": null,
        "transport": {
          "path": [],
          "query": [],
          "header": [],
          "body": [
            {
              "name": "id",
              "sourceName": "id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "id"
              }
            },
            {
              "name": "title",
              "sourceName": "title",
              "required": true,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "title"
              }
            },
            {
              "name": "description",
              "sourceName": "description",
              "required": false,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "description"
              }
            },
            {
              "name": "status",
              "sourceName": "status",
              "required": true,
              "schema": {
                "type": "string",
                "enum": [
                  "draft",
                  "active",
                  "completed",
                  "archived"
                ],
                "default": "draft"
              },
              "transport": {
                "location": "body",
                "wireName": "status"
              }
            },
            {
              "name": "priority",
              "sourceName": "priority",
              "required": true,
              "schema": {
                "type": "string",
                "enum": [
                  "low",
                  "medium",
                  "high"
                ],
                "default": "medium"
              },
              "transport": {
                "location": "body",
                "wireName": "priority"
              }
            },
            {
              "name": "owner_id",
              "sourceName": "owner_id",
              "required": false,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "owner_id"
              }
            },
            {
              "name": "collection_id",
              "sourceName": "collection_id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "collection_id"
              }
            },
            {
              "name": "created_at",
              "sourceName": "created_at",
              "required": true,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "created_at"
              }
            },
            {
              "name": "updated_at",
              "sourceName": "updated_at",
              "required": true,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "updated_at"
              }
            },
            {
              "name": "completed_at",
              "sourceName": "completed_at",
              "required": false,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "completed_at"
              }
            },
            {
              "name": "due_at",
              "sourceName": "due_at",
              "required": false,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "due_at"
              }
            }
          ]
        }
      },
      "errors": [
        {
          "type": "api_error_case",
          "code": "rule_no_item_creation_in_archived_collection",
          "status": 409,
          "source": "policy"
        },
        {
          "type": "api_error_case",
          "code": "rule_only_active_members_may_own_items",
          "status": 400,
          "source": "policy"
        },
        {
          "type": "api_error_case",
          "code": "cap_create_item_invalid_request",
          "status": 400,
          "source": "request_contract"
        },
        {
          "type": "api_error_case",
          "code": "cap_create_item_idempotency_conflict",
          "status": 409,
          "source": "idempotency"
        }
      ],
      "endpoint": {
        "auth": "user",
        "authz": [
          {
            "role": null,
            "permission": "items.create",
            "claim": null,
            "claimValue": null,
            "ownership": null,
            "ownershipField": null
          }
        ],
        "preconditions": [],
        "idempotency": [
          {
            "header": "Idempotency-Key",
            "required": true,
            "error": 409,
            "code": "cap_create_item_idempotency_conflict"
          }
        ],
        "cache": [],
        "asyncJobs": [],
        "asyncStatus": [],
        "download": []
      }
    },
    {
      "capabilityId": "cap_get_item",
      "handlerName": "handleGetItem",
      "repositoryMethod": "getItem",
      "method": "GET",
      "path": "/items/:id",
      "successStatus": 200,
      "requestContract": {
        "type": "api_request_contract",
        "shape": {
          "id": "shape_input_get_item",
          "name": "Get Item Input"
        },
        "fields": [
          {
            "name": "item_id",
            "sourceName": "item_id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "path",
              "wireName": "id"
            }
          }
        ],
        "required": [
          "item_id"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_input_get_item",
          "title": "Get Item Input",
          "description": "Input for fetching a single item",
          "type": "object",
          "properties": {
            "item_id": {
              "type": "string",
              "format": "uuid"
            }
          },
          "additionalProperties": false,
          "required": [
            "item_id"
          ]
        },
        "transport": {
          "path": [
            {
              "name": "item_id",
              "sourceName": "item_id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "path",
                "wireName": "id"
              }
            }
          ],
          "query": [],
          "header": [],
          "body": []
        }
      },
      "responseContract": {
        "type": "api_response_contract",
        "shape": {
          "id": "shape_output_item_detail",
          "name": "Item Detail Output"
        },
        "fields": [
          {
            "name": "id",
            "sourceName": "id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "id"
            }
          },
          {
            "name": "title",
            "sourceName": "title",
            "required": true,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "title"
            }
          },
          {
            "name": "description",
            "sourceName": "description",
            "required": false,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "description"
            }
          },
          {
            "name": "status",
            "sourceName": "status",
            "required": true,
            "schema": {
              "type": "string",
              "enum": [
                "draft",
                "active",
                "completed",
                "archived"
              ],
              "default": "draft"
            },
            "transport": {
              "location": "body",
              "wireName": "status"
            }
          },
          {
            "name": "priority",
            "sourceName": "priority",
            "required": true,
            "schema": {
              "type": "string",
              "enum": [
                "low",
                "medium",
                "high"
              ],
              "default": "medium"
            },
            "transport": {
              "location": "body",
              "wireName": "priority"
            }
          },
          {
            "name": "owner_id",
            "sourceName": "owner_id",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "owner_id"
            }
          },
          {
            "name": "collection_id",
            "sourceName": "collection_id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "collection_id"
            }
          },
          {
            "name": "created_at",
            "sourceName": "created_at",
            "required": true,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "created_at"
            }
          },
          {
            "name": "updated_at",
            "sourceName": "updated_at",
            "required": true,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "updated_at"
            }
          },
          {
            "name": "completed_at",
            "sourceName": "completed_at",
            "required": false,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "completed_at"
            }
          },
          {
            "name": "due_at",
            "sourceName": "due_at",
            "required": false,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "due_at"
            }
          }
        ],
        "required": [
          "id",
          "title",
          "status",
          "priority",
          "collection_id",
          "created_at",
          "updated_at"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_output_item_detail",
          "title": "Item Detail Output",
          "description": "Detailed item payload",
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid"
            },
            "title": {
              "type": "string"
            },
            "description": {
              "type": "string"
            },
            "status": {
              "type": "string",
              "enum": [
                "draft",
                "active",
                "completed",
                "archived"
              ],
              "default": "draft"
            },
            "priority": {
              "type": "string",
              "enum": [
                "low",
                "medium",
                "high"
              ],
              "default": "medium"
            },
            "owner_id": {
              "type": "string",
              "format": "uuid"
            },
            "collection_id": {
              "type": "string",
              "format": "uuid"
            },
            "created_at": {
              "type": "string",
              "format": "date-time"
            },
            "updated_at": {
              "type": "string",
              "format": "date-time"
            },
            "completed_at": {
              "type": "string",
              "format": "date-time"
            },
            "due_at": {
              "type": "string",
              "format": "date-time"
            }
          },
          "additionalProperties": false,
          "required": [
            "id",
            "title",
            "status",
            "priority",
            "collection_id",
            "created_at",
            "updated_at"
          ]
        },
        "mode": "item",
        "collection": false,
        "itemJsonSchema": null,
        "pagination": null,
        "transport": {
          "path": [],
          "query": [],
          "header": [],
          "body": [
            {
              "name": "id",
              "sourceName": "id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "id"
              }
            },
            {
              "name": "title",
              "sourceName": "title",
              "required": true,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "title"
              }
            },
            {
              "name": "description",
              "sourceName": "description",
              "required": false,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "description"
              }
            },
            {
              "name": "status",
              "sourceName": "status",
              "required": true,
              "schema": {
                "type": "string",
                "enum": [
                  "draft",
                  "active",
                  "completed",
                  "archived"
                ],
                "default": "draft"
              },
              "transport": {
                "location": "body",
                "wireName": "status"
              }
            },
            {
              "name": "priority",
              "sourceName": "priority",
              "required": true,
              "schema": {
                "type": "string",
                "enum": [
                  "low",
                  "medium",
                  "high"
                ],
                "default": "medium"
              },
              "transport": {
                "location": "body",
                "wireName": "priority"
              }
            },
            {
              "name": "owner_id",
              "sourceName": "owner_id",
              "required": false,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "owner_id"
              }
            },
            {
              "name": "collection_id",
              "sourceName": "collection_id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "collection_id"
              }
            },
            {
              "name": "created_at",
              "sourceName": "created_at",
              "required": true,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "created_at"
              }
            },
            {
              "name": "updated_at",
              "sourceName": "updated_at",
              "required": true,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "updated_at"
              }
            },
            {
              "name": "completed_at",
              "sourceName": "completed_at",
              "required": false,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "completed_at"
              }
            },
            {
              "name": "due_at",
              "sourceName": "due_at",
              "required": false,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "due_at"
              }
            }
          ]
        }
      },
      "errors": [
        {
          "type": "api_error_case",
          "code": "cap_get_item_invalid_request",
          "status": 400,
          "source": "request_contract"
        },
        {
          "type": "api_error_case",
          "code": "cap_get_item_not_found",
          "status": 404,
          "source": "projection_mapping"
        }
      ],
      "endpoint": {
        "auth": "user",
        "authz": [
          {
            "role": null,
            "permission": null,
            "claim": null,
            "claimValue": null,
            "ownership": "owner_or_admin",
            "ownershipField": "owner_id"
          }
        ],
        "preconditions": [],
        "idempotency": [],
        "cache": [
          {
            "responseHeader": "ETag",
            "requestHeader": "If-None-Match",
            "required": false,
            "notModified": 304,
            "source": "updated_at",
            "code": "cap_get_item_not_modified"
          }
        ],
        "asyncJobs": [],
        "asyncStatus": [],
        "download": []
      }
    },
    {
      "capabilityId": "cap_update_item",
      "handlerName": "handleUpdateItem",
      "repositoryMethod": "updateItem",
      "method": "PATCH",
      "path": "/items/:id",
      "successStatus": 200,
      "requestContract": {
        "type": "api_request_contract",
        "shape": {
          "id": "shape_input_update_item",
          "name": "Update Item Input"
        },
        "fields": [
          {
            "name": "item_id",
            "sourceName": "item_id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "path",
              "wireName": "id"
            }
          },
          {
            "name": "title",
            "sourceName": "title",
            "required": false,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "title"
            }
          },
          {
            "name": "description",
            "sourceName": "description",
            "required": false,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "description"
            }
          },
          {
            "name": "priority",
            "sourceName": "priority",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "low",
                "medium",
                "high"
              ]
            },
            "transport": {
              "location": "body",
              "wireName": "priority"
            }
          },
          {
            "name": "owner_id",
            "sourceName": "owner_id",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "owner_id"
            }
          },
          {
            "name": "due_at",
            "sourceName": "due_at",
            "required": false,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "due_at"
            }
          },
          {
            "name": "status",
            "sourceName": "status",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "draft",
                "active",
                "completed",
                "archived"
              ]
            },
            "transport": {
              "location": "body",
              "wireName": "status"
            }
          }
        ],
        "required": [
          "item_id"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_input_update_item",
          "title": "Update Item Input",
          "description": "Input for updating a item",
          "type": "object",
          "properties": {
            "item_id": {
              "type": "string",
              "format": "uuid"
            },
            "title": {
              "type": "string"
            },
            "description": {
              "type": "string"
            },
            "priority": {
              "type": "string",
              "enum": [
                "low",
                "medium",
                "high"
              ]
            },
            "owner_id": {
              "type": "string",
              "format": "uuid"
            },
            "due_at": {
              "type": "string",
              "format": "date-time"
            },
            "status": {
              "type": "string",
              "enum": [
                "draft",
                "active",
                "completed",
                "archived"
              ]
            }
          },
          "additionalProperties": false,
          "required": [
            "item_id"
          ]
        },
        "transport": {
          "path": [
            {
              "name": "item_id",
              "sourceName": "item_id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "path",
                "wireName": "id"
              }
            }
          ],
          "query": [],
          "header": [],
          "body": [
            {
              "name": "title",
              "sourceName": "title",
              "required": false,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "title"
              }
            },
            {
              "name": "description",
              "sourceName": "description",
              "required": false,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "description"
              }
            },
            {
              "name": "priority",
              "sourceName": "priority",
              "required": false,
              "schema": {
                "type": "string",
                "enum": [
                  "low",
                  "medium",
                  "high"
                ]
              },
              "transport": {
                "location": "body",
                "wireName": "priority"
              }
            },
            {
              "name": "owner_id",
              "sourceName": "owner_id",
              "required": false,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "owner_id"
              }
            },
            {
              "name": "due_at",
              "sourceName": "due_at",
              "required": false,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "due_at"
              }
            },
            {
              "name": "status",
              "sourceName": "status",
              "required": false,
              "schema": {
                "type": "string",
                "enum": [
                  "draft",
                  "active",
                  "completed",
                  "archived"
                ]
              },
              "transport": {
                "location": "body",
                "wireName": "status"
              }
            }
          ]
        }
      },
      "responseContract": {
        "type": "api_response_contract",
        "shape": {
          "id": "shape_output_item_detail",
          "name": "Item Detail Output"
        },
        "fields": [
          {
            "name": "id",
            "sourceName": "id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "id"
            }
          },
          {
            "name": "title",
            "sourceName": "title",
            "required": true,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "title"
            }
          },
          {
            "name": "description",
            "sourceName": "description",
            "required": false,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "description"
            }
          },
          {
            "name": "status",
            "sourceName": "status",
            "required": true,
            "schema": {
              "type": "string",
              "enum": [
                "draft",
                "active",
                "completed",
                "archived"
              ],
              "default": "draft"
            },
            "transport": {
              "location": "body",
              "wireName": "status"
            }
          },
          {
            "name": "priority",
            "sourceName": "priority",
            "required": true,
            "schema": {
              "type": "string",
              "enum": [
                "low",
                "medium",
                "high"
              ],
              "default": "medium"
            },
            "transport": {
              "location": "body",
              "wireName": "priority"
            }
          },
          {
            "name": "owner_id",
            "sourceName": "owner_id",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "owner_id"
            }
          },
          {
            "name": "collection_id",
            "sourceName": "collection_id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "collection_id"
            }
          },
          {
            "name": "created_at",
            "sourceName": "created_at",
            "required": true,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "created_at"
            }
          },
          {
            "name": "updated_at",
            "sourceName": "updated_at",
            "required": true,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "updated_at"
            }
          },
          {
            "name": "completed_at",
            "sourceName": "completed_at",
            "required": false,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "completed_at"
            }
          },
          {
            "name": "due_at",
            "sourceName": "due_at",
            "required": false,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "due_at"
            }
          }
        ],
        "required": [
          "id",
          "title",
          "status",
          "priority",
          "collection_id",
          "created_at",
          "updated_at"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_output_item_detail",
          "title": "Item Detail Output",
          "description": "Detailed item payload",
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid"
            },
            "title": {
              "type": "string"
            },
            "description": {
              "type": "string"
            },
            "status": {
              "type": "string",
              "enum": [
                "draft",
                "active",
                "completed",
                "archived"
              ],
              "default": "draft"
            },
            "priority": {
              "type": "string",
              "enum": [
                "low",
                "medium",
                "high"
              ],
              "default": "medium"
            },
            "owner_id": {
              "type": "string",
              "format": "uuid"
            },
            "collection_id": {
              "type": "string",
              "format": "uuid"
            },
            "created_at": {
              "type": "string",
              "format": "date-time"
            },
            "updated_at": {
              "type": "string",
              "format": "date-time"
            },
            "completed_at": {
              "type": "string",
              "format": "date-time"
            },
            "due_at": {
              "type": "string",
              "format": "date-time"
            }
          },
          "additionalProperties": false,
          "required": [
            "id",
            "title",
            "status",
            "priority",
            "collection_id",
            "created_at",
            "updated_at"
          ]
        },
        "mode": "item",
        "collection": false,
        "itemJsonSchema": null,
        "pagination": null,
        "transport": {
          "path": [],
          "query": [],
          "header": [],
          "body": [
            {
              "name": "id",
              "sourceName": "id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "id"
              }
            },
            {
              "name": "title",
              "sourceName": "title",
              "required": true,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "title"
              }
            },
            {
              "name": "description",
              "sourceName": "description",
              "required": false,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "description"
              }
            },
            {
              "name": "status",
              "sourceName": "status",
              "required": true,
              "schema": {
                "type": "string",
                "enum": [
                  "draft",
                  "active",
                  "completed",
                  "archived"
                ],
                "default": "draft"
              },
              "transport": {
                "location": "body",
                "wireName": "status"
              }
            },
            {
              "name": "priority",
              "sourceName": "priority",
              "required": true,
              "schema": {
                "type": "string",
                "enum": [
                  "low",
                  "medium",
                  "high"
                ],
                "default": "medium"
              },
              "transport": {
                "location": "body",
                "wireName": "priority"
              }
            },
            {
              "name": "owner_id",
              "sourceName": "owner_id",
              "required": false,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "owner_id"
              }
            },
            {
              "name": "collection_id",
              "sourceName": "collection_id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "collection_id"
              }
            },
            {
              "name": "created_at",
              "sourceName": "created_at",
              "required": true,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "created_at"
              }
            },
            {
              "name": "updated_at",
              "sourceName": "updated_at",
              "required": true,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "updated_at"
              }
            },
            {
              "name": "completed_at",
              "sourceName": "completed_at",
              "required": false,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "completed_at"
              }
            },
            {
              "name": "due_at",
              "sourceName": "due_at",
              "required": false,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "due_at"
              }
            }
          ]
        }
      },
      "errors": [
        {
          "type": "api_error_case",
          "code": "rule_only_active_members_may_own_items",
          "status": 400,
          "source": "policy"
        },
        {
          "type": "api_error_case",
          "code": "cap_update_item_invalid_request",
          "status": 400,
          "source": "request_contract"
        },
        {
          "type": "api_error_case",
          "code": "cap_update_item_precondition_failed",
          "status": 412,
          "source": "precondition"
        }
      ],
      "endpoint": {
        "auth": "user",
        "authz": [
          {
            "role": null,
            "permission": "items.update",
            "claim": null,
            "claimValue": null,
            "ownership": "owner_or_admin",
            "ownershipField": "owner_id"
          }
        ],
        "preconditions": [
          {
            "header": "If-Match",
            "required": true,
            "error": 412,
            "source": "updated_at",
            "code": "cap_update_item_precondition_failed"
          }
        ],
        "idempotency": [],
        "cache": [],
        "asyncJobs": [],
        "asyncStatus": [],
        "download": []
      }
    },
    {
      "capabilityId": "cap_complete_item",
      "handlerName": "handleCompleteItem",
      "repositoryMethod": "completeItem",
      "method": "POST",
      "path": "/items/:id/complete",
      "successStatus": 200,
      "requestContract": {
        "type": "api_request_contract",
        "shape": {
          "id": "shape_input_complete_item",
          "name": "Complete Item Input"
        },
        "fields": [
          {
            "name": "item_id",
            "sourceName": "item_id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "path",
              "wireName": "id"
            }
          },
          {
            "name": "completed_at",
            "sourceName": "completed_at",
            "required": false,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "completed_at"
            }
          }
        ],
        "required": [
          "item_id"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_input_complete_item",
          "title": "Complete Item Input",
          "description": "Input for marking a item complete",
          "type": "object",
          "properties": {
            "item_id": {
              "type": "string",
              "format": "uuid"
            },
            "completed_at": {
              "type": "string",
              "format": "date-time"
            }
          },
          "additionalProperties": false,
          "required": [
            "item_id"
          ]
        },
        "transport": {
          "path": [
            {
              "name": "item_id",
              "sourceName": "item_id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "path",
                "wireName": "id"
              }
            }
          ],
          "query": [],
          "header": [],
          "body": [
            {
              "name": "completed_at",
              "sourceName": "completed_at",
              "required": false,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "completed_at"
              }
            }
          ]
        }
      },
      "responseContract": {
        "type": "api_response_contract",
        "shape": {
          "id": "shape_output_item_detail",
          "name": "Item Detail Output"
        },
        "fields": [
          {
            "name": "id",
            "sourceName": "id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "id"
            }
          },
          {
            "name": "title",
            "sourceName": "title",
            "required": true,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "title"
            }
          },
          {
            "name": "description",
            "sourceName": "description",
            "required": false,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "description"
            }
          },
          {
            "name": "status",
            "sourceName": "status",
            "required": true,
            "schema": {
              "type": "string",
              "enum": [
                "draft",
                "active",
                "completed",
                "archived"
              ],
              "default": "draft"
            },
            "transport": {
              "location": "body",
              "wireName": "status"
            }
          },
          {
            "name": "priority",
            "sourceName": "priority",
            "required": true,
            "schema": {
              "type": "string",
              "enum": [
                "low",
                "medium",
                "high"
              ],
              "default": "medium"
            },
            "transport": {
              "location": "body",
              "wireName": "priority"
            }
          },
          {
            "name": "owner_id",
            "sourceName": "owner_id",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "owner_id"
            }
          },
          {
            "name": "collection_id",
            "sourceName": "collection_id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "collection_id"
            }
          },
          {
            "name": "created_at",
            "sourceName": "created_at",
            "required": true,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "created_at"
            }
          },
          {
            "name": "updated_at",
            "sourceName": "updated_at",
            "required": true,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "updated_at"
            }
          },
          {
            "name": "completed_at",
            "sourceName": "completed_at",
            "required": false,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "completed_at"
            }
          },
          {
            "name": "due_at",
            "sourceName": "due_at",
            "required": false,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "due_at"
            }
          }
        ],
        "required": [
          "id",
          "title",
          "status",
          "priority",
          "collection_id",
          "created_at",
          "updated_at"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_output_item_detail",
          "title": "Item Detail Output",
          "description": "Detailed item payload",
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid"
            },
            "title": {
              "type": "string"
            },
            "description": {
              "type": "string"
            },
            "status": {
              "type": "string",
              "enum": [
                "draft",
                "active",
                "completed",
                "archived"
              ],
              "default": "draft"
            },
            "priority": {
              "type": "string",
              "enum": [
                "low",
                "medium",
                "high"
              ],
              "default": "medium"
            },
            "owner_id": {
              "type": "string",
              "format": "uuid"
            },
            "collection_id": {
              "type": "string",
              "format": "uuid"
            },
            "created_at": {
              "type": "string",
              "format": "date-time"
            },
            "updated_at": {
              "type": "string",
              "format": "date-time"
            },
            "completed_at": {
              "type": "string",
              "format": "date-time"
            },
            "due_at": {
              "type": "string",
              "format": "date-time"
            }
          },
          "additionalProperties": false,
          "required": [
            "id",
            "title",
            "status",
            "priority",
            "collection_id",
            "created_at",
            "updated_at"
          ]
        },
        "mode": "item",
        "collection": false,
        "itemJsonSchema": null,
        "pagination": null,
        "transport": {
          "path": [],
          "query": [],
          "header": [],
          "body": [
            {
              "name": "id",
              "sourceName": "id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "id"
              }
            },
            {
              "name": "title",
              "sourceName": "title",
              "required": true,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "title"
              }
            },
            {
              "name": "description",
              "sourceName": "description",
              "required": false,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "description"
              }
            },
            {
              "name": "status",
              "sourceName": "status",
              "required": true,
              "schema": {
                "type": "string",
                "enum": [
                  "draft",
                  "active",
                  "completed",
                  "archived"
                ],
                "default": "draft"
              },
              "transport": {
                "location": "body",
                "wireName": "status"
              }
            },
            {
              "name": "priority",
              "sourceName": "priority",
              "required": true,
              "schema": {
                "type": "string",
                "enum": [
                  "low",
                  "medium",
                  "high"
                ],
                "default": "medium"
              },
              "transport": {
                "location": "body",
                "wireName": "priority"
              }
            },
            {
              "name": "owner_id",
              "sourceName": "owner_id",
              "required": false,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "owner_id"
              }
            },
            {
              "name": "collection_id",
              "sourceName": "collection_id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "collection_id"
              }
            },
            {
              "name": "created_at",
              "sourceName": "created_at",
              "required": true,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "created_at"
              }
            },
            {
              "name": "updated_at",
              "sourceName": "updated_at",
              "required": true,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "updated_at"
              }
            },
            {
              "name": "completed_at",
              "sourceName": "completed_at",
              "required": false,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "completed_at"
              }
            },
            {
              "name": "due_at",
              "sourceName": "due_at",
              "required": false,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "due_at"
              }
            }
          ]
        }
      },
      "errors": [
        {
          "type": "api_error_case",
          "code": "cap_complete_item_invalid_request",
          "status": 400,
          "source": "request_contract"
        },
        {
          "type": "api_error_case",
          "code": "cap_complete_item_precondition_failed",
          "status": 412,
          "source": "precondition"
        },
        {
          "type": "api_error_case",
          "code": "cap_complete_item_idempotency_conflict",
          "status": 409,
          "source": "idempotency"
        }
      ],
      "endpoint": {
        "auth": "user",
        "authz": [
          {
            "role": null,
            "permission": "items.complete",
            "claim": null,
            "claimValue": null,
            "ownership": "owner_or_admin",
            "ownershipField": "owner_id"
          }
        ],
        "preconditions": [
          {
            "header": "If-Match",
            "required": true,
            "error": 412,
            "source": "updated_at",
            "code": "cap_complete_item_precondition_failed"
          }
        ],
        "idempotency": [
          {
            "header": "Idempotency-Key",
            "required": true,
            "error": 409,
            "code": "cap_complete_item_idempotency_conflict"
          }
        ],
        "cache": [],
        "asyncJobs": [],
        "asyncStatus": [],
        "download": []
      }
    },
    {
      "capabilityId": "cap_list_items",
      "handlerName": "handleListItems",
      "repositoryMethod": "listItems",
      "method": "GET",
      "path": "/items",
      "successStatus": 200,
      "requestContract": {
        "type": "api_request_contract",
        "shape": {
          "id": "shape_input_list_items",
          "name": "List Items Input"
        },
        "fields": [
          {
            "name": "collection_id",
            "sourceName": "collection_id",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "query",
              "wireName": "collection_id"
            }
          },
          {
            "name": "owner_id",
            "sourceName": "owner_id",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "query",
              "wireName": "owner_id"
            }
          },
          {
            "name": "status",
            "sourceName": "status",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "draft",
                "active",
                "completed",
                "archived"
              ]
            },
            "transport": {
              "location": "query",
              "wireName": "status"
            }
          },
          {
            "name": "after",
            "sourceName": "after",
            "required": false,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "query",
              "wireName": "after"
            }
          },
          {
            "name": "limit",
            "sourceName": "limit",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 25
            },
            "transport": {
              "location": "query",
              "wireName": "limit"
            }
          }
        ],
        "required": [],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_input_list_items",
          "title": "List Items Input",
          "description": "Input for listing items",
          "type": "object",
          "properties": {
            "collection_id": {
              "type": "string",
              "format": "uuid"
            },
            "owner_id": {
              "type": "string",
              "format": "uuid"
            },
            "status": {
              "type": "string",
              "enum": [
                "draft",
                "active",
                "completed",
                "archived"
              ]
            },
            "after": {
              "type": "string"
            },
            "limit": {
              "type": "integer",
              "default": 25
            }
          },
          "additionalProperties": false
        },
        "transport": {
          "path": [],
          "query": [
            {
              "name": "collection_id",
              "sourceName": "collection_id",
              "required": false,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "query",
                "wireName": "collection_id"
              }
            },
            {
              "name": "owner_id",
              "sourceName": "owner_id",
              "required": false,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "query",
                "wireName": "owner_id"
              }
            },
            {
              "name": "status",
              "sourceName": "status",
              "required": false,
              "schema": {
                "type": "string",
                "enum": [
                  "draft",
                  "active",
                  "completed",
                  "archived"
                ]
              },
              "transport": {
                "location": "query",
                "wireName": "status"
              }
            },
            {
              "name": "after",
              "sourceName": "after",
              "required": false,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "query",
                "wireName": "after"
              }
            },
            {
              "name": "limit",
              "sourceName": "limit",
              "required": false,
              "schema": {
                "type": "integer",
                "default": 25
              },
              "transport": {
                "location": "query",
                "wireName": "limit"
              }
            }
          ],
          "header": [],
          "body": []
        }
      },
      "responseContract": {
        "type": "api_response_contract",
        "shape": {
          "id": "shape_output_item_detail",
          "name": "Item Detail Output"
        },
        "fields": [
          {
            "name": "id",
            "sourceName": "id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "id"
            }
          },
          {
            "name": "title",
            "sourceName": "title",
            "required": true,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "title"
            }
          },
          {
            "name": "description",
            "sourceName": "description",
            "required": false,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "description"
            }
          },
          {
            "name": "status",
            "sourceName": "status",
            "required": true,
            "schema": {
              "type": "string",
              "enum": [
                "draft",
                "active",
                "completed",
                "archived"
              ],
              "default": "draft"
            },
            "transport": {
              "location": "body",
              "wireName": "status"
            }
          },
          {
            "name": "priority",
            "sourceName": "priority",
            "required": true,
            "schema": {
              "type": "string",
              "enum": [
                "low",
                "medium",
                "high"
              ],
              "default": "medium"
            },
            "transport": {
              "location": "body",
              "wireName": "priority"
            }
          },
          {
            "name": "owner_id",
            "sourceName": "owner_id",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "owner_id"
            }
          },
          {
            "name": "collection_id",
            "sourceName": "collection_id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "collection_id"
            }
          },
          {
            "name": "created_at",
            "sourceName": "created_at",
            "required": true,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "created_at"
            }
          },
          {
            "name": "updated_at",
            "sourceName": "updated_at",
            "required": true,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "updated_at"
            }
          },
          {
            "name": "completed_at",
            "sourceName": "completed_at",
            "required": false,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "completed_at"
            }
          },
          {
            "name": "due_at",
            "sourceName": "due_at",
            "required": false,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "due_at"
            }
          }
        ],
        "required": [
          "id",
          "title",
          "status",
          "priority",
          "collection_id",
          "created_at",
          "updated_at"
        ],
        "jsonSchema": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "items",
            "next_cursor"
          ],
          "properties": {
            "items": {
              "type": "array",
              "items": {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "$id": "topogram:shape:shape_output_item_detail",
                "title": "Item Detail Output",
                "description": "Detailed item payload",
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "format": "uuid"
                  },
                  "title": {
                    "type": "string"
                  },
                  "description": {
                    "type": "string"
                  },
                  "status": {
                    "type": "string",
                    "enum": [
                      "draft",
                      "active",
                      "completed",
                      "archived"
                    ],
                    "default": "draft"
                  },
                  "priority": {
                    "type": "string",
                    "enum": [
                      "low",
                      "medium",
                      "high"
                    ],
                    "default": "medium"
                  },
                  "owner_id": {
                    "type": "string",
                    "format": "uuid"
                  },
                  "collection_id": {
                    "type": "string",
                    "format": "uuid"
                  },
                  "created_at": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "updated_at": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "completed_at": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "due_at": {
                    "type": "string",
                    "format": "date-time"
                  }
                },
                "additionalProperties": false,
                "required": [
                  "id",
                  "title",
                  "status",
                  "priority",
                  "collection_id",
                  "created_at",
                  "updated_at"
                ]
              }
            },
            "next_cursor": {
              "type": "string"
            }
          }
        },
        "mode": "cursor",
        "collection": true,
        "itemJsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_output_item_detail",
          "title": "Item Detail Output",
          "description": "Detailed item payload",
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid"
            },
            "title": {
              "type": "string"
            },
            "description": {
              "type": "string"
            },
            "status": {
              "type": "string",
              "enum": [
                "draft",
                "active",
                "completed",
                "archived"
              ],
              "default": "draft"
            },
            "priority": {
              "type": "string",
              "enum": [
                "low",
                "medium",
                "high"
              ],
              "default": "medium"
            },
            "owner_id": {
              "type": "string",
              "format": "uuid"
            },
            "collection_id": {
              "type": "string",
              "format": "uuid"
            },
            "created_at": {
              "type": "string",
              "format": "date-time"
            },
            "updated_at": {
              "type": "string",
              "format": "date-time"
            },
            "completed_at": {
              "type": "string",
              "format": "date-time"
            },
            "due_at": {
              "type": "string",
              "format": "date-time"
            }
          },
          "additionalProperties": false,
          "required": [
            "id",
            "title",
            "status",
            "priority",
            "collection_id",
            "created_at",
            "updated_at"
          ]
        },
        "pagination": null,
        "itemShape": {
          "id": "shape_output_item_detail",
          "name": "Item Detail Output"
        },
        "ordering": {
          "field": "created_at",
          "direction": "desc"
        },
        "cursor": {
          "requestAfter": "after",
          "responseNext": "next_cursor",
          "responsePrev": null
        },
        "limit": {
          "field": "limit",
          "defaultValue": 25,
          "maxValue": 100
        },
        "total": {
          "included": false
        },
        "transport": {
          "path": [],
          "query": [],
          "header": [],
          "body": [
            {
              "name": "id",
              "sourceName": "id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "id"
              }
            },
            {
              "name": "title",
              "sourceName": "title",
              "required": true,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "title"
              }
            },
            {
              "name": "description",
              "sourceName": "description",
              "required": false,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "description"
              }
            },
            {
              "name": "status",
              "sourceName": "status",
              "required": true,
              "schema": {
                "type": "string",
                "enum": [
                  "draft",
                  "active",
                  "completed",
                  "archived"
                ],
                "default": "draft"
              },
              "transport": {
                "location": "body",
                "wireName": "status"
              }
            },
            {
              "name": "priority",
              "sourceName": "priority",
              "required": true,
              "schema": {
                "type": "string",
                "enum": [
                  "low",
                  "medium",
                  "high"
                ],
                "default": "medium"
              },
              "transport": {
                "location": "body",
                "wireName": "priority"
              }
            },
            {
              "name": "owner_id",
              "sourceName": "owner_id",
              "required": false,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "owner_id"
              }
            },
            {
              "name": "collection_id",
              "sourceName": "collection_id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "collection_id"
              }
            },
            {
              "name": "created_at",
              "sourceName": "created_at",
              "required": true,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "created_at"
              }
            },
            {
              "name": "updated_at",
              "sourceName": "updated_at",
              "required": true,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "updated_at"
              }
            },
            {
              "name": "completed_at",
              "sourceName": "completed_at",
              "required": false,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "completed_at"
              }
            },
            {
              "name": "due_at",
              "sourceName": "due_at",
              "required": false,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "due_at"
              }
            }
          ]
        }
      },
      "errors": [
        {
          "type": "api_error_case",
          "code": "cap_list_items_invalid_request",
          "status": 400,
          "source": "request_contract"
        },
        {
          "type": "api_error_case",
          "code": "cap_list_items_invalid_cursor",
          "status": 400,
          "source": "cursor_contract"
        },
        {
          "type": "api_error_case",
          "code": "cap_list_items_invalid_limit",
          "status": 400,
          "source": "cursor_contract"
        }
      ],
      "endpoint": {
        "auth": "user",
        "authz": [
          {
            "role": null,
            "permission": "items.read",
            "claim": null,
            "claimValue": null,
            "ownership": null,
            "ownershipField": null
          }
        ],
        "preconditions": [],
        "idempotency": [],
        "cache": [],
        "asyncJobs": [],
        "asyncStatus": [],
        "download": []
      }
    },
    {
      "capabilityId": "cap_delete_item",
      "handlerName": "handleDeleteItem",
      "repositoryMethod": "deleteItem",
      "method": "DELETE",
      "path": "/items/:id",
      "successStatus": 200,
      "requestContract": {
        "type": "api_request_contract",
        "shape": {
          "id": "shape_input_delete_item",
          "name": "Delete Item Input"
        },
        "fields": [
          {
            "name": "item_id",
            "sourceName": "item_id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "path",
              "wireName": "id"
            }
          }
        ],
        "required": [
          "item_id"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_input_delete_item",
          "title": "Delete Item Input",
          "description": "Input for deleting a item",
          "type": "object",
          "properties": {
            "item_id": {
              "type": "string",
              "format": "uuid"
            }
          },
          "additionalProperties": false,
          "required": [
            "item_id"
          ]
        },
        "transport": {
          "path": [
            {
              "name": "item_id",
              "sourceName": "item_id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "path",
                "wireName": "id"
              }
            }
          ],
          "query": [],
          "header": [],
          "body": []
        }
      },
      "responseContract": {
        "type": "api_response_contract",
        "shape": {
          "id": "shape_output_item_detail",
          "name": "Item Detail Output"
        },
        "fields": [
          {
            "name": "id",
            "sourceName": "id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "id"
            }
          },
          {
            "name": "title",
            "sourceName": "title",
            "required": true,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "title"
            }
          },
          {
            "name": "description",
            "sourceName": "description",
            "required": false,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "description"
            }
          },
          {
            "name": "status",
            "sourceName": "status",
            "required": true,
            "schema": {
              "type": "string",
              "enum": [
                "draft",
                "active",
                "completed",
                "archived"
              ],
              "default": "draft"
            },
            "transport": {
              "location": "body",
              "wireName": "status"
            }
          },
          {
            "name": "priority",
            "sourceName": "priority",
            "required": true,
            "schema": {
              "type": "string",
              "enum": [
                "low",
                "medium",
                "high"
              ],
              "default": "medium"
            },
            "transport": {
              "location": "body",
              "wireName": "priority"
            }
          },
          {
            "name": "owner_id",
            "sourceName": "owner_id",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "owner_id"
            }
          },
          {
            "name": "collection_id",
            "sourceName": "collection_id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "collection_id"
            }
          },
          {
            "name": "created_at",
            "sourceName": "created_at",
            "required": true,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "created_at"
            }
          },
          {
            "name": "updated_at",
            "sourceName": "updated_at",
            "required": true,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "updated_at"
            }
          },
          {
            "name": "completed_at",
            "sourceName": "completed_at",
            "required": false,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "completed_at"
            }
          },
          {
            "name": "due_at",
            "sourceName": "due_at",
            "required": false,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "due_at"
            }
          }
        ],
        "required": [
          "id",
          "title",
          "status",
          "priority",
          "collection_id",
          "created_at",
          "updated_at"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_output_item_detail",
          "title": "Item Detail Output",
          "description": "Detailed item payload",
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid"
            },
            "title": {
              "type": "string"
            },
            "description": {
              "type": "string"
            },
            "status": {
              "type": "string",
              "enum": [
                "draft",
                "active",
                "completed",
                "archived"
              ],
              "default": "draft"
            },
            "priority": {
              "type": "string",
              "enum": [
                "low",
                "medium",
                "high"
              ],
              "default": "medium"
            },
            "owner_id": {
              "type": "string",
              "format": "uuid"
            },
            "collection_id": {
              "type": "string",
              "format": "uuid"
            },
            "created_at": {
              "type": "string",
              "format": "date-time"
            },
            "updated_at": {
              "type": "string",
              "format": "date-time"
            },
            "completed_at": {
              "type": "string",
              "format": "date-time"
            },
            "due_at": {
              "type": "string",
              "format": "date-time"
            }
          },
          "additionalProperties": false,
          "required": [
            "id",
            "title",
            "status",
            "priority",
            "collection_id",
            "created_at",
            "updated_at"
          ]
        },
        "mode": "item",
        "collection": false,
        "itemJsonSchema": null,
        "pagination": null,
        "transport": {
          "path": [],
          "query": [],
          "header": [],
          "body": [
            {
              "name": "id",
              "sourceName": "id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "id"
              }
            },
            {
              "name": "title",
              "sourceName": "title",
              "required": true,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "title"
              }
            },
            {
              "name": "description",
              "sourceName": "description",
              "required": false,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "description"
              }
            },
            {
              "name": "status",
              "sourceName": "status",
              "required": true,
              "schema": {
                "type": "string",
                "enum": [
                  "draft",
                  "active",
                  "completed",
                  "archived"
                ],
                "default": "draft"
              },
              "transport": {
                "location": "body",
                "wireName": "status"
              }
            },
            {
              "name": "priority",
              "sourceName": "priority",
              "required": true,
              "schema": {
                "type": "string",
                "enum": [
                  "low",
                  "medium",
                  "high"
                ],
                "default": "medium"
              },
              "transport": {
                "location": "body",
                "wireName": "priority"
              }
            },
            {
              "name": "owner_id",
              "sourceName": "owner_id",
              "required": false,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "owner_id"
              }
            },
            {
              "name": "collection_id",
              "sourceName": "collection_id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "collection_id"
              }
            },
            {
              "name": "created_at",
              "sourceName": "created_at",
              "required": true,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "created_at"
              }
            },
            {
              "name": "updated_at",
              "sourceName": "updated_at",
              "required": true,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "updated_at"
              }
            },
            {
              "name": "completed_at",
              "sourceName": "completed_at",
              "required": false,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "completed_at"
              }
            },
            {
              "name": "due_at",
              "sourceName": "due_at",
              "required": false,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "due_at"
              }
            }
          ]
        }
      },
      "errors": [
        {
          "type": "api_error_case",
          "code": "cap_delete_item_invalid_request",
          "status": 400,
          "source": "request_contract"
        },
        {
          "type": "api_error_case",
          "code": "cap_delete_item_precondition_failed",
          "status": 412,
          "source": "precondition"
        },
        {
          "type": "api_error_case",
          "code": "cap_delete_item_not_found",
          "status": 404,
          "source": "projection_mapping"
        }
      ],
      "endpoint": {
        "auth": "user",
        "authz": [
          {
            "role": "manager",
            "permission": "items.delete",
            "claim": null,
            "claimValue": null,
            "ownership": null,
            "ownershipField": null
          }
        ],
        "preconditions": [
          {
            "header": "If-Match",
            "required": true,
            "error": 412,
            "source": "updated_at",
            "code": "cap_delete_item_precondition_failed"
          }
        ],
        "idempotency": [],
        "cache": [],
        "asyncJobs": [],
        "asyncStatus": [],
        "download": []
      }
    },
    {
      "capabilityId": "cap_export_items",
      "handlerName": "handleExportItems",
      "repositoryMethod": "exportItems",
      "method": "POST",
      "path": "/items/export",
      "successStatus": 202,
      "requestContract": {
        "type": "api_request_contract",
        "shape": {
          "id": "shape_input_export_items",
          "name": "Export Items Input"
        },
        "fields": [
          {
            "name": "collection_id",
            "sourceName": "collection_id",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "collection_id"
            }
          },
          {
            "name": "owner_id",
            "sourceName": "owner_id",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "owner_id"
            }
          },
          {
            "name": "status",
            "sourceName": "status",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "draft",
                "active",
                "completed",
                "archived"
              ]
            },
            "transport": {
              "location": "body",
              "wireName": "status"
            }
          },
          {
            "name": "callback_url",
            "sourceName": "callback_url",
            "required": false,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "callback_url"
            }
          }
        ],
        "required": [],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_input_export_items",
          "title": "Export Items Input",
          "description": "Filters accepted when requesting a item export",
          "type": "object",
          "properties": {
            "collection_id": {
              "type": "string",
              "format": "uuid"
            },
            "owner_id": {
              "type": "string",
              "format": "uuid"
            },
            "status": {
              "type": "string",
              "enum": [
                "draft",
                "active",
                "completed",
                "archived"
              ]
            },
            "callback_url": {
              "type": "string"
            }
          },
          "additionalProperties": false
        },
        "transport": {
          "path": [],
          "query": [],
          "header": [],
          "body": [
            {
              "name": "collection_id",
              "sourceName": "collection_id",
              "required": false,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "collection_id"
              }
            },
            {
              "name": "owner_id",
              "sourceName": "owner_id",
              "required": false,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "owner_id"
              }
            },
            {
              "name": "status",
              "sourceName": "status",
              "required": false,
              "schema": {
                "type": "string",
                "enum": [
                  "draft",
                  "active",
                  "completed",
                  "archived"
                ]
              },
              "transport": {
                "location": "body",
                "wireName": "status"
              }
            },
            {
              "name": "callback_url",
              "sourceName": "callback_url",
              "required": false,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "callback_url"
              }
            }
          ]
        }
      },
      "responseContract": {
        "type": "api_response_contract",
        "shape": {
          "id": "shape_output_item_export_job",
          "name": "Item Export Job"
        },
        "fields": [
          {
            "name": "job_id",
            "sourceName": "job_id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "job_id"
            }
          },
          {
            "name": "status",
            "sourceName": "status",
            "required": true,
            "schema": {
              "type": "string",
              "default": "accepted"
            },
            "transport": {
              "location": "body",
              "wireName": "status"
            }
          },
          {
            "name": "status_url",
            "sourceName": "status_url",
            "required": true,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "status_url"
            }
          },
          {
            "name": "submitted_at",
            "sourceName": "submitted_at",
            "required": true,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "submitted_at"
            }
          }
        ],
        "required": [
          "job_id",
          "status",
          "status_url",
          "submitted_at"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_output_item_export_job",
          "title": "Item Export Job",
          "description": "Accepted job payload for long-running item exports",
          "type": "object",
          "properties": {
            "job_id": {
              "type": "string",
              "format": "uuid"
            },
            "status": {
              "type": "string",
              "default": "accepted"
            },
            "status_url": {
              "type": "string"
            },
            "submitted_at": {
              "type": "string",
              "format": "date-time"
            }
          },
          "additionalProperties": false,
          "required": [
            "job_id",
            "status",
            "status_url",
            "submitted_at"
          ]
        },
        "mode": "item",
        "collection": false,
        "itemJsonSchema": null,
        "pagination": null,
        "transport": {
          "path": [],
          "query": [],
          "header": [],
          "body": [
            {
              "name": "job_id",
              "sourceName": "job_id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "job_id"
              }
            },
            {
              "name": "status",
              "sourceName": "status",
              "required": true,
              "schema": {
                "type": "string",
                "default": "accepted"
              },
              "transport": {
                "location": "body",
                "wireName": "status"
              }
            },
            {
              "name": "status_url",
              "sourceName": "status_url",
              "required": true,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "status_url"
              }
            },
            {
              "name": "submitted_at",
              "sourceName": "submitted_at",
              "required": true,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "submitted_at"
              }
            }
          ]
        }
      },
      "errors": [
        {
          "type": "api_error_case",
          "code": "cap_export_items_invalid_request",
          "status": 400,
          "source": "request_contract"
        }
      ],
      "endpoint": {
        "auth": "user",
        "authz": [
          {
            "role": null,
            "permission": "items.export",
            "claim": null,
            "claimValue": null,
            "ownership": null,
            "ownershipField": null
          }
        ],
        "preconditions": [],
        "idempotency": [],
        "cache": [],
        "asyncJobs": [
          {
            "mode": "job",
            "accepted": 202,
            "locationHeader": "Location",
            "retryAfterHeader": "Retry-After",
            "statusPath": "/item-exports/:job_id",
            "statusCapability": {
              "id": "cap_get_item_export_job",
              "kind": "capability"
            },
            "job": {
              "id": "shape_output_item_export_job",
              "kind": "shape"
            }
          }
        ],
        "asyncStatus": [],
        "download": []
      }
    },
    {
      "capabilityId": "cap_get_item_export_job",
      "handlerName": "handleGetItemExportJob",
      "repositoryMethod": "getItemExportJob",
      "method": "GET",
      "path": "/item-exports/:job_id",
      "successStatus": 200,
      "requestContract": {
        "type": "api_request_contract",
        "shape": {
          "id": "shape_input_get_item_export_job",
          "name": "Get Item Export Job Input"
        },
        "fields": [
          {
            "name": "job_id",
            "sourceName": "job_id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "path",
              "wireName": "job_id"
            }
          }
        ],
        "required": [
          "job_id"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_input_get_item_export_job",
          "title": "Get Item Export Job Input",
          "description": "Input for fetching item export job status",
          "type": "object",
          "properties": {
            "job_id": {
              "type": "string",
              "format": "uuid"
            }
          },
          "additionalProperties": false,
          "required": [
            "job_id"
          ]
        },
        "transport": {
          "path": [
            {
              "name": "job_id",
              "sourceName": "job_id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "path",
                "wireName": "job_id"
              }
            }
          ],
          "query": [],
          "header": [],
          "body": []
        }
      },
      "responseContract": {
        "type": "api_response_contract",
        "shape": {
          "id": "shape_output_item_export_status",
          "name": "Item Export Status"
        },
        "fields": [
          {
            "name": "job_id",
            "sourceName": "job_id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "job_id"
            }
          },
          {
            "name": "status",
            "sourceName": "status",
            "required": true,
            "schema": {
              "type": "string",
              "enum": [
                "accepted",
                "running",
                "completed",
                "failed",
                "expired"
              ],
              "default": "accepted"
            },
            "transport": {
              "location": "body",
              "wireName": "status"
            }
          },
          {
            "name": "status_url",
            "sourceName": "status_url",
            "required": true,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "status_url"
            }
          },
          {
            "name": "submitted_at",
            "sourceName": "submitted_at",
            "required": true,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "submitted_at"
            }
          },
          {
            "name": "completed_at",
            "sourceName": "completed_at",
            "required": false,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "completed_at"
            }
          },
          {
            "name": "expires_at",
            "sourceName": "expires_at",
            "required": false,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "expires_at"
            }
          },
          {
            "name": "download_url",
            "sourceName": "download_url",
            "required": false,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "download_url"
            }
          },
          {
            "name": "error_message",
            "sourceName": "error_message",
            "required": false,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "error_message"
            }
          }
        ],
        "required": [
          "job_id",
          "status",
          "status_url",
          "submitted_at"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_output_item_export_status",
          "title": "Item Export Status",
          "description": "Status payload for long-running item export jobs",
          "type": "object",
          "properties": {
            "job_id": {
              "type": "string",
              "format": "uuid"
            },
            "status": {
              "type": "string",
              "enum": [
                "accepted",
                "running",
                "completed",
                "failed",
                "expired"
              ],
              "default": "accepted"
            },
            "status_url": {
              "type": "string"
            },
            "submitted_at": {
              "type": "string",
              "format": "date-time"
            },
            "completed_at": {
              "type": "string",
              "format": "date-time"
            },
            "expires_at": {
              "type": "string",
              "format": "date-time"
            },
            "download_url": {
              "type": "string"
            },
            "error_message": {
              "type": "string"
            }
          },
          "additionalProperties": false,
          "required": [
            "job_id",
            "status",
            "status_url",
            "submitted_at"
          ]
        },
        "mode": "item",
        "collection": false,
        "itemJsonSchema": null,
        "pagination": null,
        "transport": {
          "path": [],
          "query": [],
          "header": [],
          "body": [
            {
              "name": "job_id",
              "sourceName": "job_id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "job_id"
              }
            },
            {
              "name": "status",
              "sourceName": "status",
              "required": true,
              "schema": {
                "type": "string",
                "enum": [
                  "accepted",
                  "running",
                  "completed",
                  "failed",
                  "expired"
                ],
                "default": "accepted"
              },
              "transport": {
                "location": "body",
                "wireName": "status"
              }
            },
            {
              "name": "status_url",
              "sourceName": "status_url",
              "required": true,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "status_url"
              }
            },
            {
              "name": "submitted_at",
              "sourceName": "submitted_at",
              "required": true,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "submitted_at"
              }
            },
            {
              "name": "completed_at",
              "sourceName": "completed_at",
              "required": false,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "completed_at"
              }
            },
            {
              "name": "expires_at",
              "sourceName": "expires_at",
              "required": false,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "expires_at"
              }
            },
            {
              "name": "download_url",
              "sourceName": "download_url",
              "required": false,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "download_url"
              }
            },
            {
              "name": "error_message",
              "sourceName": "error_message",
              "required": false,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "error_message"
              }
            }
          ]
        }
      },
      "errors": [
        {
          "type": "api_error_case",
          "code": "cap_get_item_export_job_invalid_request",
          "status": 400,
          "source": "request_contract"
        },
        {
          "type": "api_error_case",
          "code": "cap_get_item_export_job_not_found",
          "status": 404,
          "source": "projection_mapping"
        }
      ],
      "endpoint": {
        "auth": "user",
        "authz": [
          {
            "role": null,
            "permission": "items.export.read",
            "claim": null,
            "claimValue": null,
            "ownership": "owner_or_admin",
            "ownershipField": "owner_id"
          }
        ],
        "preconditions": [],
        "idempotency": [],
        "cache": [],
        "asyncJobs": [],
        "asyncStatus": [
          {
            "asyncFor": {
              "id": "cap_export_items",
              "kind": "capability"
            },
            "stateField": "status",
            "completed": "completed",
            "failed": "failed",
            "expired": "expired",
            "downloadCapability": {
              "id": "cap_download_item_export",
              "kind": "capability"
            },
            "downloadField": "download_url",
            "errorField": "error_message"
          }
        ],
        "download": []
      }
    },
    {
      "capabilityId": "cap_download_item_export",
      "handlerName": "handleDownloadItemExport",
      "repositoryMethod": "downloadItemExport",
      "method": "GET",
      "path": "/item-exports/:job_id/download",
      "successStatus": 200,
      "requestContract": {
        "type": "api_request_contract",
        "shape": {
          "id": "shape_input_get_item_export_job",
          "name": "Get Item Export Job Input"
        },
        "fields": [
          {
            "name": "job_id",
            "sourceName": "job_id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "path",
              "wireName": "job_id"
            }
          }
        ],
        "required": [
          "job_id"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_input_get_item_export_job",
          "title": "Get Item Export Job Input",
          "description": "Input for fetching item export job status",
          "type": "object",
          "properties": {
            "job_id": {
              "type": "string",
              "format": "uuid"
            }
          },
          "additionalProperties": false,
          "required": [
            "job_id"
          ]
        },
        "transport": {
          "path": [
            {
              "name": "job_id",
              "sourceName": "job_id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "path",
                "wireName": "job_id"
              }
            }
          ],
          "query": [],
          "header": [],
          "body": []
        }
      },
      "responseContract": null,
      "errors": [
        {
          "type": "api_error_case",
          "code": "cap_download_item_export_invalid_request",
          "status": 400,
          "source": "request_contract"
        },
        {
          "type": "api_error_case",
          "code": "cap_download_item_export_not_found",
          "status": 404,
          "source": "projection_mapping"
        },
        {
          "type": "api_error_case",
          "code": "cap_download_item_export_not_ready",
          "status": 409,
          "source": "projection_mapping"
        }
      ],
      "endpoint": {
        "auth": "user",
        "authz": [
          {
            "role": null,
            "permission": "items.export.download",
            "claim": null,
            "claimValue": null,
            "ownership": "owner_or_admin",
            "ownershipField": "owner_id"
          }
        ],
        "preconditions": [],
        "idempotency": [],
        "cache": [],
        "asyncJobs": [],
        "asyncStatus": [],
        "download": [
          {
            "asyncFor": {
              "id": "cap_export_items",
              "kind": "capability"
            },
            "media": "application/zip",
            "filename": "item-export.zip",
            "disposition": "attachment"
          }
        ]
      }
    },
    {
      "capabilityId": "cap_list_collections",
      "handlerName": "handleListCollections",
      "repositoryMethod": "listCollections",
      "method": "GET",
      "path": "/collections",
      "successStatus": 200,
      "requestContract": {
        "type": "api_request_contract",
        "shape": {
          "id": "shape_input_list_collections",
          "name": "List Collections Input"
        },
        "fields": [
          {
            "name": "after",
            "sourceName": "after",
            "required": false,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "query",
              "wireName": "after"
            }
          },
          {
            "name": "limit",
            "sourceName": "limit",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 25
            },
            "transport": {
              "location": "query",
              "wireName": "limit"
            }
          }
        ],
        "required": [],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_input_list_collections",
          "title": "List Collections Input",
          "description": "Input for listing collections",
          "type": "object",
          "properties": {
            "after": {
              "type": "string"
            },
            "limit": {
              "type": "integer",
              "default": 25
            }
          },
          "additionalProperties": false
        },
        "transport": {
          "path": [],
          "query": [
            {
              "name": "after",
              "sourceName": "after",
              "required": false,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "query",
                "wireName": "after"
              }
            },
            {
              "name": "limit",
              "sourceName": "limit",
              "required": false,
              "schema": {
                "type": "integer",
                "default": 25
              },
              "transport": {
                "location": "query",
                "wireName": "limit"
              }
            }
          ],
          "header": [],
          "body": []
        }
      },
      "responseContract": {
        "type": "api_response_contract",
        "shape": {
          "id": "shape_output_collection_detail",
          "name": "Collection Detail Output"
        },
        "fields": [
          {
            "name": "id",
            "sourceName": "id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "id"
            }
          },
          {
            "name": "name",
            "sourceName": "name",
            "required": true,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "name"
            }
          },
          {
            "name": "description",
            "sourceName": "description",
            "required": false,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "description"
            }
          },
          {
            "name": "status",
            "sourceName": "status",
            "required": true,
            "schema": {
              "type": "string",
              "enum": [
                "active",
                "archived"
              ],
              "default": "active"
            },
            "transport": {
              "location": "body",
              "wireName": "status"
            }
          },
          {
            "name": "owner_id",
            "sourceName": "owner_id",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "owner_id"
            }
          },
          {
            "name": "created_at",
            "sourceName": "created_at",
            "required": true,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "created_at"
            }
          }
        ],
        "required": [
          "id",
          "name",
          "status",
          "created_at"
        ],
        "jsonSchema": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "items",
            "next_cursor"
          ],
          "properties": {
            "items": {
              "type": "array",
              "items": {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "$id": "topogram:shape:shape_output_collection_detail",
                "title": "Collection Detail Output",
                "description": "Detailed collection payload",
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "format": "uuid"
                  },
                  "name": {
                    "type": "string"
                  },
                  "description": {
                    "type": "string"
                  },
                  "status": {
                    "type": "string",
                    "enum": [
                      "active",
                      "archived"
                    ],
                    "default": "active"
                  },
                  "owner_id": {
                    "type": "string",
                    "format": "uuid"
                  },
                  "created_at": {
                    "type": "string",
                    "format": "date-time"
                  }
                },
                "additionalProperties": false,
                "required": [
                  "id",
                  "name",
                  "status",
                  "created_at"
                ]
              }
            },
            "next_cursor": {
              "type": "string"
            }
          }
        },
        "mode": "cursor",
        "collection": true,
        "itemJsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_output_collection_detail",
          "title": "Collection Detail Output",
          "description": "Detailed collection payload",
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid"
            },
            "name": {
              "type": "string"
            },
            "description": {
              "type": "string"
            },
            "status": {
              "type": "string",
              "enum": [
                "active",
                "archived"
              ],
              "default": "active"
            },
            "owner_id": {
              "type": "string",
              "format": "uuid"
            },
            "created_at": {
              "type": "string",
              "format": "date-time"
            }
          },
          "additionalProperties": false,
          "required": [
            "id",
            "name",
            "status",
            "created_at"
          ]
        },
        "pagination": null,
        "itemShape": {
          "id": "shape_output_collection_detail",
          "name": "Collection Detail Output"
        },
        "ordering": {
          "field": "created_at",
          "direction": "desc"
        },
        "cursor": {
          "requestAfter": "after",
          "responseNext": "next_cursor",
          "responsePrev": null
        },
        "limit": {
          "field": "limit",
          "defaultValue": 25,
          "maxValue": 100
        },
        "total": {
          "included": false
        },
        "transport": {
          "path": [],
          "query": [],
          "header": [],
          "body": [
            {
              "name": "id",
              "sourceName": "id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "id"
              }
            },
            {
              "name": "name",
              "sourceName": "name",
              "required": true,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "name"
              }
            },
            {
              "name": "description",
              "sourceName": "description",
              "required": false,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "description"
              }
            },
            {
              "name": "status",
              "sourceName": "status",
              "required": true,
              "schema": {
                "type": "string",
                "enum": [
                  "active",
                  "archived"
                ],
                "default": "active"
              },
              "transport": {
                "location": "body",
                "wireName": "status"
              }
            },
            {
              "name": "owner_id",
              "sourceName": "owner_id",
              "required": false,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "owner_id"
              }
            },
            {
              "name": "created_at",
              "sourceName": "created_at",
              "required": true,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "created_at"
              }
            }
          ]
        }
      },
      "errors": [
        {
          "type": "api_error_case",
          "code": "cap_list_collections_invalid_request",
          "status": 400,
          "source": "request_contract"
        },
        {
          "type": "api_error_case",
          "code": "cap_list_collections_invalid_cursor",
          "status": 400,
          "source": "cursor_contract"
        },
        {
          "type": "api_error_case",
          "code": "cap_list_collections_invalid_limit",
          "status": 400,
          "source": "cursor_contract"
        }
      ],
      "endpoint": {
        "auth": "user",
        "authz": [
          {
            "role": null,
            "permission": "collections.read",
            "claim": null,
            "claimValue": null,
            "ownership": null,
            "ownershipField": null
          }
        ],
        "preconditions": [],
        "idempotency": [],
        "cache": [],
        "asyncJobs": [],
        "asyncStatus": [],
        "download": []
      }
    },
    {
      "capabilityId": "cap_get_collection",
      "handlerName": "handleGetCollection",
      "repositoryMethod": "getCollection",
      "method": "GET",
      "path": "/collections/:id",
      "successStatus": 200,
      "requestContract": {
        "type": "api_request_contract",
        "shape": {
          "id": "shape_input_get_collection",
          "name": "Get Collection Input"
        },
        "fields": [
          {
            "name": "collection_id",
            "sourceName": "collection_id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "path",
              "wireName": "id"
            }
          }
        ],
        "required": [
          "collection_id"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_input_get_collection",
          "title": "Get Collection Input",
          "description": "Input for fetching a single collection",
          "type": "object",
          "properties": {
            "collection_id": {
              "type": "string",
              "format": "uuid"
            }
          },
          "additionalProperties": false,
          "required": [
            "collection_id"
          ]
        },
        "transport": {
          "path": [
            {
              "name": "collection_id",
              "sourceName": "collection_id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "path",
                "wireName": "id"
              }
            }
          ],
          "query": [],
          "header": [],
          "body": []
        }
      },
      "responseContract": {
        "type": "api_response_contract",
        "shape": {
          "id": "shape_output_collection_detail",
          "name": "Collection Detail Output"
        },
        "fields": [
          {
            "name": "id",
            "sourceName": "id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "id"
            }
          },
          {
            "name": "name",
            "sourceName": "name",
            "required": true,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "name"
            }
          },
          {
            "name": "description",
            "sourceName": "description",
            "required": false,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "description"
            }
          },
          {
            "name": "status",
            "sourceName": "status",
            "required": true,
            "schema": {
              "type": "string",
              "enum": [
                "active",
                "archived"
              ],
              "default": "active"
            },
            "transport": {
              "location": "body",
              "wireName": "status"
            }
          },
          {
            "name": "owner_id",
            "sourceName": "owner_id",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "owner_id"
            }
          },
          {
            "name": "created_at",
            "sourceName": "created_at",
            "required": true,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "created_at"
            }
          }
        ],
        "required": [
          "id",
          "name",
          "status",
          "created_at"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_output_collection_detail",
          "title": "Collection Detail Output",
          "description": "Detailed collection payload",
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid"
            },
            "name": {
              "type": "string"
            },
            "description": {
              "type": "string"
            },
            "status": {
              "type": "string",
              "enum": [
                "active",
                "archived"
              ],
              "default": "active"
            },
            "owner_id": {
              "type": "string",
              "format": "uuid"
            },
            "created_at": {
              "type": "string",
              "format": "date-time"
            }
          },
          "additionalProperties": false,
          "required": [
            "id",
            "name",
            "status",
            "created_at"
          ]
        },
        "mode": "item",
        "collection": false,
        "itemJsonSchema": null,
        "pagination": null,
        "transport": {
          "path": [],
          "query": [],
          "header": [],
          "body": [
            {
              "name": "id",
              "sourceName": "id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "id"
              }
            },
            {
              "name": "name",
              "sourceName": "name",
              "required": true,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "name"
              }
            },
            {
              "name": "description",
              "sourceName": "description",
              "required": false,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "description"
              }
            },
            {
              "name": "status",
              "sourceName": "status",
              "required": true,
              "schema": {
                "type": "string",
                "enum": [
                  "active",
                  "archived"
                ],
                "default": "active"
              },
              "transport": {
                "location": "body",
                "wireName": "status"
              }
            },
            {
              "name": "owner_id",
              "sourceName": "owner_id",
              "required": false,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "owner_id"
              }
            },
            {
              "name": "created_at",
              "sourceName": "created_at",
              "required": true,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "created_at"
              }
            }
          ]
        }
      },
      "errors": [
        {
          "type": "api_error_case",
          "code": "cap_get_collection_invalid_request",
          "status": 400,
          "source": "request_contract"
        },
        {
          "type": "api_error_case",
          "code": "cap_get_collection_not_found",
          "status": 404,
          "source": "projection_mapping"
        }
      ],
      "endpoint": {
        "auth": "user",
        "authz": [
          {
            "role": null,
            "permission": "collections.read",
            "claim": null,
            "claimValue": null,
            "ownership": null,
            "ownershipField": null
          }
        ],
        "preconditions": [],
        "idempotency": [],
        "cache": [],
        "asyncJobs": [],
        "asyncStatus": [],
        "download": []
      }
    },
    {
      "capabilityId": "cap_create_collection",
      "handlerName": "handleCreateCollection",
      "repositoryMethod": "createCollection",
      "method": "POST",
      "path": "/collections",
      "successStatus": 201,
      "requestContract": {
        "type": "api_request_contract",
        "shape": {
          "id": "shape_input_create_collection",
          "name": "Create Collection Input"
        },
        "fields": [
          {
            "name": "name",
            "sourceName": "name",
            "required": true,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "name"
            }
          },
          {
            "name": "description",
            "sourceName": "description",
            "required": false,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "description"
            }
          },
          {
            "name": "status",
            "sourceName": "status",
            "required": true,
            "schema": {
              "type": "string",
              "enum": [
                "active",
                "archived"
              ],
              "default": "active"
            },
            "transport": {
              "location": "body",
              "wireName": "status"
            }
          },
          {
            "name": "owner_id",
            "sourceName": "owner_id",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "owner_id"
            }
          }
        ],
        "required": [
          "name",
          "status"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_input_create_collection",
          "title": "Create Collection Input",
          "description": "Fields accepted when creating a collection",
          "type": "object",
          "properties": {
            "name": {
              "type": "string"
            },
            "description": {
              "type": "string"
            },
            "status": {
              "type": "string",
              "enum": [
                "active",
                "archived"
              ],
              "default": "active"
            },
            "owner_id": {
              "type": "string",
              "format": "uuid"
            }
          },
          "additionalProperties": false,
          "required": [
            "name",
            "status"
          ]
        },
        "transport": {
          "path": [],
          "query": [],
          "header": [],
          "body": [
            {
              "name": "name",
              "sourceName": "name",
              "required": true,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "name"
              }
            },
            {
              "name": "description",
              "sourceName": "description",
              "required": false,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "description"
              }
            },
            {
              "name": "status",
              "sourceName": "status",
              "required": true,
              "schema": {
                "type": "string",
                "enum": [
                  "active",
                  "archived"
                ],
                "default": "active"
              },
              "transport": {
                "location": "body",
                "wireName": "status"
              }
            },
            {
              "name": "owner_id",
              "sourceName": "owner_id",
              "required": false,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "owner_id"
              }
            }
          ]
        }
      },
      "responseContract": {
        "type": "api_response_contract",
        "shape": {
          "id": "shape_output_collection_detail",
          "name": "Collection Detail Output"
        },
        "fields": [
          {
            "name": "id",
            "sourceName": "id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "id"
            }
          },
          {
            "name": "name",
            "sourceName": "name",
            "required": true,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "name"
            }
          },
          {
            "name": "description",
            "sourceName": "description",
            "required": false,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "description"
            }
          },
          {
            "name": "status",
            "sourceName": "status",
            "required": true,
            "schema": {
              "type": "string",
              "enum": [
                "active",
                "archived"
              ],
              "default": "active"
            },
            "transport": {
              "location": "body",
              "wireName": "status"
            }
          },
          {
            "name": "owner_id",
            "sourceName": "owner_id",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "owner_id"
            }
          },
          {
            "name": "created_at",
            "sourceName": "created_at",
            "required": true,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "created_at"
            }
          }
        ],
        "required": [
          "id",
          "name",
          "status",
          "created_at"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_output_collection_detail",
          "title": "Collection Detail Output",
          "description": "Detailed collection payload",
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid"
            },
            "name": {
              "type": "string"
            },
            "description": {
              "type": "string"
            },
            "status": {
              "type": "string",
              "enum": [
                "active",
                "archived"
              ],
              "default": "active"
            },
            "owner_id": {
              "type": "string",
              "format": "uuid"
            },
            "created_at": {
              "type": "string",
              "format": "date-time"
            }
          },
          "additionalProperties": false,
          "required": [
            "id",
            "name",
            "status",
            "created_at"
          ]
        },
        "mode": "item",
        "collection": false,
        "itemJsonSchema": null,
        "pagination": null,
        "transport": {
          "path": [],
          "query": [],
          "header": [],
          "body": [
            {
              "name": "id",
              "sourceName": "id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "id"
              }
            },
            {
              "name": "name",
              "sourceName": "name",
              "required": true,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "name"
              }
            },
            {
              "name": "description",
              "sourceName": "description",
              "required": false,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "description"
              }
            },
            {
              "name": "status",
              "sourceName": "status",
              "required": true,
              "schema": {
                "type": "string",
                "enum": [
                  "active",
                  "archived"
                ],
                "default": "active"
              },
              "transport": {
                "location": "body",
                "wireName": "status"
              }
            },
            {
              "name": "owner_id",
              "sourceName": "owner_id",
              "required": false,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "owner_id"
              }
            },
            {
              "name": "created_at",
              "sourceName": "created_at",
              "required": true,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "created_at"
              }
            }
          ]
        }
      },
      "errors": [
        {
          "type": "api_error_case",
          "code": "cap_create_collection_invalid_request",
          "status": 400,
          "source": "request_contract"
        }
      ],
      "endpoint": {
        "auth": "user",
        "authz": [
          {
            "role": null,
            "permission": "collections.create",
            "claim": null,
            "claimValue": null,
            "ownership": null,
            "ownershipField": null
          }
        ],
        "preconditions": [],
        "idempotency": [],
        "cache": [],
        "asyncJobs": [],
        "asyncStatus": [],
        "download": []
      }
    },
    {
      "capabilityId": "cap_update_collection",
      "handlerName": "handleUpdateCollection",
      "repositoryMethod": "updateCollection",
      "method": "PATCH",
      "path": "/collections/:id",
      "successStatus": 200,
      "requestContract": {
        "type": "api_request_contract",
        "shape": {
          "id": "shape_input_update_collection",
          "name": "Update Collection Input"
        },
        "fields": [
          {
            "name": "collection_id",
            "sourceName": "collection_id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "path",
              "wireName": "id"
            }
          },
          {
            "name": "name",
            "sourceName": "name",
            "required": false,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "name"
            }
          },
          {
            "name": "description",
            "sourceName": "description",
            "required": false,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "description"
            }
          },
          {
            "name": "status",
            "sourceName": "status",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "active",
                "archived"
              ]
            },
            "transport": {
              "location": "body",
              "wireName": "status"
            }
          },
          {
            "name": "owner_id",
            "sourceName": "owner_id",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "owner_id"
            }
          }
        ],
        "required": [
          "collection_id"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_input_update_collection",
          "title": "Update Collection Input",
          "description": "Input for updating a collection",
          "type": "object",
          "properties": {
            "collection_id": {
              "type": "string",
              "format": "uuid"
            },
            "name": {
              "type": "string"
            },
            "description": {
              "type": "string"
            },
            "status": {
              "type": "string",
              "enum": [
                "active",
                "archived"
              ]
            },
            "owner_id": {
              "type": "string",
              "format": "uuid"
            }
          },
          "additionalProperties": false,
          "required": [
            "collection_id"
          ]
        },
        "transport": {
          "path": [
            {
              "name": "collection_id",
              "sourceName": "collection_id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "path",
                "wireName": "id"
              }
            }
          ],
          "query": [],
          "header": [],
          "body": [
            {
              "name": "name",
              "sourceName": "name",
              "required": false,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "name"
              }
            },
            {
              "name": "description",
              "sourceName": "description",
              "required": false,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "description"
              }
            },
            {
              "name": "status",
              "sourceName": "status",
              "required": false,
              "schema": {
                "type": "string",
                "enum": [
                  "active",
                  "archived"
                ]
              },
              "transport": {
                "location": "body",
                "wireName": "status"
              }
            },
            {
              "name": "owner_id",
              "sourceName": "owner_id",
              "required": false,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "owner_id"
              }
            }
          ]
        }
      },
      "responseContract": {
        "type": "api_response_contract",
        "shape": {
          "id": "shape_output_collection_detail",
          "name": "Collection Detail Output"
        },
        "fields": [
          {
            "name": "id",
            "sourceName": "id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "id"
            }
          },
          {
            "name": "name",
            "sourceName": "name",
            "required": true,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "name"
            }
          },
          {
            "name": "description",
            "sourceName": "description",
            "required": false,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "description"
            }
          },
          {
            "name": "status",
            "sourceName": "status",
            "required": true,
            "schema": {
              "type": "string",
              "enum": [
                "active",
                "archived"
              ],
              "default": "active"
            },
            "transport": {
              "location": "body",
              "wireName": "status"
            }
          },
          {
            "name": "owner_id",
            "sourceName": "owner_id",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "owner_id"
            }
          },
          {
            "name": "created_at",
            "sourceName": "created_at",
            "required": true,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "created_at"
            }
          }
        ],
        "required": [
          "id",
          "name",
          "status",
          "created_at"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_output_collection_detail",
          "title": "Collection Detail Output",
          "description": "Detailed collection payload",
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid"
            },
            "name": {
              "type": "string"
            },
            "description": {
              "type": "string"
            },
            "status": {
              "type": "string",
              "enum": [
                "active",
                "archived"
              ],
              "default": "active"
            },
            "owner_id": {
              "type": "string",
              "format": "uuid"
            },
            "created_at": {
              "type": "string",
              "format": "date-time"
            }
          },
          "additionalProperties": false,
          "required": [
            "id",
            "name",
            "status",
            "created_at"
          ]
        },
        "mode": "item",
        "collection": false,
        "itemJsonSchema": null,
        "pagination": null,
        "transport": {
          "path": [],
          "query": [],
          "header": [],
          "body": [
            {
              "name": "id",
              "sourceName": "id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "id"
              }
            },
            {
              "name": "name",
              "sourceName": "name",
              "required": true,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "name"
              }
            },
            {
              "name": "description",
              "sourceName": "description",
              "required": false,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "description"
              }
            },
            {
              "name": "status",
              "sourceName": "status",
              "required": true,
              "schema": {
                "type": "string",
                "enum": [
                  "active",
                  "archived"
                ],
                "default": "active"
              },
              "transport": {
                "location": "body",
                "wireName": "status"
              }
            },
            {
              "name": "owner_id",
              "sourceName": "owner_id",
              "required": false,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "owner_id"
              }
            },
            {
              "name": "created_at",
              "sourceName": "created_at",
              "required": true,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "created_at"
              }
            }
          ]
        }
      },
      "errors": [
        {
          "type": "api_error_case",
          "code": "cap_update_collection_invalid_request",
          "status": 400,
          "source": "request_contract"
        },
        {
          "type": "api_error_case",
          "code": "cap_get_collection_not_found",
          "status": 404,
          "source": "projection_mapping"
        }
      ],
      "endpoint": {
        "auth": "user",
        "authz": [
          {
            "role": null,
            "permission": "collections.update",
            "claim": null,
            "claimValue": null,
            "ownership": null,
            "ownershipField": null
          }
        ],
        "preconditions": [],
        "idempotency": [],
        "cache": [],
        "asyncJobs": [],
        "asyncStatus": [],
        "download": []
      }
    },
    {
      "capabilityId": "cap_list_members",
      "handlerName": "handleListMembers",
      "repositoryMethod": "listMembers",
      "method": "GET",
      "path": "/members",
      "successStatus": 200,
      "requestContract": {
        "type": "api_request_contract",
        "shape": {
          "id": "shape_input_list_members",
          "name": "List Members Input"
        },
        "fields": [
          {
            "name": "after",
            "sourceName": "after",
            "required": false,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "query",
              "wireName": "after"
            }
          },
          {
            "name": "limit",
            "sourceName": "limit",
            "required": false,
            "schema": {
              "type": "integer",
              "default": 25
            },
            "transport": {
              "location": "query",
              "wireName": "limit"
            }
          }
        ],
        "required": [],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_input_list_members",
          "title": "List Members Input",
          "description": "Input for listing members",
          "type": "object",
          "properties": {
            "after": {
              "type": "string"
            },
            "limit": {
              "type": "integer",
              "default": 25
            }
          },
          "additionalProperties": false
        },
        "transport": {
          "path": [],
          "query": [
            {
              "name": "after",
              "sourceName": "after",
              "required": false,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "query",
                "wireName": "after"
              }
            },
            {
              "name": "limit",
              "sourceName": "limit",
              "required": false,
              "schema": {
                "type": "integer",
                "default": 25
              },
              "transport": {
                "location": "query",
                "wireName": "limit"
              }
            }
          ],
          "header": [],
          "body": []
        }
      },
      "responseContract": {
        "type": "api_response_contract",
        "shape": {
          "id": "shape_output_member_detail",
          "name": "Member Detail Output"
        },
        "fields": [
          {
            "name": "id",
            "sourceName": "id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "id"
            }
          },
          {
            "name": "email",
            "sourceName": "email",
            "required": true,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "email"
            }
          },
          {
            "name": "display_name",
            "sourceName": "display_name",
            "required": true,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "display_name"
            }
          },
          {
            "name": "is_active",
            "sourceName": "is_active",
            "required": true,
            "schema": {
              "type": "boolean",
              "default": true
            },
            "transport": {
              "location": "body",
              "wireName": "is_active"
            }
          },
          {
            "name": "created_at",
            "sourceName": "created_at",
            "required": true,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "created_at"
            }
          }
        ],
        "required": [
          "id",
          "email",
          "display_name",
          "is_active",
          "created_at"
        ],
        "jsonSchema": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "items",
            "next_cursor"
          ],
          "properties": {
            "items": {
              "type": "array",
              "items": {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "$id": "topogram:shape:shape_output_member_detail",
                "title": "Member Detail Output",
                "description": "Detailed member payload",
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "format": "uuid"
                  },
                  "email": {
                    "type": "string"
                  },
                  "display_name": {
                    "type": "string"
                  },
                  "is_active": {
                    "type": "boolean",
                    "default": true
                  },
                  "created_at": {
                    "type": "string",
                    "format": "date-time"
                  }
                },
                "additionalProperties": false,
                "required": [
                  "id",
                  "email",
                  "display_name",
                  "is_active",
                  "created_at"
                ]
              }
            },
            "next_cursor": {
              "type": "string"
            }
          }
        },
        "mode": "cursor",
        "collection": true,
        "itemJsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_output_member_detail",
          "title": "Member Detail Output",
          "description": "Detailed member payload",
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid"
            },
            "email": {
              "type": "string"
            },
            "display_name": {
              "type": "string"
            },
            "is_active": {
              "type": "boolean",
              "default": true
            },
            "created_at": {
              "type": "string",
              "format": "date-time"
            }
          },
          "additionalProperties": false,
          "required": [
            "id",
            "email",
            "display_name",
            "is_active",
            "created_at"
          ]
        },
        "pagination": null,
        "itemShape": {
          "id": "shape_output_member_detail",
          "name": "Member Detail Output"
        },
        "ordering": {
          "field": "created_at",
          "direction": "desc"
        },
        "cursor": {
          "requestAfter": "after",
          "responseNext": "next_cursor",
          "responsePrev": null
        },
        "limit": {
          "field": "limit",
          "defaultValue": 25,
          "maxValue": 100
        },
        "total": {
          "included": false
        },
        "transport": {
          "path": [],
          "query": [],
          "header": [],
          "body": [
            {
              "name": "id",
              "sourceName": "id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "id"
              }
            },
            {
              "name": "email",
              "sourceName": "email",
              "required": true,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "email"
              }
            },
            {
              "name": "display_name",
              "sourceName": "display_name",
              "required": true,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "display_name"
              }
            },
            {
              "name": "is_active",
              "sourceName": "is_active",
              "required": true,
              "schema": {
                "type": "boolean",
                "default": true
              },
              "transport": {
                "location": "body",
                "wireName": "is_active"
              }
            },
            {
              "name": "created_at",
              "sourceName": "created_at",
              "required": true,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "created_at"
              }
            }
          ]
        }
      },
      "errors": [
        {
          "type": "api_error_case",
          "code": "cap_list_members_invalid_request",
          "status": 400,
          "source": "request_contract"
        },
        {
          "type": "api_error_case",
          "code": "cap_list_members_invalid_cursor",
          "status": 400,
          "source": "cursor_contract"
        },
        {
          "type": "api_error_case",
          "code": "cap_list_members_invalid_limit",
          "status": 400,
          "source": "cursor_contract"
        }
      ],
      "endpoint": {
        "auth": "user",
        "authz": [
          {
            "role": null,
            "permission": "members.read",
            "claim": null,
            "claimValue": null,
            "ownership": null,
            "ownershipField": null
          }
        ],
        "preconditions": [],
        "idempotency": [],
        "cache": [],
        "asyncJobs": [],
        "asyncStatus": [],
        "download": []
      }
    },
    {
      "capabilityId": "cap_get_member",
      "handlerName": "handleGetMember",
      "repositoryMethod": "getMember",
      "method": "GET",
      "path": "/members/:id",
      "successStatus": 200,
      "requestContract": {
        "type": "api_request_contract",
        "shape": {
          "id": "shape_input_get_member",
          "name": "Get Member Input"
        },
        "fields": [
          {
            "name": "member_id",
            "sourceName": "member_id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "path",
              "wireName": "id"
            }
          }
        ],
        "required": [
          "member_id"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_input_get_member",
          "title": "Get Member Input",
          "description": "Input for fetching a single member",
          "type": "object",
          "properties": {
            "member_id": {
              "type": "string",
              "format": "uuid"
            }
          },
          "additionalProperties": false,
          "required": [
            "member_id"
          ]
        },
        "transport": {
          "path": [
            {
              "name": "member_id",
              "sourceName": "member_id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "path",
                "wireName": "id"
              }
            }
          ],
          "query": [],
          "header": [],
          "body": []
        }
      },
      "responseContract": {
        "type": "api_response_contract",
        "shape": {
          "id": "shape_output_member_detail",
          "name": "Member Detail Output"
        },
        "fields": [
          {
            "name": "id",
            "sourceName": "id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "id"
            }
          },
          {
            "name": "email",
            "sourceName": "email",
            "required": true,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "email"
            }
          },
          {
            "name": "display_name",
            "sourceName": "display_name",
            "required": true,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "display_name"
            }
          },
          {
            "name": "is_active",
            "sourceName": "is_active",
            "required": true,
            "schema": {
              "type": "boolean",
              "default": true
            },
            "transport": {
              "location": "body",
              "wireName": "is_active"
            }
          },
          {
            "name": "created_at",
            "sourceName": "created_at",
            "required": true,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "created_at"
            }
          }
        ],
        "required": [
          "id",
          "email",
          "display_name",
          "is_active",
          "created_at"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_output_member_detail",
          "title": "Member Detail Output",
          "description": "Detailed member payload",
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid"
            },
            "email": {
              "type": "string"
            },
            "display_name": {
              "type": "string"
            },
            "is_active": {
              "type": "boolean",
              "default": true
            },
            "created_at": {
              "type": "string",
              "format": "date-time"
            }
          },
          "additionalProperties": false,
          "required": [
            "id",
            "email",
            "display_name",
            "is_active",
            "created_at"
          ]
        },
        "mode": "item",
        "collection": false,
        "itemJsonSchema": null,
        "pagination": null,
        "transport": {
          "path": [],
          "query": [],
          "header": [],
          "body": [
            {
              "name": "id",
              "sourceName": "id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "id"
              }
            },
            {
              "name": "email",
              "sourceName": "email",
              "required": true,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "email"
              }
            },
            {
              "name": "display_name",
              "sourceName": "display_name",
              "required": true,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "display_name"
              }
            },
            {
              "name": "is_active",
              "sourceName": "is_active",
              "required": true,
              "schema": {
                "type": "boolean",
                "default": true
              },
              "transport": {
                "location": "body",
                "wireName": "is_active"
              }
            },
            {
              "name": "created_at",
              "sourceName": "created_at",
              "required": true,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "created_at"
              }
            }
          ]
        }
      },
      "errors": [
        {
          "type": "api_error_case",
          "code": "cap_get_member_invalid_request",
          "status": 400,
          "source": "request_contract"
        },
        {
          "type": "api_error_case",
          "code": "cap_get_member_not_found",
          "status": 404,
          "source": "projection_mapping"
        }
      ],
      "endpoint": {
        "auth": "user",
        "authz": [
          {
            "role": null,
            "permission": "members.read",
            "claim": null,
            "claimValue": null,
            "ownership": null,
            "ownershipField": null
          }
        ],
        "preconditions": [],
        "idempotency": [],
        "cache": [],
        "asyncJobs": [],
        "asyncStatus": [],
        "download": []
      }
    },
    {
      "capabilityId": "cap_create_member",
      "handlerName": "handleCreateMember",
      "repositoryMethod": "createMember",
      "method": "POST",
      "path": "/members",
      "successStatus": 201,
      "requestContract": {
        "type": "api_request_contract",
        "shape": {
          "id": "shape_input_create_member",
          "name": "Create Member Input"
        },
        "fields": [
          {
            "name": "email",
            "sourceName": "email",
            "required": true,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "email"
            }
          },
          {
            "name": "display_name",
            "sourceName": "display_name",
            "required": true,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "display_name"
            }
          },
          {
            "name": "is_active",
            "sourceName": "is_active",
            "required": true,
            "schema": {
              "type": "boolean",
              "default": true
            },
            "transport": {
              "location": "body",
              "wireName": "is_active"
            }
          }
        ],
        "required": [
          "email",
          "display_name",
          "is_active"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_input_create_member",
          "title": "Create Member Input",
          "description": "Fields accepted when creating a member",
          "type": "object",
          "properties": {
            "email": {
              "type": "string"
            },
            "display_name": {
              "type": "string"
            },
            "is_active": {
              "type": "boolean",
              "default": true
            }
          },
          "additionalProperties": false,
          "required": [
            "email",
            "display_name",
            "is_active"
          ]
        },
        "transport": {
          "path": [],
          "query": [],
          "header": [],
          "body": [
            {
              "name": "email",
              "sourceName": "email",
              "required": true,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "email"
              }
            },
            {
              "name": "display_name",
              "sourceName": "display_name",
              "required": true,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "display_name"
              }
            },
            {
              "name": "is_active",
              "sourceName": "is_active",
              "required": true,
              "schema": {
                "type": "boolean",
                "default": true
              },
              "transport": {
                "location": "body",
                "wireName": "is_active"
              }
            }
          ]
        }
      },
      "responseContract": {
        "type": "api_response_contract",
        "shape": {
          "id": "shape_output_member_detail",
          "name": "Member Detail Output"
        },
        "fields": [
          {
            "name": "id",
            "sourceName": "id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "id"
            }
          },
          {
            "name": "email",
            "sourceName": "email",
            "required": true,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "email"
            }
          },
          {
            "name": "display_name",
            "sourceName": "display_name",
            "required": true,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "display_name"
            }
          },
          {
            "name": "is_active",
            "sourceName": "is_active",
            "required": true,
            "schema": {
              "type": "boolean",
              "default": true
            },
            "transport": {
              "location": "body",
              "wireName": "is_active"
            }
          },
          {
            "name": "created_at",
            "sourceName": "created_at",
            "required": true,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "created_at"
            }
          }
        ],
        "required": [
          "id",
          "email",
          "display_name",
          "is_active",
          "created_at"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_output_member_detail",
          "title": "Member Detail Output",
          "description": "Detailed member payload",
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid"
            },
            "email": {
              "type": "string"
            },
            "display_name": {
              "type": "string"
            },
            "is_active": {
              "type": "boolean",
              "default": true
            },
            "created_at": {
              "type": "string",
              "format": "date-time"
            }
          },
          "additionalProperties": false,
          "required": [
            "id",
            "email",
            "display_name",
            "is_active",
            "created_at"
          ]
        },
        "mode": "item",
        "collection": false,
        "itemJsonSchema": null,
        "pagination": null,
        "transport": {
          "path": [],
          "query": [],
          "header": [],
          "body": [
            {
              "name": "id",
              "sourceName": "id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "id"
              }
            },
            {
              "name": "email",
              "sourceName": "email",
              "required": true,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "email"
              }
            },
            {
              "name": "display_name",
              "sourceName": "display_name",
              "required": true,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "display_name"
              }
            },
            {
              "name": "is_active",
              "sourceName": "is_active",
              "required": true,
              "schema": {
                "type": "boolean",
                "default": true
              },
              "transport": {
                "location": "body",
                "wireName": "is_active"
              }
            },
            {
              "name": "created_at",
              "sourceName": "created_at",
              "required": true,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "created_at"
              }
            }
          ]
        }
      },
      "errors": [
        {
          "type": "api_error_case",
          "code": "cap_create_member_invalid_request",
          "status": 400,
          "source": "request_contract"
        }
      ],
      "endpoint": {
        "auth": "user",
        "authz": [
          {
            "role": null,
            "permission": "members.create",
            "claim": null,
            "claimValue": null,
            "ownership": null,
            "ownershipField": null
          }
        ],
        "preconditions": [],
        "idempotency": [],
        "cache": [],
        "asyncJobs": [],
        "asyncStatus": [],
        "download": []
      }
    },
    {
      "capabilityId": "cap_update_member",
      "handlerName": "handleUpdateMember",
      "repositoryMethod": "updateMember",
      "method": "PATCH",
      "path": "/members/:id",
      "successStatus": 200,
      "requestContract": {
        "type": "api_request_contract",
        "shape": {
          "id": "shape_input_update_member",
          "name": "Update Member Input"
        },
        "fields": [
          {
            "name": "member_id",
            "sourceName": "member_id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "path",
              "wireName": "id"
            }
          },
          {
            "name": "email",
            "sourceName": "email",
            "required": false,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "email"
            }
          },
          {
            "name": "display_name",
            "sourceName": "display_name",
            "required": false,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "display_name"
            }
          },
          {
            "name": "is_active",
            "sourceName": "is_active",
            "required": false,
            "schema": {
              "type": "boolean"
            },
            "transport": {
              "location": "body",
              "wireName": "is_active"
            }
          }
        ],
        "required": [
          "member_id"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_input_update_member",
          "title": "Update Member Input",
          "description": "Input for updating a member",
          "type": "object",
          "properties": {
            "member_id": {
              "type": "string",
              "format": "uuid"
            },
            "email": {
              "type": "string"
            },
            "display_name": {
              "type": "string"
            },
            "is_active": {
              "type": "boolean"
            }
          },
          "additionalProperties": false,
          "required": [
            "member_id"
          ]
        },
        "transport": {
          "path": [
            {
              "name": "member_id",
              "sourceName": "member_id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "path",
                "wireName": "id"
              }
            }
          ],
          "query": [],
          "header": [],
          "body": [
            {
              "name": "email",
              "sourceName": "email",
              "required": false,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "email"
              }
            },
            {
              "name": "display_name",
              "sourceName": "display_name",
              "required": false,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "display_name"
              }
            },
            {
              "name": "is_active",
              "sourceName": "is_active",
              "required": false,
              "schema": {
                "type": "boolean"
              },
              "transport": {
                "location": "body",
                "wireName": "is_active"
              }
            }
          ]
        }
      },
      "responseContract": {
        "type": "api_response_contract",
        "shape": {
          "id": "shape_output_member_detail",
          "name": "Member Detail Output"
        },
        "fields": [
          {
            "name": "id",
            "sourceName": "id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "id"
            }
          },
          {
            "name": "email",
            "sourceName": "email",
            "required": true,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "email"
            }
          },
          {
            "name": "display_name",
            "sourceName": "display_name",
            "required": true,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "display_name"
            }
          },
          {
            "name": "is_active",
            "sourceName": "is_active",
            "required": true,
            "schema": {
              "type": "boolean",
              "default": true
            },
            "transport": {
              "location": "body",
              "wireName": "is_active"
            }
          },
          {
            "name": "created_at",
            "sourceName": "created_at",
            "required": true,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "created_at"
            }
          }
        ],
        "required": [
          "id",
          "email",
          "display_name",
          "is_active",
          "created_at"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_output_member_detail",
          "title": "Member Detail Output",
          "description": "Detailed member payload",
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid"
            },
            "email": {
              "type": "string"
            },
            "display_name": {
              "type": "string"
            },
            "is_active": {
              "type": "boolean",
              "default": true
            },
            "created_at": {
              "type": "string",
              "format": "date-time"
            }
          },
          "additionalProperties": false,
          "required": [
            "id",
            "email",
            "display_name",
            "is_active",
            "created_at"
          ]
        },
        "mode": "item",
        "collection": false,
        "itemJsonSchema": null,
        "pagination": null,
        "transport": {
          "path": [],
          "query": [],
          "header": [],
          "body": [
            {
              "name": "id",
              "sourceName": "id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "id"
              }
            },
            {
              "name": "email",
              "sourceName": "email",
              "required": true,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "email"
              }
            },
            {
              "name": "display_name",
              "sourceName": "display_name",
              "required": true,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "display_name"
              }
            },
            {
              "name": "is_active",
              "sourceName": "is_active",
              "required": true,
              "schema": {
                "type": "boolean",
                "default": true
              },
              "transport": {
                "location": "body",
                "wireName": "is_active"
              }
            },
            {
              "name": "created_at",
              "sourceName": "created_at",
              "required": true,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "created_at"
              }
            }
          ]
        }
      },
      "errors": [
        {
          "type": "api_error_case",
          "code": "cap_update_member_invalid_request",
          "status": 400,
          "source": "request_contract"
        },
        {
          "type": "api_error_case",
          "code": "cap_get_member_not_found",
          "status": 404,
          "source": "projection_mapping"
        }
      ],
      "endpoint": {
        "auth": "user",
        "authz": [
          {
            "role": null,
            "permission": "members.update",
            "claim": null,
            "claimValue": null,
            "ownership": null,
            "ownershipField": null
          }
        ],
        "preconditions": [],
        "idempotency": [],
        "cache": [],
        "asyncJobs": [],
        "asyncStatus": [],
        "download": []
      }
    }
  ]
} as const;
