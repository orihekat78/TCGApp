import {
  handleCloudDataRequest,
  type CloudDataApiEnv,
} from "../../../src/cloud-data/api";

type PagesFunctionContext = {
  request: Request;
  env: CloudDataApiEnv;
};

export function onRequest(context: PagesFunctionContext): Promise<Response> {
  return handleCloudDataRequest(context.request, context.env);
}
