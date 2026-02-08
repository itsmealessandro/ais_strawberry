// Shared type definitions for the StrawBerry-REST pipeline.
export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

// Supported parameter locations in OpenAPI.
export type ParameterLocation = "path" | "query" | "header" | "cookie";

// Subset of OpenAPI schema objects used by the prototype.
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

// Represents a media type schema wrapper in OpenAPI.
export type MediaTypeObject = {
  schema?: SchemaObject;
};

// Request body definition in OpenAPI operations.
export type RequestBodyObject = {
  content?: Record<string, MediaTypeObject>;
  required?: boolean;
};

// Response definition in OpenAPI operations.
export type ResponseObject = {
  content?: Record<string, MediaTypeObject>;
};

// Minimal operation object shape used for extraction.
export type OperationObject = {
  operationId?: string;
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses?: Record<string, ResponseObject>;
  security?: Array<Record<string, string[]>>;
  tags?: string[];
  summary?: string;
};

// Parameter definition for query/path/header/cookie.
export type ParameterObject = {
  name: string;
  in: ParameterLocation;
  required?: boolean;
  schema?: SchemaObject;
};

// Path item mapping method -> operation.
export type PathItemObject = Record<HttpMethod, OperationObject>;

// Root OpenAPI document shape.
export type OpenApiSpec = {
  openapi: string;
  info?: Record<string, unknown>;
  paths?: Record<string, PathItemObject>;
  components?: {
    schemas?: Record<string, SchemaObject>;
    securitySchemes?: Record<string, unknown>;
  };
};

// Flattened field descriptor for requests/responses.
export type FieldShape = {
  name: string;
  type: string;
  format?: string;
  entity?: string;
};

// Flattened parameter descriptor, with its location.
export type ParamShape = FieldShape & {
  location: ParameterLocation;
};

// Normalized operation shape used by dependency extraction.
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

// Dependency relation inferred between two operations.
export type Dependency = {
  fromOperation: string;
  toOperation: string;
  field: string;
  type: string;
  kind: "body" | "path" | "query" | "header" | "cookie" | "auth";
  reason: "exact-name" | "entity-id" | "auth";
};
