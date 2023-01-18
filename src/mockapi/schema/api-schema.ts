import { JSONSchemaType } from "ajv";
import { API } from "@aj/mockapi/mockapi.types";
import { EndpointSchema } from "@aj/mockapi/schema/endpoints";

export const APISchema: JSONSchemaType<API> = {
  type: "object",
  additionalProperties: {
    type: "object",
    properties: {
      baseUrl: {
        type: "string",
      },
      endpoints: EndpointSchema,
    },
    required: ["baseUrl", "endpoints"],
  },
  required: [],
};
