export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

export type ParameterLocation = "path" | "query" | "header" | "cookie";

export type SchemaObject = {
  type?: string;
  format?: string;
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
  required?: string[];
  $ref?: string;
  oneOf?: SchemaObject[];
  anyOf?: SchemaObject[];
  allOf?: SchemaObject[];
};

export type MediaTypeObject = {
  schema?: SchemaObject;
};

export type RequestBodyObject = {
  content?: Record<string, MediaTypeObject>;
  required?: boolean;
};

export type ResponseObject = {
  content?: Record<string, MediaTypeObject>;
};

export type OperationObject = {
  operationId?: string;
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses?: Record<string, ResponseObject>;
  security?: Array<Record<string, string[]>>;
  tags?: string[];
  summary?: string;
};

export type ParameterObject = {
  name: string;
  in: ParameterLocation;
  required?: boolean;
  schema?: SchemaObject;
};

export type PathItemObject = Record<HttpMethod, OperationObject>;

export type OpenApiSpec = {
  openapi: string;
  info?: Record<string, unknown>;
  paths?: Record<string, PathItemObject>;
  components?: {
    schemas?: Record<string, SchemaObject>;
    securitySchemes?: Record<string, unknown>;
  };
};

export type FieldShape = {
  name: string;
  type: string;
  format?: string;
  entity?: string;
};

export type ParamShape = FieldShape & {
  location: ParameterLocation;
};

export type OperationShape = {
  id: string;
  method: HttpMethod;
  path: string;
  requestFields: FieldShape[];
  responseFields: FieldShape[];
  pathParams: ParamShape[];
  otherParams: ParamShape[];
  requiresAuth: boolean;
};

export type Dependency = {
  fromOperation: string;
  toOperation: string;
  field: string;
  type: string;
  kind: "body" | "path" | "query" | "header" | "cookie" | "auth";
  reason: "exact-name" | "entity-id" | "auth";
};
