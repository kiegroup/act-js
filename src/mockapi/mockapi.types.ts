import { Endpoints } from "@kie/mock-github";
import { MockapiRequestMocker } from "@aj/mockapi/request/request-mocker";

export type API = {
  [apiName: string]: {
    baseUrl: string;
    endpoints: Endpoints;
  };
};

export type MockapiMethod = {
  [apiName: string]: {
    [scope: string]: {
      [methodName: string]: typeof MockapiRequestMocker.prototype.request;
    };
  };
};
