import { ResponseMocker } from "@kie/mock-github";
import nock from "nock/types";

export class MockapiResponseMocker extends ResponseMocker<nock.Body, number> {}
