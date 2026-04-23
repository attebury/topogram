export const serverContract = {
  "type": "server_contract_graph",
  "projection": {
    "id": "proj_api",
    "name": "API",
    "platform": "dotnet"
  },
  "routes": [
    {
      "capabilityId": "cap_create_issue",
      "handlerName": "handleCreateIssue",
      "repositoryMethod": "createIssue",
      "method": "POST",
      "path": "/issues",
      "successStatus": 201,
      "requestContract": {
        "type": "api_request_contract",
        "shape": {
          "id": "shape_input_create_issue",
          "name": "Create Issue Input"
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
            "name": "assignee_id",
            "sourceName": "assignee_id",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "assignee_id"
            }
          },
          {
            "name": "board_id",
            "sourceName": "board_id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "board_id"
            }
          },
          {
            "name": "priority",
            "sourceName": "priority",
            "required": false,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "priority"
            }
          }
        ],
        "required": [
          "title",
          "board_id"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_input_create_issue",
          "title": "Create Issue Input",
          "description": "Input for creating an issue",
          "type": "object",
          "properties": {
            "title": {
              "type": "string"
            },
            "description": {
              "type": "string"
            },
            "assignee_id": {
              "type": "string",
              "format": "uuid"
            },
            "board_id": {
              "type": "string",
              "format": "uuid"
            },
            "priority": {
              "type": "string"
            }
          },
          "additionalProperties": false,
          "required": [
            "title",
            "board_id"
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
              "name": "assignee_id",
              "sourceName": "assignee_id",
              "required": false,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "assignee_id"
              }
            },
            {
              "name": "board_id",
              "sourceName": "board_id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "board_id"
              }
            },
            {
              "name": "priority",
              "sourceName": "priority",
              "required": false,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "priority"
              }
            }
          ]
        }
      },
      "responseContract": {
        "type": "api_response_contract",
        "shape": {
          "id": "shape_output_issue_detail",
          "name": "Issue Detail Output"
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
                "open",
                "in_progress",
                "closed",
                "archived"
              ],
              "default": "open"
            },
            "transport": {
              "location": "body",
              "wireName": "status"
            }
          },
          {
            "name": "assignee_id",
            "sourceName": "assignee_id",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "assignee_id"
            }
          },
          {
            "name": "board_id",
            "sourceName": "board_id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "board_id"
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
            "name": "closed_at",
            "sourceName": "closed_at",
            "required": false,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "closed_at"
            }
          },
          {
            "name": "priority",
            "sourceName": "priority",
            "required": false,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "priority"
            }
          }
        ],
        "required": [
          "id",
          "title",
          "status",
          "board_id",
          "created_at",
          "updated_at"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_output_issue_detail",
          "title": "Issue Detail Output",
          "description": "Detailed issue payload",
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
                "open",
                "in_progress",
                "closed",
                "archived"
              ],
              "default": "open"
            },
            "assignee_id": {
              "type": "string",
              "format": "uuid"
            },
            "board_id": {
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
            "closed_at": {
              "type": "string",
              "format": "date-time"
            },
            "priority": {
              "type": "string"
            }
          },
          "additionalProperties": false,
          "required": [
            "id",
            "title",
            "status",
            "board_id",
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
                  "open",
                  "in_progress",
                  "closed",
                  "archived"
                ],
                "default": "open"
              },
              "transport": {
                "location": "body",
                "wireName": "status"
              }
            },
            {
              "name": "assignee_id",
              "sourceName": "assignee_id",
              "required": false,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "assignee_id"
              }
            },
            {
              "name": "board_id",
              "sourceName": "board_id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "board_id"
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
              "name": "closed_at",
              "sourceName": "closed_at",
              "required": false,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "closed_at"
              }
            },
            {
              "name": "priority",
              "sourceName": "priority",
              "required": false,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "priority"
              }
            }
          ]
        }
      },
      "errors": [
        {
          "type": "api_error_case",
          "code": "rule_no_issue_creation_in_archived_board",
          "status": 409,
          "source": "policy"
        },
        {
          "type": "api_error_case",
          "code": "rule_only_active_users_may_be_assigned_issues",
          "status": 400,
          "source": "policy"
        },
        {
          "type": "api_error_case",
          "code": "cap_create_issue_invalid_request",
          "status": 400,
          "source": "request_contract"
        },
        {
          "type": "api_error_case",
          "code": "cap_create_issue_idempotency_conflict",
          "status": 409,
          "source": "idempotency"
        }
      ],
      "endpoint": {
        "auth": "user",
        "authz": [
          {
            "role": null,
            "permission": "issues.create",
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
            "code": "cap_create_issue_idempotency_conflict"
          }
        ],
        "cache": [],
        "async": [],
        "status": [],
        "download": []
      }
    },
    {
      "capabilityId": "cap_get_issue",
      "handlerName": "handleGetIssue",
      "repositoryMethod": "getIssue",
      "method": "GET",
      "path": "/issues/:id",
      "successStatus": 200,
      "requestContract": {
        "type": "api_request_contract",
        "shape": {
          "id": "shape_input_get_issue",
          "name": "Get Issue Input"
        },
        "fields": [
          {
            "name": "issue_id",
            "sourceName": "issue_id",
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
          "issue_id"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_input_get_issue",
          "title": "Get Issue Input",
          "description": "Input for loading a single issue",
          "type": "object",
          "properties": {
            "issue_id": {
              "type": "string",
              "format": "uuid"
            }
          },
          "additionalProperties": false,
          "required": [
            "issue_id"
          ]
        },
        "transport": {
          "path": [
            {
              "name": "issue_id",
              "sourceName": "issue_id",
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
          "id": "shape_output_issue_detail",
          "name": "Issue Detail Output"
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
                "open",
                "in_progress",
                "closed",
                "archived"
              ],
              "default": "open"
            },
            "transport": {
              "location": "body",
              "wireName": "status"
            }
          },
          {
            "name": "assignee_id",
            "sourceName": "assignee_id",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "assignee_id"
            }
          },
          {
            "name": "board_id",
            "sourceName": "board_id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "board_id"
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
            "name": "closed_at",
            "sourceName": "closed_at",
            "required": false,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "closed_at"
            }
          },
          {
            "name": "priority",
            "sourceName": "priority",
            "required": false,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "priority"
            }
          }
        ],
        "required": [
          "id",
          "title",
          "status",
          "board_id",
          "created_at",
          "updated_at"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_output_issue_detail",
          "title": "Issue Detail Output",
          "description": "Detailed issue payload",
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
                "open",
                "in_progress",
                "closed",
                "archived"
              ],
              "default": "open"
            },
            "assignee_id": {
              "type": "string",
              "format": "uuid"
            },
            "board_id": {
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
            "closed_at": {
              "type": "string",
              "format": "date-time"
            },
            "priority": {
              "type": "string"
            }
          },
          "additionalProperties": false,
          "required": [
            "id",
            "title",
            "status",
            "board_id",
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
                  "open",
                  "in_progress",
                  "closed",
                  "archived"
                ],
                "default": "open"
              },
              "transport": {
                "location": "body",
                "wireName": "status"
              }
            },
            {
              "name": "assignee_id",
              "sourceName": "assignee_id",
              "required": false,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "assignee_id"
              }
            },
            {
              "name": "board_id",
              "sourceName": "board_id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "board_id"
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
              "name": "closed_at",
              "sourceName": "closed_at",
              "required": false,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "closed_at"
              }
            },
            {
              "name": "priority",
              "sourceName": "priority",
              "required": false,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "priority"
              }
            }
          ]
        }
      },
      "errors": [
        {
          "type": "api_error_case",
          "code": "cap_get_issue_invalid_request",
          "status": 400,
          "source": "request_contract"
        },
        {
          "type": "api_error_case",
          "code": "cap_get_issue_not_found",
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
            "ownershipField": "assignee_id"
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
            "code": "cap_get_issue_not_modified"
          }
        ],
        "async": [],
        "status": [],
        "download": []
      }
    },
    {
      "capabilityId": "cap_update_issue",
      "handlerName": "handleUpdateIssue",
      "repositoryMethod": "updateIssue",
      "method": "PATCH",
      "path": "/issues/:id",
      "successStatus": 200,
      "requestContract": {
        "type": "api_request_contract",
        "shape": {
          "id": "shape_input_update_issue",
          "name": "Update Issue Input"
        },
        "fields": [
          {
            "name": "issue_id",
            "sourceName": "issue_id",
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
            "name": "assignee_id",
            "sourceName": "assignee_id",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "assignee_id"
            }
          },
          {
            "name": "priority",
            "sourceName": "priority",
            "required": false,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "priority"
            }
          },
          {
            "name": "status",
            "sourceName": "status",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "open",
                "in_progress",
                "closed",
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
          "issue_id"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_input_update_issue",
          "title": "Update Issue Input",
          "description": "Input for updating an issue",
          "type": "object",
          "properties": {
            "issue_id": {
              "type": "string",
              "format": "uuid"
            },
            "title": {
              "type": "string"
            },
            "description": {
              "type": "string"
            },
            "assignee_id": {
              "type": "string",
              "format": "uuid"
            },
            "priority": {
              "type": "string"
            },
            "status": {
              "type": "string",
              "enum": [
                "open",
                "in_progress",
                "closed",
                "archived"
              ]
            }
          },
          "additionalProperties": false,
          "required": [
            "issue_id"
          ]
        },
        "transport": {
          "path": [
            {
              "name": "issue_id",
              "sourceName": "issue_id",
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
              "name": "assignee_id",
              "sourceName": "assignee_id",
              "required": false,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "assignee_id"
              }
            },
            {
              "name": "priority",
              "sourceName": "priority",
              "required": false,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "priority"
              }
            },
            {
              "name": "status",
              "sourceName": "status",
              "required": false,
              "schema": {
                "type": "string",
                "enum": [
                  "open",
                  "in_progress",
                  "closed",
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
          "id": "shape_output_issue_detail",
          "name": "Issue Detail Output"
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
                "open",
                "in_progress",
                "closed",
                "archived"
              ],
              "default": "open"
            },
            "transport": {
              "location": "body",
              "wireName": "status"
            }
          },
          {
            "name": "assignee_id",
            "sourceName": "assignee_id",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "assignee_id"
            }
          },
          {
            "name": "board_id",
            "sourceName": "board_id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "board_id"
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
            "name": "closed_at",
            "sourceName": "closed_at",
            "required": false,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "closed_at"
            }
          },
          {
            "name": "priority",
            "sourceName": "priority",
            "required": false,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "priority"
            }
          }
        ],
        "required": [
          "id",
          "title",
          "status",
          "board_id",
          "created_at",
          "updated_at"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_output_issue_detail",
          "title": "Issue Detail Output",
          "description": "Detailed issue payload",
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
                "open",
                "in_progress",
                "closed",
                "archived"
              ],
              "default": "open"
            },
            "assignee_id": {
              "type": "string",
              "format": "uuid"
            },
            "board_id": {
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
            "closed_at": {
              "type": "string",
              "format": "date-time"
            },
            "priority": {
              "type": "string"
            }
          },
          "additionalProperties": false,
          "required": [
            "id",
            "title",
            "status",
            "board_id",
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
                  "open",
                  "in_progress",
                  "closed",
                  "archived"
                ],
                "default": "open"
              },
              "transport": {
                "location": "body",
                "wireName": "status"
              }
            },
            {
              "name": "assignee_id",
              "sourceName": "assignee_id",
              "required": false,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "assignee_id"
              }
            },
            {
              "name": "board_id",
              "sourceName": "board_id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "board_id"
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
              "name": "closed_at",
              "sourceName": "closed_at",
              "required": false,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "closed_at"
              }
            },
            {
              "name": "priority",
              "sourceName": "priority",
              "required": false,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "priority"
              }
            }
          ]
        }
      },
      "errors": [
        {
          "type": "api_error_case",
          "code": "rule_only_active_users_may_be_assigned_issues",
          "status": 400,
          "source": "policy"
        },
        {
          "type": "api_error_case",
          "code": "cap_update_issue_invalid_request",
          "status": 400,
          "source": "request_contract"
        },
        {
          "type": "api_error_case",
          "code": "cap_update_issue_precondition_failed",
          "status": 412,
          "source": "precondition"
        }
      ],
      "endpoint": {
        "auth": "user",
        "authz": [
          {
            "role": null,
            "permission": "issues.update",
            "claim": null,
            "claimValue": null,
            "ownership": "owner_or_admin",
            "ownershipField": "assignee_id"
          }
        ],
        "preconditions": [
          {
            "header": "If-Match",
            "required": true,
            "error": 412,
            "source": "updated_at",
            "code": "cap_update_issue_precondition_failed"
          }
        ],
        "idempotency": [],
        "cache": [],
        "async": [],
        "status": [],
        "download": []
      }
    },
    {
      "capabilityId": "cap_close_issue",
      "handlerName": "handleCloseIssue",
      "repositoryMethod": "closeIssue",
      "method": "POST",
      "path": "/issues/:id/close",
      "successStatus": 200,
      "requestContract": {
        "type": "api_request_contract",
        "shape": {
          "id": "shape_input_close_issue",
          "name": "Close Issue Input"
        },
        "fields": [
          {
            "name": "issue_id",
            "sourceName": "issue_id",
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
            "name": "closed_at",
            "sourceName": "closed_at",
            "required": false,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "closed_at"
            }
          }
        ],
        "required": [
          "issue_id"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_input_close_issue",
          "title": "Close Issue Input",
          "description": "Input for closing an issue",
          "type": "object",
          "properties": {
            "issue_id": {
              "type": "string",
              "format": "uuid"
            },
            "closed_at": {
              "type": "string",
              "format": "date-time"
            }
          },
          "additionalProperties": false,
          "required": [
            "issue_id"
          ]
        },
        "transport": {
          "path": [
            {
              "name": "issue_id",
              "sourceName": "issue_id",
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
              "name": "closed_at",
              "sourceName": "closed_at",
              "required": false,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "closed_at"
              }
            }
          ]
        }
      },
      "responseContract": {
        "type": "api_response_contract",
        "shape": {
          "id": "shape_output_issue_detail",
          "name": "Issue Detail Output"
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
                "open",
                "in_progress",
                "closed",
                "archived"
              ],
              "default": "open"
            },
            "transport": {
              "location": "body",
              "wireName": "status"
            }
          },
          {
            "name": "assignee_id",
            "sourceName": "assignee_id",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "assignee_id"
            }
          },
          {
            "name": "board_id",
            "sourceName": "board_id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "board_id"
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
            "name": "closed_at",
            "sourceName": "closed_at",
            "required": false,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "closed_at"
            }
          },
          {
            "name": "priority",
            "sourceName": "priority",
            "required": false,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "priority"
            }
          }
        ],
        "required": [
          "id",
          "title",
          "status",
          "board_id",
          "created_at",
          "updated_at"
        ],
        "jsonSchema": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "$id": "topogram:shape:shape_output_issue_detail",
          "title": "Issue Detail Output",
          "description": "Detailed issue payload",
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
                "open",
                "in_progress",
                "closed",
                "archived"
              ],
              "default": "open"
            },
            "assignee_id": {
              "type": "string",
              "format": "uuid"
            },
            "board_id": {
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
            "closed_at": {
              "type": "string",
              "format": "date-time"
            },
            "priority": {
              "type": "string"
            }
          },
          "additionalProperties": false,
          "required": [
            "id",
            "title",
            "status",
            "board_id",
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
                  "open",
                  "in_progress",
                  "closed",
                  "archived"
                ],
                "default": "open"
              },
              "transport": {
                "location": "body",
                "wireName": "status"
              }
            },
            {
              "name": "assignee_id",
              "sourceName": "assignee_id",
              "required": false,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "assignee_id"
              }
            },
            {
              "name": "board_id",
              "sourceName": "board_id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "board_id"
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
              "name": "closed_at",
              "sourceName": "closed_at",
              "required": false,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "closed_at"
              }
            },
            {
              "name": "priority",
              "sourceName": "priority",
              "required": false,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "priority"
              }
            }
          ]
        }
      },
      "errors": [
        {
          "type": "api_error_case",
          "code": "cap_close_issue_invalid_request",
          "status": 400,
          "source": "request_contract"
        },
        {
          "type": "api_error_case",
          "code": "cap_close_issue_precondition_failed",
          "status": 412,
          "source": "precondition"
        },
        {
          "type": "api_error_case",
          "code": "cap_close_issue_idempotency_conflict",
          "status": 409,
          "source": "idempotency"
        }
      ],
      "endpoint": {
        "auth": "user",
        "authz": [
          {
            "role": null,
            "permission": "issues.close",
            "claim": null,
            "claimValue": null,
            "ownership": "owner_or_admin",
            "ownershipField": "assignee_id"
          }
        ],
        "preconditions": [
          {
            "header": "If-Match",
            "required": true,
            "error": 412,
            "source": "updated_at",
            "code": "cap_close_issue_precondition_failed"
          }
        ],
        "idempotency": [
          {
            "header": "Idempotency-Key",
            "required": true,
            "error": 409,
            "code": "cap_close_issue_idempotency_conflict"
          }
        ],
        "cache": [],
        "async": [],
        "status": [],
        "download": []
      }
    },
    {
      "capabilityId": "cap_list_issues",
      "handlerName": "handleListIssues",
      "repositoryMethod": "listIssues",
      "method": "GET",
      "path": "/issues",
      "successStatus": 200,
      "requestContract": {
        "type": "api_request_contract",
        "shape": {
          "id": "shape_input_list_issues",
          "name": "List Issues Input"
        },
        "fields": [
          {
            "name": "board_id",
            "sourceName": "board_id",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "query",
              "wireName": "board_id"
            }
          },
          {
            "name": "assignee_id",
            "sourceName": "assignee_id",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "query",
              "wireName": "assignee_id"
            }
          },
          {
            "name": "status",
            "sourceName": "status",
            "required": false,
            "schema": {
              "type": "string",
              "enum": [
                "open",
                "in_progress",
                "closed",
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
          "$id": "topogram:shape:shape_input_list_issues",
          "title": "List Issues Input",
          "description": "Input for listing issues",
          "type": "object",
          "properties": {
            "board_id": {
              "type": "string",
              "format": "uuid"
            },
            "assignee_id": {
              "type": "string",
              "format": "uuid"
            },
            "status": {
              "type": "string",
              "enum": [
                "open",
                "in_progress",
                "closed",
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
              "name": "board_id",
              "sourceName": "board_id",
              "required": false,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "query",
                "wireName": "board_id"
              }
            },
            {
              "name": "assignee_id",
              "sourceName": "assignee_id",
              "required": false,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "query",
                "wireName": "assignee_id"
              }
            },
            {
              "name": "status",
              "sourceName": "status",
              "required": false,
              "schema": {
                "type": "string",
                "enum": [
                  "open",
                  "in_progress",
                  "closed",
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
          "id": "shape_output_issue_detail",
          "name": "Issue Detail Output"
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
                "open",
                "in_progress",
                "closed",
                "archived"
              ],
              "default": "open"
            },
            "transport": {
              "location": "body",
              "wireName": "status"
            }
          },
          {
            "name": "assignee_id",
            "sourceName": "assignee_id",
            "required": false,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "assignee_id"
            }
          },
          {
            "name": "board_id",
            "sourceName": "board_id",
            "required": true,
            "schema": {
              "type": "string",
              "format": "uuid"
            },
            "transport": {
              "location": "body",
              "wireName": "board_id"
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
            "name": "closed_at",
            "sourceName": "closed_at",
            "required": false,
            "schema": {
              "type": "string",
              "format": "date-time"
            },
            "transport": {
              "location": "body",
              "wireName": "closed_at"
            }
          },
          {
            "name": "priority",
            "sourceName": "priority",
            "required": false,
            "schema": {
              "type": "string"
            },
            "transport": {
              "location": "body",
              "wireName": "priority"
            }
          }
        ],
        "required": [
          "id",
          "title",
          "status",
          "board_id",
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
                "$id": "topogram:shape:shape_output_issue_detail",
                "title": "Issue Detail Output",
                "description": "Detailed issue payload",
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
                      "open",
                      "in_progress",
                      "closed",
                      "archived"
                    ],
                    "default": "open"
                  },
                  "assignee_id": {
                    "type": "string",
                    "format": "uuid"
                  },
                  "board_id": {
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
                  "closed_at": {
                    "type": "string",
                    "format": "date-time"
                  },
                  "priority": {
                    "type": "string"
                  }
                },
                "additionalProperties": false,
                "required": [
                  "id",
                  "title",
                  "status",
                  "board_id",
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
          "$id": "topogram:shape:shape_output_issue_detail",
          "title": "Issue Detail Output",
          "description": "Detailed issue payload",
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
                "open",
                "in_progress",
                "closed",
                "archived"
              ],
              "default": "open"
            },
            "assignee_id": {
              "type": "string",
              "format": "uuid"
            },
            "board_id": {
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
            "closed_at": {
              "type": "string",
              "format": "date-time"
            },
            "priority": {
              "type": "string"
            }
          },
          "additionalProperties": false,
          "required": [
            "id",
            "title",
            "status",
            "board_id",
            "created_at",
            "updated_at"
          ]
        },
        "pagination": null,
        "itemShape": {
          "id": "shape_output_issue_detail",
          "name": "Issue Detail Output"
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
                  "open",
                  "in_progress",
                  "closed",
                  "archived"
                ],
                "default": "open"
              },
              "transport": {
                "location": "body",
                "wireName": "status"
              }
            },
            {
              "name": "assignee_id",
              "sourceName": "assignee_id",
              "required": false,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "assignee_id"
              }
            },
            {
              "name": "board_id",
              "sourceName": "board_id",
              "required": true,
              "schema": {
                "type": "string",
                "format": "uuid"
              },
              "transport": {
                "location": "body",
                "wireName": "board_id"
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
              "name": "closed_at",
              "sourceName": "closed_at",
              "required": false,
              "schema": {
                "type": "string",
                "format": "date-time"
              },
              "transport": {
                "location": "body",
                "wireName": "closed_at"
              }
            },
            {
              "name": "priority",
              "sourceName": "priority",
              "required": false,
              "schema": {
                "type": "string"
              },
              "transport": {
                "location": "body",
                "wireName": "priority"
              }
            }
          ]
        }
      },
      "errors": [
        {
          "type": "api_error_case",
          "code": "cap_list_issues_invalid_request",
          "status": 400,
          "source": "request_contract"
        },
        {
          "type": "api_error_case",
          "code": "cap_list_issues_invalid_cursor",
          "status": 400,
          "source": "cursor_contract"
        },
        {
          "type": "api_error_case",
          "code": "cap_list_issues_invalid_limit",
          "status": 400,
          "source": "cursor_contract"
        }
      ],
      "endpoint": {
        "auth": "user",
        "authz": [
          {
            "role": null,
            "permission": "issues.read",
            "claim": null,
            "claimValue": null,
            "ownership": null,
            "ownershipField": null
          }
        ],
        "preconditions": [],
        "idempotency": [],
        "cache": [],
        "async": [],
        "status": [],
        "download": []
      }
    }
  ]
} as const;
