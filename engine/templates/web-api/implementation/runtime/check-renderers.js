export function renderHelloRuntimeCheckState() {
  return `const state = {
  createdPrimary: null,
  latestPrimary: null
};`;
}

export function renderHelloRuntimeCheckCreatePayload() {
  return `function createPayload(overrides = {}) {
  return {
    message: "Hello from the runtime check",
    ...overrides
  };
}`;
}

export function renderHelloRuntimeCheckHelpers() {
  return "";
}

export function renderHelloRuntimeCheckCases() {
  return `    } else if (definition.id === "api_seed_greeting_ready") {
      const { contract, response, responseBody } = await requestContract(definition.capabilityId, {
        pathParams: inferPathParams(contractFor(definition.capabilityId), definition.pathParams)
      });
      assertCondition(response.status === contract.endpoint.successStatus, \`seed greeting readiness expected \${contract.endpoint.successStatus}, got \${response.status}\`);
      assertCondition(responseBody?.id === envValue(plan.env.demoPrimaryId), "seed greeting readiness did not return the expected demo greeting");
    } else if (definition.id === "create_greeting") {
      const { contract, response, responseBody } = await requestContract(definition.capabilityId, {
        payload: createPayload()
      });
      assertCondition(response.status === contract.endpoint.successStatus, \`create greeting expected \${contract.endpoint.successStatus}, got \${response.status}\`);
      assertCondition(responseBody?.id, "create greeting response did not include id");
      assertCondition(responseBody?.message === "Hello from the runtime check", "create greeting did not persist message");
      state.createdPrimary = responseBody;
      state.latestPrimary = responseBody;
      result.resources.primaryId = responseBody.id;
    } else if (definition.id === "get_created_greeting") {
      const { contract, response, responseBody } = await requestContract(definition.capabilityId);
      assertCondition(response.status === contract.endpoint.successStatus, \`get greeting expected \${contract.endpoint.successStatus}, got \${response.status}\`);
      assertCondition(responseBody?.id === state.latestPrimary?.id, "get greeting did not return the created greeting");
      assertCondition(responseBody?.message, "get greeting did not include message");
    } else if (definition.id === "list_greetings") {
      const { contract, response, responseBody } = await requestContract(definition.capabilityId);
      assertCondition(response.status === contract.endpoint.successStatus, \`list greetings expected \${contract.endpoint.successStatus}, got \${response.status}\`);
      assertCondition(Array.isArray(responseBody?.items), "list greetings did not return an items array");
      assertCondition(responseBody.items.some((item) => item.id === state.latestPrimary?.id), "list greetings did not include the created greeting");
    } else if (definition.id === "update_greeting") {
      const { contract, response, responseBody } = await requestContract(definition.capabilityId, {
        payload: {
          message: "Hello from the updated runtime check"
        }
      });
      assertCondition(response.status === contract.endpoint.successStatus, \`update greeting expected \${contract.endpoint.successStatus}, got \${response.status}\`);
      assertCondition(responseBody?.message === "Hello from the updated runtime check", "update greeting did not persist message");
      state.latestPrimary = responseBody;
      result.resources.primaryId = responseBody.id;
    } else if (definition.id === "invalid_create_returns_4xx") {
      const { response, responseBody } = await requestContract(definition.capabilityId, {
        payload: {}
      });
      assertCondition(Math.floor(response.status / 100) === definition.expectStatusClass, \`invalid create expected \${definition.expectStatusClass}xx, got \${response.status}\`);
      assertErrorResponse(responseBody, definition.expectErrorCode, "invalid create");
    } else if (definition.id === "get_unknown_greeting_not_found") {
      const { response, responseBody } = await requestContract(definition.capabilityId, {
        pathParams: {
          id: crypto.randomUUID()
        }
      });
      assertCondition(response.status === definition.expectStatus, \`get unknown greeting expected \${definition.expectStatus}, got \${response.status}\`);
      assertErrorResponse(responseBody, definition.expectErrorCode, "get unknown greeting");`;
}
