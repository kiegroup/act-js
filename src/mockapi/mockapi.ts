import { readFileSync } from "fs";
import Ajv from "ajv";
import { APISchema } from "@aj/mockapi/schema/api-schema";
import { API, MockapiMethod } from "@aj/mockapi/mockapi.types";
import { MockapiRequestMocker } from "@aj/mockapi/request/request-mocker";

export class Mockapi {
  private apiSchema: API;
  private _mock: MockapiMethod;

  constructor(apiSchema: string | API) {
    this.apiSchema = this.validateAPISchema(apiSchema);
    this._mock = this.apiSchemaToMethod();
  }

  /**
   * Returns the request mocker functions generated from api schema
   */
  get mock() {
    return this._mock;
  }

  /**
   * For each endpoint for each api it generates a request mocker function just like moctokit
   * @returns
   */
  private apiSchemaToMethod() {
    let methods: MockapiMethod = {};
    for (const apiName in this.apiSchema) {
      if (!methods[apiName]) {
        methods[apiName] = {};
      }
      for (const scope in this.apiSchema[apiName]["endpoints"]) {
        if (!methods[apiName][scope]) {
          methods[apiName][scope] = {};
        }
        for (const methodName in this.apiSchema[apiName]["endpoints"][scope]) {
          methods[apiName][scope][methodName] = new MockapiRequestMocker(
            this.apiSchema[apiName]["baseUrl"],
            this.apiSchema[apiName]["endpoints"][scope][methodName]
          ).request;
        }
      }
    }
    return methods;
  }

  private validateAPISchema(apiSchema: string | API) {
    const rawJSON =
      typeof apiSchema === "string"
        ? JSON.parse(readFileSync(apiSchema, "utf8"))
        : apiSchema;
    const ajv = new Ajv({ allowUnionTypes: true });
    const validate = ajv.compile(APISchema);
    if (validate(rawJSON)) {
      return rawJSON;
    } else {
      throw new Error(JSON.stringify(validate.errors));
    }
  }
}
