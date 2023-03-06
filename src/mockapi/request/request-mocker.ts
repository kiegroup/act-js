import { EndpointDetails, RequestMocker } from "@kie/mock-github";
import { MockapiResponseMocker } from "@aj/mockapi/response/response-mocker";

export class MockapiRequestMocker extends RequestMocker {
  constructor(baseUrl: string, endpointDetails: EndpointDetails, allowUnmocked = false) {
    super(baseUrl, endpointDetails, allowUnmocked);

    // need to bind the instance context to the function. otherwise it is lost during method generation
    this.request = this.request.bind(this);
  }
  request(params?: Record<string, unknown>): MockapiResponseMocker {
    const { path, query, requestBody } = this.parseParams(params);
    return new MockapiResponseMocker(
      this.baseUrl,
      path,
      this.endpointDetails.method,
      query,
      requestBody,
      this.allowUnmocked
    );
  }
}
