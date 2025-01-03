import { KilnError } from "../error_handlers"

export type JsonSchema = {
  type: "object"
  properties: Record<string, JsonSchemaProperty>
  required: string[]
}

export type JsonSchemaProperty = {
  title: string
  description: string
  type: "number" | "string" | "integer" | "boolean"
}

// We have our own model type.
// Actual JSON schema is too hard to work with in Svelte. It uses dicts, so order would keep moving around as keys change.
export type SchemaModelProperty = {
  id: string
  title: string
  description: string
  type: "number" | "string" | "integer" | "boolean"
  required: boolean
}
export type SchemaModel = {
  properties: SchemaModelProperty[]
}

export function model_from_schema(s: JsonSchema): SchemaModel {
  return {
    properties: Object.entries(s.properties).map(([id, options]) => ({
      id,
      title: options.title || id,
      description: options.description,
      type: options.type,
      required: !!s.required.includes(id),
    })),
  }
}

export function model_from_schema_string(s: string): SchemaModel {
  return model_from_schema(JSON.parse(s))
}

export function title_to_name(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/ /g, "_")
    .replace(/[^a-z0-9_.]/g, "")
}

export function schema_from_model(m: SchemaModel): JsonSchema {
  for (let i = 0; i < m.properties.length; i++) {
    const title = m.properties[i].title
    if (!title) {
      throw new KilnError("Property is empty. Please provide a name.", null)
    }
    const safe_name = title_to_name(m.properties[i].title)
    if (!safe_name) {
      throw new KilnError(
        "Property name only contains special characters. Must be alphanumeric. Provided name with issues: " +
          m.properties[i].title,
        null,
      )
    }
  }
  return {
    type: "object",
    properties: Object.fromEntries(
      m.properties.map((p) => [
        p.id || title_to_name(p.title),
        {
          title: p.title,
          type: p.type,
          description: p.description,
        },
      ]),
    ),
    required: m.properties
      .filter((p) => p.required)
      .map((p) => title_to_name(p.title)),
  }
}

export function empty_schema_model(): SchemaModel {
  return {
    properties: [],
  }
}

export const empty_schema: JsonSchema = schema_from_model(empty_schema_model())

export function example_schema_model(): SchemaModel {
  return {
    properties: [
      // @ts-expect-error we're not using the id, because we want it to be generated from the title
      {
        title: "Example Property",
        description: "Replace this with your own property",
        type: "string",
        required: true,
      },
    ],
  }
}

export function typed_json_from_schema_model(
  m: SchemaModel,
  data: Record<string, string>,
): Record<string, unknown> {
  const parsed_data: Record<string, unknown> = {}
  const errors: string[] = []
  for (const [prop_id, prop_value] of Object.entries(data)) {
    const property = m.properties.find((p) => p.id === prop_id)
    if (!property) {
      throw new KilnError(
        "Property not allowed in JSON schema: " + prop_id,
        null,
      )
    }
    if (property.type === "string") {
      parsed_data[prop_id] = prop_value
    } else if (prop_value === "") {
      // JS parsing is too flexible. Empty string is not always an error.
      errors.push("Empty string provided for non-string property: " + prop_id)
    } else if (property.type === "number") {
      parsed_data[prop_id] = Number(prop_value)
    } else if (property.type === "boolean") {
      if (prop_value !== "true" && prop_value !== "false") {
        errors.push("Boolean property must be 'true' or 'false': " + prop_id)
      }
      parsed_data[prop_id] = prop_value === "true"
    } else if (property.type === "integer") {
      const parsedValue = Number(prop_value)
      if (!Number.isInteger(parsedValue)) {
        errors.push(
          `Property ${prop_id} must be an integer, got: ${prop_value}`,
        )
      }
      parsed_data[prop_id] = parsedValue
    } else {
      errors.push(
        "Unsupported property type: " +
          property.type +
          "for property " +
          property.id +
          ". This may be supported by the python framework, but is not yet supported in the UI.",
      )
    }
  }
  for (const model_prop of m.properties) {
    if (
      model_prop.required &&
      (parsed_data[model_prop.id] === undefined ||
        parsed_data[model_prop.id] === "")
    ) {
      errors.push("Required property not provided: " + model_prop.id)
    }
  }
  if (errors.length > 0) {
    throw new KilnError(
      "The data did not match the required JSON schema.",
      errors,
    )
  }
  return parsed_data
}
